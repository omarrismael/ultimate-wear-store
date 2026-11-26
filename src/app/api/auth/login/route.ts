import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { passwordLoginSchema } from "@/lib/security/validation";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = passwordLoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please enter your email and password." },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const ip = getClientIp(request);

    const limit = checkRateLimit(
      `login:${ip}:${email}`,
      RATE_LIMITS.OTP_VERIFY.limit,
      RATE_LIMITS.OTP_VERIFY.windowMs,
      RATE_LIMITS.OTP_VERIFY.blockMs
    );
    if (!limit.allowed) {
      return NextResponse.json(
        {
          errorCode: "RATE_LIMITED",
          error: `Too many sign-in attempts. Try again in ${limit.retryAfterSeconds}s.`,
          retryAfterSeconds: limit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("email not confirmed")) {
        // Send a fresh 6-digit verification code so the user can complete verification
        await supabase.auth.resend({ type: "signup", email }).catch(() => null);
        return NextResponse.json(
          {
            errorCode: "EMAIL_NOT_CONFIRMED",
            error: "Please verify your email with the 6-digit OTP first.",
            requiresVerification: true,
            email,
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        {
          errorCode: "INVALID_CREDENTIALS",
          error: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { error: "Authentication failed." },
        { status: 401 }
      );
    }

    const meta = (data.user.user_metadata || {}) as Record<string, unknown>;
    const metaName =
      typeof meta.full_name === "string" && meta.full_name.trim()
        ? meta.full_name.trim()
        : undefined;
    const metaPhone =
      typeof meta.phone === "string" && meta.phone.trim()
        ? meta.phone.trim()
        : undefined;

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .eq("id", data.user.id)
      .maybeSingle();

    if (existingProfile) {
      const patch: Record<string, string> = {};
      if (!existingProfile.full_name && metaName) patch.full_name = metaName;
      if (!existingProfile.phone && metaPhone) patch.phone = metaPhone;
      if (Object.keys(patch).length > 0) {
        await supabase.from("profiles").update(patch).eq("id", data.user.id);
      }
    } else {
      await supabase.from("profiles").insert({
        id: data.user.id,
        email: data.user.email || email,
        ...(metaName ? { full_name: metaName } : {}),
        ...(metaPhone ? { phone: metaPhone } : {}),
        is_admin: false,
      });
    }

    return NextResponse.json({
      authenticated: true,
      userId: data.user.id,
    });
  } catch {
    return NextResponse.json(
      { error: "Sign in failed. Please try again." },
      { status: 500 }
    );
  }
}
