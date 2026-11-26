import type { NextRequest } from "next/server";

interface BucketRecord {
  count: number;
  resetAt: number;
  blockedUntil: number;
}

const store = new Map<string, BucketRecord>();
const MAX_ENTRIES = 10_000;

function pruneExpired(now: number) {
  if (store.size < MAX_ENTRIES) return;
  for (const [key, rec] of store.entries()) {
    if (rec.resetAt <= now && rec.blockedUntil <= now) {
      store.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  progressiveBlockMs = 0
): RateLimitResult {
  const now = Date.now();
  pruneExpired(now);

  const existing = store.get(key);
  if (!existing) {
    store.set(key, { count: 1, resetAt: now + windowMs, blockedUntil: 0 });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 };
  }

  if (existing.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.blockedUntil - now) / 1000)),
    };
  }

  if (existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs, blockedUntil: 0 });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    if (progressiveBlockMs > 0) {
      existing.blockedUntil = now + progressiveBlockMs;
    }
    const until = Math.max(existing.resetAt, existing.blockedUntil);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((until - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: 0,
  };
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}

export const RATE_LIMITS = {
  OTP_SEND: { limit: 3, windowMs: 10 * 60 * 1000, blockMs: 5 * 60 * 1000 },
  OTP_VERIFY: { limit: 8, windowMs: 10 * 60 * 1000, blockMs: 5 * 60 * 1000 },
  ORDER_CREATE: { limit: 5, windowMs: 60 * 60 * 1000, blockMs: 15 * 60 * 1000 },
  ORDER_NOTIFY: { limit: 10, windowMs: 60 * 60 * 1000, blockMs: 10 * 60 * 1000 },
  ADMIN_API: { limit: 60, windowMs: 60 * 1000, blockMs: 60 * 1000 },
  GENERAL_API: { limit: 120, windowMs: 60 * 1000, blockMs: 30 * 1000 },
} as const;
