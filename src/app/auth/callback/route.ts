import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceClient } from "@/lib/supabase/service";
import { ADMIN_PORTAL_PATH, PRIMARY_ADMIN_EMAIL } from "@/lib/constants";

function sanitizeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/";
  }
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/?authError=missing_code`);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      console.error("[Auth Callback] Code exchange failed:", error?.message);
      return NextResponse.redirect(`${origin}/?authError=oauth_failed`);
    }

    const user = data.user;
    const meta = (user.user_metadata || {}) as Record<string, unknown>;
    const resolvedName =
      (typeof meta.full_name === "string" && meta.full_name.trim()
        ? meta.full_name.trim()
        : undefined) ||
      (typeof meta.name === "string" && meta.name.trim()
        ? meta.name.trim()
        : undefined);
    const resolvedPhone =
      typeof meta.phone === "string" && meta.phone.trim()
        ? meta.phone.trim()
        : undefined;

    const dbWriter = createOptionalServiceClient() ?? supabase;
    const { data: existingProfile } = await dbWriter
      .from("profiles")
      .select("id, full_name, phone, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (existingProfile) {
      const patch: Record<string, string> = {
        email: user.email || "",
      };
      if (!existingProfile.full_name && resolvedName) {
        patch.full_name = resolvedName;
      }
      if (!existingProfile.phone && resolvedPhone) {
        patch.phone = resolvedPhone;
      }
      await dbWriter.from("profiles").update(patch).eq("id", user.id);
    } else {
      await dbWriter.from("profiles").insert({
        id: user.id,
        email: user.email || "",
        ...(resolvedName ? { full_name: resolvedName } : {}),
        ...(resolvedPhone ? { phone: resolvedPhone } : {}),
        is_admin: false,
      });
    }

    const isAdmin =
      Boolean(existingProfile?.is_admin) ||
      (user.email || "").toLowerCase() === PRIMARY_ADMIN_EMAIL;

    const finalName = existingProfile?.full_name || resolvedName;
    const finalPhone = existingProfile?.phone || resolvedPhone;
    const isRecovery =
      searchParams.get("type") === "recovery" ||
      next.startsWith("/reset-password");
    const isGoogleAuth =
      user.app_metadata?.provider === "google" ||
      (Array.isArray(user.identities) &&
        user.identities.some((ident) => ident.provider === "google"));

    const intendedTarget =
      next === "/" && isAdmin && !isRecovery ? ADMIN_PORTAL_PATH : next;

    // Mandatory onboarding profile completion if Google OAuth user is missing Name or Phone
    if (!isRecovery && isGoogleAuth && (!finalName || !finalPhone)) {
      return NextResponse.redirect(
        `${origin}/complete-profile?next=${encodeURIComponent(intendedTarget)}`
      );
    }

    return NextResponse.redirect(`${origin}${intendedTarget}`);
  } catch (err) {
    console.error("[Auth Callback] Unexpected error:", err);
    return NextResponse.redirect(`${origin}/?authError=oauth_failed`);
  }
}
