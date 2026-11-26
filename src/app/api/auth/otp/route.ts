import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { otpRequestSchema } from "@/lib/security/validation";
import { classifySupabaseAuthError } from "@/lib/security/auth-errors";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = otpRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const { email, purpose } = parsed.data;
    const ip = getClientIp(request);

    const ipLimit = checkRateLimit(
      `otp:ip:${ip}`,
      RATE_LIMITS.OTP_SEND.limit,
      RATE_LIMITS.OTP_SEND.windowMs,
      RATE_LIMITS.OTP_SEND.blockMs
    );
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          errorCode: "RATE_LIMITED",
          error: `Too many OTP requests. Retry in ${ipLimit.retryAfterSeconds}s.`,
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

    if (purpose === "signup") {
      // Resend 6-digit signup verification code (no Magic Link redirect)
      const { error: resendErr } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (!resendErr) {
        return NextResponse.json({ sent: true });
      }

      // If Supabase returned rate-limit immediately, surface retryAfterSeconds
      const resendClassified = classifySupabaseAuthError(
        resendErr.message,
        resendErr.status
      );
      if (resendClassified.errorCode === "RATE_LIMITED") {
        return NextResponse.json(
          {
            errorCode: "RATE_LIMITED",
            error: resendErr.message,
            retryAfterSeconds: resendClassified.retryAfterSeconds,
          },
          { status: 429 }
        );
      }

      // Fallback when project uses passwordless email OTP for unconfirmed/existing users
      const { error: fallbackErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });

      if (fallbackErr) {
        const fallbackClassified = classifySupabaseAuthError(
          fallbackErr.message,
          fallbackErr.status
        );
        return NextResponse.json(
          {
            errorCode:
              fallbackClassified.errorCode === "GENERIC"
                ? "OTP_SEND_FAILED"
                : fallbackClassified.errorCode,
            error: fallbackErr.message || resendErr.message,
            retryAfterSeconds: fallbackClassified.retryAfterSeconds,
          },
          { status: fallbackClassified.httpStatus }
        );
      }

      return NextResponse.json({ sent: true });
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      const classified = classifySupabaseAuthError(error.message, error.status);
      return NextResponse.json(
        {
          errorCode:
            classified.errorCode === "GENERIC"
              ? "OTP_SEND_FAILED"
              : classified.errorCode,
          error: error.message,
          retryAfterSeconds: classified.retryAfterSeconds,
        },
        { status: classified.httpStatus }
      );
    }

    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json(
      {
        errorCode: "OTP_SEND_FAILED",
        error: "Unable to send verification code.",
      },
      { status: 500 }
    );
  }
}
