import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./client";
import { ADMIN_PORTAL_PATH, PRIMARY_ADMIN_EMAIL } from "@/lib/constants";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";

export async function updateSessionAndSecurity(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const ip = getClientIp(request);

  // 1. General API burst rate limit
  if (pathname.startsWith("/api/")) {
    const general = checkRateLimit(
      `api:${ip}`,
      RATE_LIMITS.GENERAL_API.limit,
      RATE_LIMITS.GENERAL_API.windowMs,
      RATE_LIMITS.GENERAL_API.blockMs
    );
    if (!general.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: { "Retry-After": String(general.retryAfterSeconds) },
        }
      );
    }
  }

  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[]
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminPage = pathname.startsWith(ADMIN_PORTAL_PATH);
  const isLegacyAdminPath = pathname.startsWith("/admin");

  if (isLegacyAdminPath) {
    return response;
  }

  if (!isAdminApi && !isAdminPage) {
    // Refresh session silently for storefront routes
    await supabase.auth.getUser();
    return response;
  }

  // 2. Strict Admin Route & API Rate Limit + Zero-Trust Verification
  if (isAdminApi) {
    const adminBurst = checkRateLimit(
      `admin:${ip}`,
      RATE_LIMITS.ADMIN_API.limit,
      RATE_LIMITS.ADMIN_API.windowMs,
      RATE_LIMITS.ADMIN_API.blockMs
    );
    if (!adminBurst.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: { "Retry-After": String(adminBurst.retryAfterSeconds) },
        }
      );
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Hidden studio-vault layout returns 404 when unauthenticated or non-admin
    return response;
  }

  if (isAdminApi) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    const isPrimaryOwner =
      Boolean(user.email_confirmed_at) &&
      user.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL;

    if (!profile?.is_admin && !isPrimaryOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return response;
}
