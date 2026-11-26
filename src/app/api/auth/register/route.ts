import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceClient } from "@/lib/supabase/service";
import { registerSchema } from "@/lib/security/validation";
import { classifySupabaseAuthError } from "@/lib/security/auth-errors";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "Please complete name, Egyptian phone (01XXXXXXXXX), email, and password.",
        },
        { status: 400 }
      );
    }

    const { email, password, fullName, phone } = parsed.data;
    const ip = getClientIp(request);

    const ipLimit = checkRateLimit(
      `register:ip:${ip}`,
      RATE_LIMITS.OTP_SEND.limit,
      RATE_LIMITS.OTP_SEND.windowMs,
      RATE_LIMITS.OTP_SEND.blockMs
    );
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          errorCode: "RATE_LIMITED",
          error: `Too many registration attempts. Retry in ${ipLimit.retryAfterSeconds}s.`,
          retryAfterSeconds: ipLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
        }
      );
    }

    const emailLimit = checkRateLimit(
      `otp:email:${email}`,
      RATE_LIMITS.OTP_SEND.limit,
      RATE_LIMITS.OTP_SEND.windowMs,
      RATE_LIMITS.OTP_SEND.blockMs
    );
    if (!emailLimit.allowed) {
      return NextResponse.json(
        {
          errorCode: "RATE_LIMITED",
          error: `Verification code recently sent. Retry in ${emailLimit.retryAfterSeconds}s.`,
          retryAfterSeconds: emailLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(emailLimit.retryAfterSeconds) },
        }
      );
    }

    const supabase = await createServerSupabaseClient();

    // Register user and persist full_name + phone into auth user_metadata once
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
        },
      },
    });

    if (error) {
      const classified = classifySupabaseAuthError(error.message, error.status);
      return NextResponse.json(
        {
          errorCode: classified.errorCode,
          error: error.message,
          retryAfterSeconds: classified.retryAfterSeconds,
        },
        {
          status: classified.httpStatus,
          headers: classified.retryAfterSeconds
            ? { "Retry-After": String(classified.retryAfterSeconds) }
            : undefined,
        }
      );
    }

    // Supabase returns empty identities when email already exists (anti-enumeration)
    if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      return NextResponse.json(
        {
          errorCode: "EMAIL_EXISTS",
          error: "An account with this email already exists. Please sign in.",
        },
        { status: 409 }
      );
    }

    // Best-effort service upsert into profiles if service-role key is configured.
    // Otherwise handle_new_user() trigger + /api/auth/verify sync from user_metadata.
    if (data.user) {
      const service = createOptionalServiceClient();
      if (service) {
        await service.from("profiles").upsert(
          {
            id: data.user.id,
            email,
            full_name: fullName,
            phone,
            is_admin: false,
          },
          { onConflict: "id" }
        );
      }
    }

    // Never leave the user session open before OTP verification
    if (data.session) {
      await supabase.auth.signOut();
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (otpErr) {
        const classified = classifySupabaseAuthError(otpErr.message, otpErr.status);
        return NextResponse.json(
          {
            errorCode:
              classified.errorCode === "GENERIC"
                ? "OTP_SEND_FAILED"
                : classified.errorCode,
            error: otpErr.message,
            retryAfterSeconds: classified.retryAfterSeconds,
          },
          { status: classified.httpStatus }
        );
      }
    }

    return NextResponse.json(
      {
        registered: true,
        requiresVerification: true,
        email,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      {
        errorCode: "GENERIC",
        error: "Unable to complete registration. Please try again.",
      },
      { status: 500 }
    );
  }
}
