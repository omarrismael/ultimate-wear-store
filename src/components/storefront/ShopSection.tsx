"use client";

import React, { useMemo, useState } from "react";
import { LayoutGrid, Rows3 } from "lucide-react";
import type {
  Product,
  ProductCategory,
  StoreSection,
  StoreSettings,
} from "@/types";
import {
  DEFAULT_STORE_SECTIONS,
  DEFAULT_STORE_SETTINGS,
} from "@/lib/constants";
import { useI18n } from "@/lib/i18n/context";
import { ProductCard } from "./ProductCard";

interface ShopSectionProps {
  products: Product[];
  sections?: StoreSection[];
  settings?: StoreSettings;
  activeCategory?: "all" | ProductCategory;
  onCategoryChange?: (cat: "all" | ProductCategory) => void;
  onQuickView: (product: Product, colorIndex?: number) => void;
}

export function ShopSection({
  products,
  sections = DEFAULT_STORE_SECTIONS,
  settings = DEFAULT_STORE_SETTINGS,
  activeCategory: controlledCategory,
  onCategoryChange,
  onQuickView,
}: ShopSectionProps) {
  const { locale, t } = useI18n();
  const [internalCategory, setInternalCategory] = useState<
    "all" | ProductCategory
  >("all");
  const [hoveredProductId, setHoveredProductId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "single">("grid");

  const activeCategory = controlledCategory ?? internalCategory;
  const setActiveCategory = onCategoryChange ?? setInternalCategory;

  const activeSections = useMemo(() => {
    const seen = new Set<string>(["all"]);
    return sections.filter((s) => {
      if (!s.is_active || seen.has(s.slug)) return false;
      seen.add(s.slug);
      return true;
    });
  }, [sections]);

  const sectionLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const sec of sections) {
      map.set(sec.slug, locale === "ar" ? sec.label_ar : sec.label_en);
    }
    return map;
  }, [sections, locale]);

  const filtered = useMemo(() => {
    if (activeCategory === "all") return products;
    return products.filter((p) => p.category === activeCategory);
  }, [products, activeCategory]);

  const eyebrow =
    locale === "ar" ? settings.shop_eyebrow_ar : settings.shop_eyebrow_en;
  const title =
    locale === "ar" ? settings.shop_title_ar : settings.shop_title_en;
  const subtitle =
    locale === "ar" ? settings.shop_subtitle_ar : settings.shop_subtitle_en;

  return (
    <section
      id="shop"
      className="border-b border-[var(--border-subtle)] bg-[var(--bg-page)] py-10 transition-colors duration-300 sm:py-14 md:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-[1440px] px-3 min-[400px]:px-4 sm:px-6 md:px-8 lg:px-10">
        <div className="flex flex-col justify-between gap-4 sm:gap-6 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--accent-gold-ink)] sm:text-[11px]">
              {eyebrow}
            </p>
            <h2 className="font-display mt-1.5 text-2xl font-extrabold uppercase text-[var(--text-primary)] min-[400px]:text-3xl sm:mt-2 md:text-5xl">
              {title}
            </h2>
            <p className="font-editorial mt-1.5 max-w-xl text-sm italic text-[var(--text-secondary)] sm:mt-2 sm:text-base">
              {subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5 sm:justify-end">
            {/* Soft Rounded Category Filters */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-wider transition-all duration-200 active:scale-95 sm:px-4 sm:py-1.5 sm:text-[11px] ${
                  activeCategory === "all"
                    ? "border-[#D4AF37] bg-[#D4AF37] text-[#09090B] shadow-sm"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[#D4AF37] hover:text-[var(--text-primary)]"
                }`}
              >
                {t.shop.allCategories}
              </button>

              {activeSections.map((sec) => {
                const label = locale === "ar" ? sec.label_ar : sec.label_en;
                return (
                  <button
                    key={sec.slug}
                    type="button"
                    onClick={() => setActiveCategory(sec.slug)}
                    className={`rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-wider transition-all duration-200 active:scale-95 sm:px-4 sm:py-1.5 sm:text-[11px] ${
                      activeCategory === sec.slug
                        ? "border-[#D4AF37] bg-[#D4AF37] text-[#09090B] shadow-sm"
                        : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[#D4AF37] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Snappy Grid <-> Single-Column Layout Toggle */}
            <div
              role="group"
              aria-label="Product layout view"
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1"
            >
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label={t.shop.gridView}
                title={t.shop.gridView}
                aria-pressed={viewMode === "grid"}
                className={`inline-flex items-center justify-center rounded-full p-1.5 transition-all duration-200 active:scale-90 ${
                  viewMode === "grid"
                    ? "bg-[#D4AF37] text-[#09090B] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("single")}
                aria-label={t.shop.singleView}
                title={t.shop.singleView}
                aria-pressed={viewMode === "single"}
                className={`inline-flex items-center justify-center rounded-full p-1.5 transition-all duration-200 active:scale-90 ${
                  viewMode === "single"
                    ? "bg-[#D4AF37] text-[#09090B] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Rows3 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-[var(--border-subtle)] py-14 text-center text-sm text-[var(--text-muted)] sm:mt-12 sm:py-16">
            {t.shop.empty}
          </div>
        ) : (
          <div
            onMouseLeave={() => setHoveredProductId(null)}
            className={
              viewMode === "single"
                ? "mx-auto mt-7 grid max-w-3xl grid-cols-1 gap-4 sm:mt-10 sm:gap-5"
                : "mt-7 grid grid-cols-2 gap-2.5 min-[400px]:gap-3.5 sm:mt-10 sm:gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:gap-7 2xl:grid-cols-4"
            }
          >
            {filtered.map((product, index) => (
              <div
                key={`${viewMode}-${product.id}`}
                className="animate-layout-pop h-full"
                style={{ animationDelay: `${Math.min(index, 6) * 35}ms` }}
              >
                <ProductCard
                  product={product}
                  categoryLabel={
                    sectionLabelMap.get(product.category) ||
                    (t.shop.categories as Record<string, string>)[
                      product.category
                    ] ||
                    product.category
                  }
                  viewMode={viewMode}
                  onQuickView={onQuickView}
                  isHovered={hoveredProductId === product.id}
                  isDimmed={
                    hoveredProductId !== null && hoveredProductId !== product.id
                  }
                  onHoverChange={(hovering) =>
                    setHoveredProductId(hovering ? product.id : null)
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
