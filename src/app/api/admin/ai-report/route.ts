import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/security/admin-auth";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { createOptionalServiceClient } from "@/lib/supabase/service";
import {
  buildAnonymizedPromptPayload,
  computeAdminSalesAnalytics,
  parseAnalyticsRange,
  type AiSalesInsightsReport,
} from "@/lib/analytics/sales";

const AI_REPORT_RATE_LIMIT = {
  limit: 6,
  windowMs: 10 * 60 * 1000,
  blockMs: 5 * 60 * 1000,
} as const;

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    en: {
      type: "OBJECT",
      properties: {
        overallPerformance: { type: "STRING" },
        bestSellersAnalysis: { type: "STRING" },
        restockPriorities: { type: "STRING" },
        nextDropRecommendations: {
          type: "ARRAY",
          items: { type: "STRING" },
        },
      },
      required: [
        "overallPerformance",
        "bestSellersAnalysis",
        "restockPriorities",
        "nextDropRecommendations",
      ],
    },
    ar: {
      type: "OBJECT",
      properties: {
        overallPerformance: { type: "STRING" },
        bestSellersAnalysis: { type: "STRING" },
        restockPriorities: { type: "STRING" },
        nextDropRecommendations: {
          type: "ARRAY",
          items: { type: "STRING" },
        },
      },
      required: [
        "overallPerformance",
        "bestSellersAnalysis",
        "restockPriorities",
        "nextDropRecommendations",
      ],
    },
  },
  required: ["en", "ar"],
} as const;

export async function POST(request: NextRequest) {
  const { supabase, userId, error } = await requireAdminApi();
  if (error || !userId) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(request);
  const limit = checkRateLimit(
    `admin:ai-report:${userId}:${ip}`,
    AI_REPORT_RATE_LIMIT.limit,
    AI_REPORT_RATE_LIMIT.windowMs,
    AI_REPORT_RATE_LIMIT.blockMs
  );
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `AI report rate limit reached. Try again in ${limit.retryAfterSeconds}s.`,
        retryAfterSeconds: limit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({
      configured: false,
      messageEn:
        "GEMINI_API_KEY is not configured yet. Add GEMINI_API_KEY to your .env.local file and Vercel Environment Variables to enable on-demand AI sales reports.",
      messageAr:
        "مفتاح GEMINI_API_KEY غير مضاف حالياً. أضف GEMINI_API_KEY إلى ملف .env.local وإعدادات Vercel (Environment Variables) لتفعيل تقارير الذكاء الاصطناعي.",
    });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const range = parseAnalyticsRange(
      typeof body?.range === "string" ? body.range : null
    );

    const dbReader = createOptionalServiceClient() ?? supabase;
    const analytics = await computeAdminSalesAnalytics(dbReader, range);
    const anonymizedSnapshot = buildAnonymizedPromptPayload(analytics);

    const systemPrompt = [
      "You are the Senior Merchandising & Operations Analyst for ULTIMATE (ultimate-wear.com), a luxury heavyweight hoodie brand in Egypt (currency: EGP).",
      "Analyze ONLY the provided anonymized, aggregate sales metrics and produce clear, executive, data-backed insights in BOTH English ('en') and Egyptian/Modern Business Arabic ('ar').",
      "For each language, cover:",
      "1) overallPerformance: Overall sales performance, EGP revenue, AOV, and pending-verification vs verified health.",
      "2) bestSellersAnalysis: Top-selling products, dominant sizes, color skins, and top cities.",
      "3) restockPriorities: Practical inventory & variant restock priorities based on order volume and size/color skew (note cleanly if data is sparse).",
      "4) nextDropRecommendations: Exactly 3 concise, actionable recommendations for the next hoodie drop.",
      "Keep statements faithful to the numbers provided. Return valid JSON matching the schema.",
    ].join("\n");

    const geminiRes = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemPrompt}\n\nANONYMIZED_METRICS_JSON:\n${JSON.stringify(
                  anonymizedSnapshot
                )}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text().catch(() => "");
      console.error(
        `[Admin AI Report] Gemini API rejected request (HTTP ${geminiRes.status}):`,
        errBody
      );
      return NextResponse.json(
        {
          error: `Gemini API error (HTTP ${geminiRes.status}). Check GEMINI_API_KEY validity and quota.`,
        },
        { status: 502 }
      );
    }

    const geminiJson = (await geminiRes.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const rawText =
      geminiJson.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("")
        .trim() || "";

    if (!rawText) {
      return NextResponse.json(
        { error: "Gemini returned an empty response." },
        { status: 502 }
      );
    }

    const cleanedJsonText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    const parsedReport = JSON.parse(cleanedJsonText) as AiSalesInsightsReport;

    return NextResponse.json({
      configured: true,
      model: "gemini-2.5-flash",
      generatedAt: new Date().toISOString(),
      range,
      report: parsedReport,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate AI sales report.";
    console.error("[Admin AI Report] Exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
