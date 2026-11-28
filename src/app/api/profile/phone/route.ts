import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceClient } from "@/lib/supabase/service";
import { phoneUpdateSchema } from "@/lib/security/validation";

function isPermissionDeniedError(
  err: { code?: string; message?: string } | null | undefined
): boolean {
  if (!err) return false;
  return (
    err.code === "42501" ||
    Boolean(err.message?.toLowerCase().includes("permission denied"))
  );
}

async function upsertProfileTable(
  client: SupabaseClient,
  params: {
    userId: string;
    email: string;
    phone: string;
    fullName?: string;
    governorate?: string;
  }
) {
  const { userId, email, phone, fullName, governorate } = params;

  const { data: existingProfile, error: selectErr } = await client
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (selectErr) {
    return selectErr;
  }

  const basePayload = {
    email,
    phone,
    ...(fullName ? { full_name: fullName } : {}),
  };

  let { error } = existingProfile
    ? await client
        .from("profiles")
        .update({
          ...basePayload,
          ...(governorate ? { governorate } : {}),
        })
        .eq("id", userId)
    : await client.from("profiles").insert({
        id: userId,
        ...basePayload,
        ...(governorate ? { governorate } : {}),
        is_admin: false,
      });

  // Fallback if profiles.governorate column has not been migrated yet
  if (
    error &&
    governorate &&
    (error.code === "PGRST204" ||
      error.code === "42703" ||
      error.message?.includes("governorate"))
  ) {
    const retry = existingProfile
      ? await client.from("profiles").update(basePayload).eq("id", userId)
      : await client.from("profiles").insert({
          id: userId,
          ...basePayload,
          is_admin: false,
        });
    error = retry.error;
  }

  return error;
}

/**
 * POST /api/profile/phone
 * Saves full_name + phone (+ optional governorate) for the authenticated user
 * into auth user_metadata and public.profiles using:
 *   1) Service-role client when configured,
 *   2) SECURITY DEFINER RPC `upsert_own_profile` (bypasses locked table grants),
 *   3) Authenticated user client fallback under RLS,
 * while preserving user_metadata sync so onboarding never stalls on stale grants.
 */
export async function POST(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.email_confirmed_at) {
      return NextResponse.json(
        { error: "Email verification required before updating profile." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = phoneUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "Invalid Egyptian mobile number (01XXXXXXXXX).",
        },
        { status: 400 }
      );
    }

    // 1. Save into Supabase auth user_metadata (persists across sessions + used by AuthProvider/Orders)
    const { error: metaErr } = await authClient.auth.updateUser({
      data: {
        phone: parsed.data.phone,
        ...(parsed.data.fullName ? { full_name: parsed.data.fullName } : {}),
        ...(parsed.data.governorate
          ? { governorate: parsed.data.governorate }
          : {}),
      },
    });

    const profilePayload = {
      userId: user.id,
      email: user.email || "",
      phone: parsed.data.phone,
      fullName: parsed.data.fullName,
      governorate: parsed.data.governorate,
    };

    // 2. Try Service-Role direct table upsert if configured
    const serviceClient = createOptionalServiceClient();
    if (serviceClient) {
      const serviceErr = await upsertProfileTable(serviceClient, profilePayload);
      if (!serviceErr) {
        return NextResponse.json({ saved: true, profileSynced: true });
      }
      console.warn(
        "[Profile Update] Service client profiles write failed; trying SECURITY DEFINER RPC:",
        serviceErr.message
      );
    }

    // 3. Try SECURITY DEFINER RPC `upsert_own_profile` (immune to table GRANT drift)
    const { error: rpcErr } = await authClient.rpc("upsert_own_profile", {
      p_full_name: parsed.data.fullName ?? null,
      p_phone: parsed.data.phone,
      p_governorate: parsed.data.governorate ?? null,
    });

    if (!rpcErr) {
      return NextResponse.json({ saved: true, profileSynced: true });
    }

    // 4. Fall back to direct authenticated table write when RPC isn't created yet
    const directErr = await upsertProfileTable(authClient, profilePayload);
    if (!directErr) {
      return NextResponse.json({ saved: true, profileSynced: true });
    }

    // 5. If user_metadata succeeded and DB failed strictly due to missing GRANT / RPC on live Postgres,
    // allow onboarding to complete cleanly without trapping the customer on /complete-profile
    if (!metaErr && isPermissionDeniedError(directErr)) {
      console.warn(
        "[Profile Update] Auth user_metadata saved, but public.profiles lacks GRANT/upsert_own_profile RPC:",
        directErr.message
      );
      return NextResponse.json({
        saved: true,
        profileSynced: false,
        metadataSynced: true,
      });
    }

    const isPermDenied = isPermissionDeniedError(directErr);
    return NextResponse.json(
      {
        errorCode: isPermDenied ? "DB_PERMISSION_DENIED" : "GENERIC",
        error: directErr.message,
      },
      { status: isPermDenied ? 500 : 400 }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to save phone number." },
      { status: 500 }
    );
  }
}
