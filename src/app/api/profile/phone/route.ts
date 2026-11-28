import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceClient } from "@/lib/supabase/service";
import { phoneUpdateSchema } from "@/lib/security/validation";

/**
 * POST /api/profile/phone
 * Saves full_name + phone for the authenticated user into both auth
 * user_metadata and public.profiles (using service client if configured,
 * falling back to the user's own session client under RLS).
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

    // Always mirror phone + full_name + governorate into Supabase auth user_metadata so
    // profile data stays intact across sessions even if SQL grants lag behind.
    await authClient.auth
      .updateUser({
        data: {
          phone: parsed.data.phone,
          ...(parsed.data.fullName ? { full_name: parsed.data.fullName } : {}),
          ...(parsed.data.governorate
            ? { governorate: parsed.data.governorate }
            : {}),
        },
      })
      .catch(() => null);

    const dbWriter = createOptionalServiceClient() ?? authClient;

    const { data: existingProfile, error: selectErr } = await dbWriter
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (selectErr) {
      const isPermDenied =
        selectErr.code === "42501" ||
        selectErr.message.toLowerCase().includes("permission denied");
      return NextResponse.json(
        {
          errorCode: isPermDenied ? "DB_PERMISSION_DENIED" : "GENERIC",
          error: selectErr.message,
        },
        { status: isPermDenied ? 500 : 400 }
      );
    }

    const basePayload = {
      email: user.email || "",
      phone: parsed.data.phone,
      ...(parsed.data.fullName ? { full_name: parsed.data.fullName } : {}),
    };

    let { error } = existingProfile
      ? await dbWriter
          .from("profiles")
          .update({
            ...basePayload,
            ...(parsed.data.governorate
              ? { governorate: parsed.data.governorate }
              : {}),
          })
          .eq("id", user.id)
      : await dbWriter.from("profiles").insert({
          id: user.id,
          ...basePayload,
          ...(parsed.data.governorate
            ? { governorate: parsed.data.governorate }
            : {}),
          is_admin: false,
        });

    // Fallback if profiles.governorate column has not been migrated yet
    if (
      error &&
      parsed.data.governorate &&
      (error.code === "PGRST204" ||
        error.code === "42703" ||
        error.message?.includes("governorate"))
    ) {
      const retry = existingProfile
        ? await dbWriter
            .from("profiles")
            .update(basePayload)
            .eq("id", user.id)
        : await dbWriter.from("profiles").insert({
            id: user.id,
            ...basePayload,
            is_admin: false,
          });
      error = retry.error;
    }

    if (error) {
      const isPermDenied =
        error.code === "42501" ||
        error.message.toLowerCase().includes("permission denied");
      return NextResponse.json(
        {
          errorCode: isPermDenied ? "DB_PERMISSION_DENIED" : "GENERIC",
          error: error.message,
        },
        { status: isPermDenied ? 500 : 400 }
      );
    }

    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to save phone number." },
      { status: 500 }
    );
  }
}
