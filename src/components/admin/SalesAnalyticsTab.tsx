"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Clock,
  DollarSign,
  MapPin,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type {
  AdminSalesAnalytics,
  AiSalesInsightsReport,
  AnalyticsRange,
} from "@/lib/analytics/sales";
import { useI18n } from "@/lib/i18n/context";
import { ElectricLoader } from "@/components/brand/ElectricLoader";

export function SalesAnalyticsTab() {
  const { locale, t } = useI18n();
  const isAr = locale === "ar";

  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [analytics, setAnalytics] = useState<AdminSalesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiConfigNotice, setAiConfigNotice] = useState<{
    en: string;
    ar: string;
  } | null>(null);
  const [aiReport, setAiReport] = useState<AiSalesInsightsReport | null>(null);
  const [aiGeneratedAt, setAiGeneratedAt] = useState<string | null>(null);
  const [aiReportLang, setAiReportLang] = useState<"en" | "ar">(
    isAr ? "ar" : "en"
  );

  useEffect(() => {
    setAiReportLang(isAr ? "ar" : "en");
  }, [isAr]);

  const loadAnalytics = useCallback(async (selectedRange: AnalyticsRange) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics?range=${selectedRange}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.analytics) {
        setError(data?.error || "Failed to load analytics.");
        return;
      }
      setAnalytics(data.analytics as AdminSalesAnalytics);
    } catch {
      setError("Network error while loading analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics(range);
  }, [range, loadAnalytics]);

  const handleGenerateAiReport = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiConfigNotice(null);
    try {
      const res = await fetch("/api/admin/ai-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setAiError(data?.error || "Could not generate AI report.");
        return;
      }

      if (data?.configured === false) {
        setAiConfigNotice({
          en: data.messageEn,
          ar: data.messageAr,
        });
        return;
      }

      if (data?.report) {
        setAiReport(data.report as AiSalesInsightsReport);
        setAiGeneratedAt(data.generatedAt || new Date().toISOString());
      } else {
        setAiError("Empty AI report response.");
      }
    } catch {
      setAiError("Network error while requesting AI insights.");
    } finally {
      setAiLoading(false);
    }
  };

  const rangeOptions: Array<{ id: AnalyticsRange; en: string; ar: string }> = [
    { id: "7d", en: "7 Days", ar: "7 أيام" },
    { id: "30d", en: "30 Days", ar: "30 يوم" },
    { id: "all", en: "All Time", ar: "كل الفترات" },
  ];

  const maxProductUnits = Math.max(
    1,
    ...(analytics?.topProducts.map((p) => p.unitsSold) || [1])
  );
  const maxCityOrders = Math.max(
    1,
    ...(analytics?.topCities.map((c) => c.ordersCount) || [1])
  );

  const activeAiSection = aiReport ? aiReport[aiReportLang] : null;

  return (
    <div className="mt-6 space-y-6">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="h-5 w-5 text-[#D4AF37]" />
          <div>
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-[var(--text-primary)]">
              {isAr
                ? "تحليلات المبيعات والأداء"
                : "Sales Performance & Variant Intelligence"}
            </h2>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {isAr
                ? "إحصائيات مباشرة من قاعدة البيانات لجميع الطلبات والموديلات."
                : "Live Postgres aggregations across orders, sizes, color skins, and cities."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] p-1">
            {rangeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRange(opt.id)}
                className={`rounded-lg px-3 py-1 text-[11px] font-semibold transition-colors ${
                  range === opt.id
                    ? "bg-[#D4AF37] text-[#09090B]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {isAr ? opt.ar : opt.en}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => loadAnalytics(range)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] px-3 py-2 text-[11px] font-semibold text-[var(--text-primary)] hover:border-[#D4AF37] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{isAr ? "تحديث" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-[#ff3b30]/50 bg-[#ff3b30]/10 px-4 py-3 text-xs text-[#ff3b30]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !analytics ? (
        <ElectricLoader label="ULTIMATE // ANALYTICS" />
      ) : analytics ? (
        <>
          {/* KPI Summary Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl border border-[#D4AF37]/45 bg-[var(--bg-surface)] p-4">
              <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                <span>{isAr ? "الإيراد المؤكد" : "Verified Revenue"}</span>
                <DollarSign className="h-4 w-4 text-[#D4AF37]" />
              </div>
              <p className="font-mono mt-2 text-xl font-bold text-[var(--accent-gold-ink)]">
                {analytics.summary.verifiedRevenueEgp.toLocaleString()} {t.shop.egp}
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                {isAr
                  ? `${analytics.summary.verifiedOrders} طلب مؤكد/مكتمل`
                  : `${analytics.summary.verifiedOrders} confirmed/shipped/delivered`}
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                <span>{isAr ? "قيد المراجعة" : "Pending Verification"}</span>
                <Clock className="h-4 w-4 text-[#D4AF37]" />
              </div>
              <p className="font-mono mt-2 text-xl font-bold text-[var(--text-primary)]">
                {analytics.summary.pendingRevenueEgp.toLocaleString()} {t.shop.egp}
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                {analytics.summary.pendingOrders}{" "}
                {isAr ? "طلب بانتظار تأكيد الإيصال" : "orders awaiting verification"}
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                <span>{isAr ? "متوسط قيمة الطلب" : "Avg. Order Value"}</span>
                <TrendingUp className="h-4 w-4 text-[#D4AF37]" />
              </div>
              <p className="font-mono mt-2 text-xl font-bold text-[var(--text-primary)]">
                {analytics.summary.averageOrderValueEgp.toLocaleString()} {t.shop.egp}
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                {isAr ? "على الطلبات المؤكدة" : "Based on verified orders"}
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                <span>{isAr ? "إجمالي الطلبات" : "Total Orders"}</span>
                <ShoppingBag className="h-4 w-4 text-[#D4AF37]" />
              </div>
              <p className="font-mono mt-2 text-xl font-bold text-[var(--text-primary)]">
                {analytics.summary.totalOrders}
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                {analytics.summary.totalUnitsSold}{" "}
                {isAr ? "قطعة مباعة" : "active units"} ·{" "}
                {analytics.summary.cancelledOrders}{" "}
                {isAr ? "ملغي" : "cancelled"}
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                <span>{isAr ? "نسبة التأكيد" : "Verification Rate"}</span>
                <ShieldCheck className="h-4 w-4 text-[#D4AF37]" />
              </div>
              <p className="font-mono mt-2 text-xl font-bold text-[var(--text-primary)]">
                {analytics.summary.verificationRatePct}%
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                {analytics.summary.verifiedOrders}/{analytics.summary.activeOrders}{" "}
                {isAr ? "طلب نشط مؤكد" : "active orders verified"}
              </p>
            </div>
          </div>

          {/* Product Performance + Size & Color Breakdown */}
          <div className="grid gap-5 lg:grid-cols-12">
            {/* Top Products */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 lg:col-span-6">
              <h3 className="font-display text-sm font-extrabold uppercase tracking-wider text-[var(--text-primary)]">
                {isAr ? "الأكثر مبيعاً (المنتجات)" : "Top-Selling Hoodies"}
              </h3>

              {analytics.topProducts.length === 0 ? (
                <p className="mt-6 text-xs text-[var(--text-muted)]">
                  {isAr
                    ? "لا توجد مبيعات في هذه الفترة بعد."
                    : "No sales recorded in this timeframe yet."}
                </p>
              ) : (
                <div className="mt-4 space-y-3.5">
                  {analytics.topProducts.slice(0, 8).map((prod, idx) => {
                    const widthPct = Math.max(
                      8,
                      Math.round((prod.unitsSold / maxProductUnits) * 100)
                    );
                    return (
                      <div key={prod.key} className="space-y-1">
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="truncate font-semibold text-[var(--text-primary)]">
                            <span className="font-mono me-1.5 text-[var(--accent-gold-ink)]">
                              0{idx + 1}
                            </span>
                            {isAr ? prod.titleAr : prod.titleEn}
                          </span>
                          <span className="font-mono shrink-0 text-[11px] text-[var(--text-secondary)]">
                            {prod.unitsSold} {isAr ? "قطعة" : "units"} ·{" "}
                            <strong className="text-[var(--accent-gold-ink)]">
                              {prod.revenueEgp.toLocaleString()} {t.shop.egp}
                            </strong>
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                          <div
                            className="h-full rounded-full bg-[#D4AF37]"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sizes + Color Skins */}
            <div className="space-y-5 lg:col-span-6">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
                <h3 className="font-display text-sm font-extrabold uppercase tracking-wider text-[var(--text-primary)]">
                  {isAr ? "توزيع المقاسات" : "Size Breakdown"}
                </h3>
                {analytics.sizeBreakdown.length === 0 ? (
                  <p className="mt-4 text-xs text-[var(--text-muted)]">
                    {isAr ? "لا توجد بيانات مقاسات." : "No size breakdown yet."}
                  </p>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {analytics.sizeBreakdown.map((sz) => (
                      <div
                        key={sz.label}
                        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] p-3 text-center"
                      >
                        <p className="font-display text-base font-extrabold text-[var(--text-primary)]">
                          {sz.label}
                        </p>
                        <p className="font-mono mt-1 text-sm font-bold text-[var(--accent-gold-ink)]">
                          {sz.unitsSold} {isAr ? "قطعة" : "u"}
                        </p>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                          <div
                            className="h-full bg-[#D4AF37]"
                            style={{ width: `${sz.sharePct}%` }}
                          />
                        </div>
                        <p className="font-mono mt-1 text-[10px] text-[var(--text-muted)]">
                          {sz.sharePct}%
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
                <h3 className="font-display text-sm font-extrabold uppercase tracking-wider text-[var(--text-primary)]">
                  {isAr ? "أداء الألوان (السكنات)" : "Color Skins Performance"}
                </h3>
                {analytics.colorBreakdown.length === 0 ? (
                  <p className="mt-4 text-xs text-[var(--text-muted)]">
                    {isAr ? "لا توجد بيانات ألوان." : "No color breakdown yet."}
                  </p>
                ) : (
                  <div className="mt-3 space-y-2.5">
                    {analytics.colorBreakdown.slice(0, 6).map((color) => (
                      <div
                        key={color.label}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3 py-2 text-xs"
                      >
                        <span className="truncate font-medium text-[var(--text-primary)]">
                          {color.label}
                        </span>
                        <span className="font-mono shrink-0 text-[11px] text-[var(--text-secondary)]">
                          {color.unitsSold} {isAr ? "قطعة" : "units"} ({color.sharePct}
                          %) · {color.revenueEgp.toLocaleString()} {t.shop.egp}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Geographic Breakdown */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#D4AF37]" />
              <h3 className="font-display text-sm font-extrabold uppercase tracking-wider text-[var(--text-primary)]">
                {isAr
                  ? "أعلى المحافظات / المدن طلباً"
                  : "Top Cities / Governorates"}
              </h3>
            </div>

            {analytics.topCities.length === 0 ? (
              <p className="mt-4 text-xs text-[var(--text-muted)]">
                {isAr
                  ? "لا توجد طلبات مسجلة بالمدن حتى الآن."
                  : "No geographic order data in this timeframe yet."}
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {analytics.topCities.map((c) => {
                  const barPct = Math.max(
                    10,
                    Math.round((c.ordersCount / maxCityOrders) * 100)
                  );
                  return (
                    <div
                      key={c.city}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] p-3"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
                          {c.city}
                        </span>
                        <span className="font-mono text-xs font-bold text-[var(--accent-gold-ink)]">
                          {c.ordersCount}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                        <div
                          className="h-full bg-[#D4AF37]"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <p className="font-mono mt-1.5 text-[10px] text-[var(--text-muted)]">
                        {c.revenueEgp.toLocaleString()} {t.shop.egp} · {c.sharePct}%
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* On-Demand AI Sales Analyst */}
      <div className="rounded-2xl border border-[#D4AF37]/50 bg-[var(--bg-surface)] p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/60 bg-[#D4AF37]/10 text-[#D4AF37]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold uppercase tracking-wider text-[var(--text-primary)]">
                {isAr
                  ? "محلل المبيعات بالذكاء الاصطناعي"
                  : "ULTIMATE AI Sales Analyst"}
              </h3>
              <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                {isAr
                  ? "يُرسل فقط إحصائيات مجمعة بدون أي بيانات شخصية للعملاء (الاسم/الهاتف/العنوان)."
                  : "Sends strictly anonymized, aggregate metrics only (zero customer PII)."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {aiReport && (
              <button
                type="button"
                onClick={() =>
                  setAiReportLang((prev) => (prev === "ar" ? "en" : "ar"))
                }
                className="rounded-xl border border-[var(--border-strong)] px-3 py-2 text-[11px] font-semibold text-[var(--text-primary)] hover:border-[#D4AF37]"
              >
                {aiReportLang === "ar" ? "View English" : "عرض بالعربية"}
              </button>
            )}
            <button
              type="button"
              onClick={handleGenerateAiReport}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#09090B] transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              <span>
                {aiLoading
                  ? isAr
                    ? "جاري التحليل..."
                    : "Analyzing..."
                  : isAr
                    ? "توليد تقرير ذكي"
                    : "Generate AI Report"}
              </span>
            </button>
          </div>
        </div>

        {aiConfigNotice && (
          <div className="mt-4 rounded-xl border border-[#D4AF37]/60 bg-[#D4AF37]/10 p-4 text-xs text-[var(--text-primary)]">
            <p className="font-semibold text-[var(--accent-gold-ink)]">
              {isAr ? "مطلوب إعداد GEMINI_API_KEY" : "GEMINI_API_KEY Setup Needed"}
            </p>
            <p className="mt-1 leading-relaxed text-[var(--text-secondary)]">
              {isAr ? aiConfigNotice.ar : aiConfigNotice.en}
            </p>
          </div>
        )}

        {aiError && (
          <div className="mt-4 rounded-xl border border-[#ff3b30]/50 bg-[#ff3b30]/10 px-4 py-3 text-xs text-[#ff3b30]">
            {aiError}
          </div>
        )}

        {aiLoading && <ElectricLoader label="ULTIMATE // AI ANALYST" />}

        {!aiLoading && activeAiSection && (
          <div
            dir={aiReportLang === "ar" ? "rtl" : "ltr"}
            className="mt-5 grid gap-4 md:grid-cols-2"
          >
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] p-4">
              <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--accent-gold-ink)]">
                {aiReportLang === "ar"
                  ? "1. الأداء العام وصحة التحويلات"
                  : "1. Overall Performance & Verification Health"}
              </h4>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-primary)]">
                {activeAiSection.overallPerformance}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] p-4">
              <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--accent-gold-ink)]">
                {aiReportLang === "ar"
                  ? "2. أفضل الموديلات والمقاسات والألوان"
                  : "2. Best-Selling Products, Sizes & Skins"}
              </h4>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-primary)]">
                {activeAiSection.bestSellersAnalysis}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] p-4">
              <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--accent-gold-ink)]">
                {aiReportLang === "ar"
                  ? "3. أولويات إعادة التوريد والمخزون"
                  : "3. Inventory Restock Priorities"}
              </h4>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-primary)]">
                {activeAiSection.restockPriorities}
              </p>
            </div>

            <div className="rounded-xl border border-[#D4AF37]/45 bg-[#D4AF37]/5 p-4">
              <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--accent-gold-ink)]">
                {aiReportLang === "ar"
                  ? "4. 3 توصيات عملية للدروب القادم"
                  : "4. Top 3 Recommendations for Next Drop"}
              </h4>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-[var(--text-primary)]">
                {activeAiSection.nextDropRecommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="font-mono font-bold text-[#D4AF37]">
                      0{i + 1}
                    </span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {aiGeneratedAt && (
              <p className="font-mono text-[10px] text-[var(--text-muted)] md:col-span-2">
                Generated at {new Date(aiGeneratedAt).toLocaleString()} · gemini-2.5-flash
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
