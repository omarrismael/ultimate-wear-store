export type AuthErrorCode =
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "RATE_LIMITED"
  | "EMAIL_EXISTS"
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_CONFIRMED"
  | "OTP_SEND_FAILED"
  | "NETWORK_ERROR"
  | "MISSING_CODE"
  | "INVALID_PHONE"
  | "DB_PERMISSION_DENIED"
  | "GENERIC";

export function extractCooldownSeconds(message: string, fallback = 60): number {
  const match = message.match(/(\d+)\s*seconds?/i);
  if (match?.[1]) {
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

export function classifySupabaseAuthError(
  message: string,
  status?: number
): { errorCode: AuthErrorCode; httpStatus: number; retryAfterSeconds?: number } {
  const lower = message.toLowerCase();

  if (
    status === 429 ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("security purposes") ||
    lower.includes("after ")
  ) {
    return {
      errorCode: "RATE_LIMITED",
      httpStatus: 429,
      retryAfterSeconds: extractCooldownSeconds(message, 60),
    };
  }

  if (lower.includes("expired") || lower.includes("otp_expired")) {
    return { errorCode: "OTP_EXPIRED", httpStatus: 410 };
  }

  if (lower.includes("already registered") || lower.includes("already exists")) {
    return { errorCode: "EMAIL_EXISTS", httpStatus: 409 };
  }

  if (lower.includes("email not confirmed")) {
    return { errorCode: "EMAIL_NOT_CONFIRMED", httpStatus: 403 };
  }

  if (
    lower.includes("invalid login") ||
    lower.includes("invalid credentials")
  ) {
    return { errorCode: "INVALID_CREDENTIALS", httpStatus: 401 };
  }

  if (lower.includes("token") || lower.includes("otp")) {
    return { errorCode: "OTP_INVALID", httpStatus: 401 };
  }

  return { errorCode: "GENERIC", httpStatus: status && status >= 400 ? status : 400 };
}
