import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/security/admin-auth";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";
import { createOptionalServiceClient } from "@/lib/supabase/service";
import {
  computeAdminSalesAnalytics,
  parseAnalyticsRange,
} from "@/lib/analytics/sales";

export async function GET(request: NextRequest) {
  const { supabase, userId, error } = await requireAdminApi();
  if (error || !userId) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(request);
  const limit = checkRateLimit(
    `admin:analytics:${userId}:${ip}`,
    RATE_LIMITS.ADMIN_API.limit,
    RATE_LIMITS.ADMIN_API.windowMs,
    RATE_LIMITS.ADMIN_API.blockMs
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  try {
    const range = parseAnalyticsRange(request.nextUrl.searchParams.get("range"));
    const dbReader = createOptionalServiceClient() ?? supabase;
    const analytics = await computeAdminSalesAnalytics(dbReader, range);

    return NextResponse.json({ analytics });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to load sales analytics.";
    console.error("[Admin Analytics] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
