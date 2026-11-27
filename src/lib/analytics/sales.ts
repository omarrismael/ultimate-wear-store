import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderStatus } from "@/types";

export type AnalyticsRange = "7d" | "30d" | "all";

export interface ProductPerformanceMetric {
  key: string;
  productId: string | null;
  titleEn: string;
  titleAr: string;
  unitsSold: number;
  revenueEgp: number;
  ordersCount: number;
}

export interface VariantMetric {
  label: string;
  unitsSold: number;
  revenueEgp: number;
  sharePct: number;
}

export interface CityMetric {
  city: string;
  ordersCount: number;
  revenueEgp: number;
  sharePct: number;
}

export interface AdminSalesAnalytics {
  range: AnalyticsRange;
  generatedAt: string;
  summary: {
    totalOrders: number;
    activeOrders: number;
    verifiedOrders: number;
    pendingOrders: number;
    cancelledOrders: number;
    verifiedRevenueEgp: number;
    pendingRevenueEgp: number;
    averageOrderValueEgp: number;
    verificationRatePct: number;
    totalUnitsSold: number;
  };
  statusCounts: Record<OrderStatus, number>;
  topProducts: ProductPerformanceMetric[];
  sizeBreakdown: VariantMetric[];
  colorBreakdown: VariantMetric[];
  topCities: CityMetric[];
}

export interface AiInsightsLocaleSection {
  overallPerformance: string;
  bestSellersAnalysis: string;
  restockPriorities: string;
  nextDropRecommendations: string[];
}

export interface AiSalesInsightsReport {
  en: AiInsightsLocaleSection;
  ar: AiInsightsLocaleSection;
}

interface RawOrderRow {
  id: string;
  total_amount: number;
  status: OrderStatus;
  city: string;
  created_at: string;
}

interface RawOrderItemRow {
  order_id: string;
  product_id: string | null;
  product_title_en: string;
  product_title_ar: string;
  size: string;
  color_name: string | null;
  quantity: number;
  unit_price: number;
}

const VERIFIED_STATUSES = new Set<OrderStatus>([
  "confirmed",
  "shipped",
  "delivered",
]);

const SIZE_ORDER = ["S", "M", "L", "XL"];

export function parseAnalyticsRange(raw: string | null | undefined): AnalyticsRange {
  if (raw === "7d" || raw === "30d" || raw === "all") return raw;
  return "30d";
}

function getCutoffIso(range: AnalyticsRange): string | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function computeAdminSalesAnalytics(
  supabase: SupabaseClient,
  range: AnalyticsRange
): Promise<AdminSalesAnalytics> {
  // Explicitly select only non-PII operational columns
  let ordersQuery = supabase
    .from("orders")
    .select("id, total_amount, status, city, created_at")
    .order("created_at", { ascending: false });

  const cutoff = getCutoffIso(range);
  if (cutoff) {
    ordersQuery = ordersQuery.gte("created_at", cutoff);
  }

  const { data: ordersData, error: ordersErr } = await ordersQuery;
  if (ordersErr) {
    throw new Error(`Failed to load orders analytics: ${ordersErr.message}`);
  }

  const orders = (ordersData || []) as RawOrderRow[];
  const orderIds = orders.map((o) => o.id);

  let items: RawOrderItemRow[] = [];
  if (orderIds.length > 0) {
    const chunkSize = 200;
    for (let i = 0; i < orderIds.length; i += chunkSize) {
      const slice = orderIds.slice(i, i + chunkSize);
      const { data: itemRows, error: itemErr } = await supabase
        .from("order_items")
        .select(
          "order_id, product_id, product_title_en, product_title_ar, size, color_name, quantity, unit_price"
        )
        .in("order_id", slice);

      if (itemErr) {
        throw new Error(`Failed to load order items analytics: ${itemErr.message}`);
      }
      if (itemRows) {
        items = items.concat(itemRows as RawOrderItemRow[]);
      }
    }
  }

  const statusCounts: Record<OrderStatus, number> = {
    pending_verification: 0,
    confirmed: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };

  let verifiedOrders = 0;
  let pendingOrders = 0;
  let cancelledOrders = 0;
  let verifiedRevenueEgp = 0;
  let pendingRevenueEgp = 0;

  const nonCancelledOrderIds = new Set<string>();
  const cityBuckets = new Map<
    string,
    { city: string; ordersCount: number; revenueEgp: number }
  >();

  for (const order of orders) {
    if (order.status in statusCounts) {
      statusCounts[order.status] += 1;
    }

    const amount = Number(order.total_amount) || 0;
    if (order.status === "cancelled") {
      cancelledOrders += 1;
      continue;
    }

    nonCancelledOrderIds.add(order.id);

    if (VERIFIED_STATUSES.has(order.status)) {
      verifiedOrders += 1;
      verifiedRevenueEgp += amount;
    } else if (order.status === "pending_verification") {
      pendingOrders += 1;
      pendingRevenueEgp += amount;
    }

    const cleanCity = (order.city || "Unspecified").trim() || "Unspecified";
    const cityKey = cleanCity.toLowerCase();
    const existingCity = cityBuckets.get(cityKey);
    if (existingCity) {
      existingCity.ordersCount += 1;
      existingCity.revenueEgp += amount;
    } else {
      cityBuckets.set(cityKey, {
        city: cleanCity,
        ordersCount: 1,
        revenueEgp: amount,
      });
    }
  }

  const productBuckets = new Map<
    string,
    {
      productId: string | null;
      titleEn: string;
      titleAr: string;
      unitsSold: number;
      revenueEgp: number;
      orderSet: Set<string>;
    }
  >();
  const sizeBuckets = new Map<string, { unitsSold: number; revenueEgp: number }>();
  const colorBuckets = new Map<string, { unitsSold: number; revenueEgp: number }>();

  let totalUnitsSold = 0;

  for (const item of items) {
    if (!nonCancelledOrderIds.has(item.order_id)) continue;

    const qty = Number(item.quantity) || 0;
    const lineRevenue = (Number(item.unit_price) || 0) * qty;
    totalUnitsSold += qty;

    const prodKey = item.product_id || item.product_title_en.toLowerCase();
    const existingProd = productBuckets.get(prodKey);
    if (existingProd) {
      existingProd.unitsSold += qty;
      existingProd.revenueEgp += lineRevenue;
      existingProd.orderSet.add(item.order_id);
    } else {
      productBuckets.set(prodKey, {
        productId: item.product_id,
        titleEn: item.product_title_en,
        titleAr: item.product_title_ar,
        unitsSold: qty,
        revenueEgp: lineRevenue,
        orderSet: new Set([item.order_id]),
      });
    }

    const sizeKey = (item.size || "Unknown").toUpperCase();
    const existingSize = sizeBuckets.get(sizeKey) || { unitsSold: 0, revenueEgp: 0 };
    existingSize.unitsSold += qty;
    existingSize.revenueEgp += lineRevenue;
    sizeBuckets.set(sizeKey, existingSize);

    const colorKey = (item.color_name || "").trim() || "Default Edition";
    const existingColor = colorBuckets.get(colorKey) || {
      unitsSold: 0,
      revenueEgp: 0,
    };
    existingColor.unitsSold += qty;
    existingColor.revenueEgp += lineRevenue;
    colorBuckets.set(colorKey, existingColor);
  }

  const topProducts: ProductPerformanceMetric[] = Array.from(
    productBuckets.entries()
  )
    .map(([key, bucket]) => ({
      key,
      productId: bucket.productId,
      titleEn: bucket.titleEn,
      titleAr: bucket.titleAr,
      unitsSold: bucket.unitsSold,
      revenueEgp: bucket.revenueEgp,
      ordersCount: bucket.orderSet.size,
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenueEgp - a.revenueEgp);

  const sizeBreakdown: VariantMetric[] = Array.from(sizeBuckets.entries())
    .map(([label, stats]) => ({
      label,
      unitsSold: stats.unitsSold,
      revenueEgp: stats.revenueEgp,
      sharePct:
        totalUnitsSold > 0
          ? Math.round((stats.unitsSold / totalUnitsSold) * 100)
          : 0,
    }))
    .sort((a, b) => {
      const idxA = SIZE_ORDER.indexOf(a.label);
      const idxB = SIZE_ORDER.indexOf(b.label);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return b.unitsSold - a.unitsSold;
    });

  const colorBreakdown: VariantMetric[] = Array.from(colorBuckets.entries())
    .map(([label, stats]) => ({
      label,
      unitsSold: stats.unitsSold,
      revenueEgp: stats.revenueEgp,
      sharePct:
        totalUnitsSold > 0
          ? Math.round((stats.unitsSold / totalUnitsSold) * 100)
          : 0,
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenueEgp - a.revenueEgp);

  const activeOrders = orders.length - cancelledOrders;
  const topCities: CityMetric[] = Array.from(cityBuckets.values())
    .map((c) => ({
      ...c,
      sharePct:
        activeOrders > 0 ? Math.round((c.ordersCount / activeOrders) * 100) : 0,
    }))
    .sort((a, b) => b.ordersCount - a.ordersCount || b.revenueEgp - a.revenueEgp)
    .slice(0, 10);

  const averageOrderValueEgp =
    verifiedOrders > 0 ? Math.round(verifiedRevenueEgp / verifiedOrders) : 0;
  const verificationRatePct =
    activeOrders > 0 ? Math.round((verifiedOrders / activeOrders) * 100) : 0;

  return {
    range,
    generatedAt: new Date().toISOString(),
    summary: {
      totalOrders: orders.length,
      activeOrders,
      verifiedOrders,
      pendingOrders,
      cancelledOrders,
      verifiedRevenueEgp,
      pendingRevenueEgp,
      averageOrderValueEgp,
      verificationRatePct,
      totalUnitsSold,
    },
    statusCounts,
    topProducts,
    sizeBreakdown,
    colorBreakdown,
    topCities,
  };
}

/**
 * Strips any identifiers and constructs a purely aggregated statistical snapshot
 * safe to send to external AI models (zero customer PII).
 */
export function buildAnonymizedPromptPayload(analytics: AdminSalesAnalytics) {
  return {
    timeframe: analytics.range,
    summary: analytics.summary,
    statusCounts: analytics.statusCounts,
    topProducts: analytics.topProducts.slice(0, 10).map((p) => ({
      titleEn: p.titleEn,
      unitsSold: p.unitsSold,
      revenueEgp: p.revenueEgp,
      ordersCount: p.ordersCount,
    })),
    sizeBreakdown: analytics.sizeBreakdown,
    colorBreakdown: analytics.colorBreakdown.slice(0, 12),
    topCities: analytics.topCities,
  };
}
