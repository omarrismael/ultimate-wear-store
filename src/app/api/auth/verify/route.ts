import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceClient } from "@/lib/supabase/service";
import { PRIMARY_ADMIN_EMAIL } from "@/lib/constants";
import { otpVerifySchema } from "@/lib/security/validation";
import { classifySupabaseAuthError } from "@/lib/security/auth-errors";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = otpVerifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a valid email and 6-digit verification code." },
        { status: 400 }
      );
    }

    const { email, token, fullName, phone } = parsed.data;
    const ip = getClientIp(request);

    const limit = checkRateLimit(
      `otp-verify:${ip}:${email}`,
      RATE_LIMITS.OTP_VERIFY.limit,
      RATE_LIMITS.OTP_VERIFY.windowMs,
      RATE_LIMITS.OTP_VERIFY.blockMs
    );
    if (!limit.allowed) {
      return NextResponse.json(
        {
          errorCode: "RATE_LIMITED",
          error: `Too many failed verification attempts. Try again in ${limit.retryAfterSeconds}s.`,
          retryAfterSeconds: limit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        }
      );
    }

    const supabase = await createServerSupabaseClient();

    // Primary verification call per requirement: type: 'email'
    let result = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    // Compatibility fallback if Supabase Confirm-Signup template issued a 'signup' scoped 6-digit token
    if (result.error || !result.data.user) {
      const signupResult = await supabase.auth.verifyOtp({
        email,
        token,
        type: "signup",
      });
      if (!signupResult.error && signupResult.data.user) {
        result = signupResult;
      }
    }

    if (result.error || !result.data.user) {
      const classified = classifySupabaseAuthError(
        result.error?.message || "Invalid verification code",
        result.error?.status
      );
      const code =
        classified.errorCode === "OTP_EXPIRED" || classified.errorCode === "RATE_LIMITED"
          ? classified.errorCode
          : "OTP_INVALID";
      return NextResponse.json(
        {
          errorCode: code,
          code,
          retryAfterSeconds: classified.retryAfterSeconds,
          error:
            code === "OTP_EXPIRED"
              ? "This verification code has expired. Please request a new code."
              : code === "RATE_LIMITED"
                ? "Too many verification attempts. Please wait and retry."
                : "Invalid 6-digit verification code. Please check and try again.",
        },
        { status: classified.httpStatus }
      );
    }

    const verifiedUser = result.data.user;
    const meta = (verifiedUser.user_metadata || {}) as Record<string, unknown>;
    const resolvedName =
      fullName ||
      (typeof meta.full_name === "string" && meta.full_name.trim()
        ? meta.full_name.trim()
        : undefined);
    const resolvedPhone =
      phone ||
      (typeof meta.phone === "string" && meta.phone.trim()
        ? meta.phone.trim()
        : undefined);

    // Sync user_metadata if client passed values that aren't saved there yet
    if ((fullName && !meta.full_name) || (phone && !meta.phone)) {
      await supabase.auth
        .updateUser({
          data: {
            ...(resolvedName ? { full_name: resolvedName } : {}),
            ...(resolvedPhone ? { phone: resolvedPhone } : {}),
          },
        })
        .catch(() => null);
    }

    // Upsert profile (never sets is_admin) using service client if available,
    // otherwise the freshly authenticated session client.
    const dbWriter = createOptionalServiceClient() ?? supabase;
    const { data: existingProfile } = await dbWriter
      .from("profiles")
      .select("id, full_name, phone, is_admin")
      .eq("id", verifiedUser.id)
      .maybeSingle();

    if (existingProfile) {
      const patch: Record<string, string> = {
        email: verifiedUser.email || email,
      };
      if (!existingProfile.full_name && resolvedName) {
        patch.full_name = resolvedName;
      }
      if (!existingProfile.phone && resolvedPhone) {
        patch.phone = resolvedPhone;
      }
      await dbWriter.from("profiles").update(patch).eq("id", verifiedUser.id);
    } else {
      await dbWriter.from("profiles").insert({
        id: verifiedUser.id,
        email: verifiedUser.email || email,
        ...(resolvedName ? { full_name: resolvedName } : {}),
        ...(resolvedPhone ? { phone: resolvedPhone } : {}),
        is_admin: false,
      });
    }

    return NextResponse.json({
      verified: true,
      userId: verifiedUser.id,
      hasPhone: Boolean(existingProfile?.phone || resolvedPhone),
      isAdmin:
        Boolean(existingProfile?.is_admin) ||
        (verifiedUser.email || email).toLowerCase() === PRIMARY_ADMIN_EMAIL,
    });
  } catch {
    return NextResponse.json(
      { error: "Verification failed. Please check your connection and retry." },
      { status: 500 }
    );
  }
}
