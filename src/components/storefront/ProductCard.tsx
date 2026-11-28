"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Eye, ShoppingBag } from "lucide-react";
import type { Product, ProductColorVariant, ProductSize } from "@/types";
import { useI18n } from "@/lib/i18n/context";
import { useCart } from "@/components/providers/CartProvider";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";

interface ProductCardProps {
  product: Product;
  categoryLabel?: string;
  viewMode?: "grid" | "single";
  onQuickView: (product: Product, colorIndex?: number) => void;
  isHovered?: boolean;
  isDimmed?: boolean;
  onHoverChange?: (hovering: boolean) => void;
}

export function ProductCard({
  product,
  categoryLabel,
  viewMode = "grid",
  onQuickView,
  isHovered = false,
  isDimmed = false,
  onHoverChange,
}: ProductCardProps) {
  const { locale, t } = useI18n();
  const { addToCart } = useCart();

  const availableSizes =
    product.sizes.length > 0 ? product.sizes : (["M"] as ProductSize[]);
  const [selectedSize, setSelectedSize] = useState<ProductSize>(
    availableSizes.includes("L") ? "L" : availableSizes[0]
  );

  const colorVariants: ProductColorVariant[] =
    Array.isArray(product.colors) && product.colors.length > 0
      ? product.colors
      : [];
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const selectedColor =
    colorVariants.length > 0
      ? colorVariants[selectedColorIndex] || colorVariants[0]
      : null;

  const activeImage =
    selectedColor?.front_image_url ||
    selectedColor?.image_url ||
    product.image_url;
  const title = locale === "ar" ? product.title_ar : product.title_en;
  const description =
    locale === "ar" ? product.description_ar : product.description_en;
  const badgeText =
    categoryLabel ||
    (t.shop.categories as Record<string, string>)[product.category] ||
    product.category;
  const isSingle = viewMode === "single";

  return (
    <div
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      className={`h-full transition-all duration-300 ease-out will-change-transform ${
        isHovered
          ? isSingle
            ? "relative z-20 md:scale-[1.012]"
            : "relative z-20 md:scale-[1.035]"
          : isDimmed
            ? "md:scale-[0.985] md:blur-[2.5px] md:opacity-60"
            : "scale-100 blur-0 opacity-100"
      }`}
    >
      <SpotlightCard
        className={`h-full rounded-2xl ${
          isSingle ? "p-3 sm:p-4" : "p-2 min-[400px]:p-2.5 sm:p-3.5 md:p-4"
        } ${
          isHovered
            ? "md:border-[#D4AF37]/80 md:shadow-[0_24px_54px_rgba(212,175,55,0.16)]"
            : ""
        }`}
      >
        <div
          className={`flex h-full flex-col ${
            isSingle ? "gap-4 sm:flex-row sm:items-stretch sm:gap-6" : ""
          }`}
        >
          {/* Image */}
          <div
            onClick={() => onQuickView(product, selectedColorIndex)}
            className={`group relative cursor-pointer overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[#18181D] ${
              isSingle
                ? "aspect-[4/5] w-full shrink-0 sm:aspect-[4/5] sm:w-56 md:w-64"
                : "aspect-[4/5] w-full sm:aspect-[5/6]"
            }`}
          >
            <Image
              src={activeImage}
              alt={title}
              fill
              sizes={
                isSingle
                  ? "(max-width: 640px) 92vw, 260px"
                  : "(max-width: 640px) 46vw, (max-width: 1024px) 46vw, (max-width: 1536px) 30vw, 23vw"
              }
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />

            <div className="absolute inset-x-1.5 top-1.5 flex items-center justify-between gap-1 sm:inset-x-3 sm:top-3">
              <span className="font-mono truncate rounded-full border border-[#FFFFFF]/20 bg-[#111114]/85 px-2 py-0.5 text-[8px] font-medium uppercase tracking-wider text-[#FFFFFF]/90 backdrop-blur-sm min-[400px]:text-[9px] sm:px-3 sm:py-1 sm:text-[10px] sm:tracking-widest">
                {badgeText}
              </span>
              {!product.in_stock && (
                <span className="shrink-0 rounded-full border border-[#D4AF37]/70 bg-[#111114]/90 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-[#D4AF37] min-[400px]:text-[9px] sm:px-3 sm:py-1 sm:text-[10px]">
                  {t.shop.outOfStock}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickView(product, selectedColorIndex);
              }}
              aria-label={t.shop.quickView}
              className="absolute bottom-1.5 end-1.5 inline-flex items-center gap-1 rounded-full border border-[#FFFFFF]/25 bg-[#111114]/85 px-2 py-1 text-[9px] font-medium text-[#FFFFFF] backdrop-blur-sm transition-all duration-200 hover:border-[#D4AF37] hover:text-[#D4AF37] active:scale-95 sm:bottom-3 sm:end-3 sm:gap-1.5 sm:px-3.5 sm:py-1.5 sm:text-[11px]"
            >
              <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className={isSingle ? "inline" : "hidden min-[370px]:inline"}>
                {t.shop.quickView}
              </span>
            </button>
          </div>

          {/* Info */}
          <div
            className={`flex flex-1 flex-col justify-between ${
              isSingle ? "mt-0" : "mt-2.5 sm:mt-4"
            }`}
          >
            <div>
              <div
                className={
                  isSingle
                    ? "flex items-start justify-between gap-3"
                    : "flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2"
                }
              >
                <h3
                  className={`font-display uppercase ${
                    isSingle
                      ? "text-base font-bold text-[var(--text-primary)] sm:text-xl"
                      : "line-clamp-1 text-xs font-bold text-[var(--text-primary)] min-[400px]:text-[13px] sm:line-clamp-2 sm:text-base"
                  }`}
                >
                  {title}
                </h3>
                <div className="flex shrink-0 items-baseline gap-1.5 sm:flex-col sm:items-end sm:gap-0 sm:text-end">
                  <p
                    className={
                      isSingle
                        ? "font-mono text-base font-bold text-[var(--accent-gold-ink)] sm:text-lg"
                        : "font-mono text-xs font-bold text-[var(--accent-gold-ink)] min-[400px]:text-[13px] sm:text-sm"
                    }
                  >
                    {product.price_egp} {t.shop.egp}
                  </p>
                  {product.compare_at_price_egp &&
                    product.compare_at_price_egp > product.price_egp && (
                      <p className="font-mono text-[10px] text-[var(--text-muted)] line-through sm:text-[11px]">
                        {product.compare_at_price_egp} {t.shop.egp}
                      </p>
                    )}
                </div>
              </div>

              {/* Color / Skin Swatches */}
              {colorVariants.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {colorVariants.map((variant, idx) => {
                    const isActive = idx === selectedColorIndex;
                    const colorLabel =
                      locale === "ar" ? variant.name_ar : variant.name_en;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setSelectedColorIndex(idx)}
                        onMouseEnter={() => setSelectedColorIndex(idx)}
                        title={colorLabel}
                        aria-label={colorLabel}
                        className={`relative h-5 w-5 rounded-full border transition-all duration-200 active:scale-90 sm:h-5.5 sm:w-5.5 ${
                          isActive
                            ? "scale-110 border-[#D4AF37] ring-2 ring-[#D4AF37]/45 ring-offset-1 ring-offset-[var(--bg-surface)]"
                            : "border-[var(--border-strong)] opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: variant.hex }}
                      />
                    );
                  })}
                  {selectedColor && (
                    <span className="ms-1 truncate text-[10px] font-medium text-[var(--text-muted)]">
                      {locale === "ar"
                        ? selectedColor.name_ar
                        : selectedColor.name_en}
                    </span>
                  )}
                </div>
              )}

              <p
                className={
                  isSingle
                    ? "mt-2 text-xs leading-relaxed text-[var(--text-secondary)] sm:mt-3 sm:text-sm"
                    : "mt-1.5 hidden line-clamp-2 text-[11px] leading-relaxed text-[var(--text-secondary)] sm:mt-2 sm:block sm:text-xs"
                }
              >
                {description}
              </p>
            </div>

            {/* Size Selector & Add to Cart */}
            <div className="mt-2.5 space-y-2 border-t border-[var(--border-subtle)] pt-2 sm:mt-4 sm:space-y-3 sm:pt-3">
              <div
                className={
                  isSingle
                    ? "flex items-center justify-between gap-3"
                    : "flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between"
                }
              >
                <span
                  className={
                    isSingle
                      ? "text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]"
                      : "hidden text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] sm:inline sm:text-[11px]"
                  }
                >
                  {t.shop.sizeLabel}
                </span>
                <div
                  className={
                    isSingle
                      ? "flex items-center gap-1.5"
                      : "grid grid-cols-4 gap-1 sm:flex sm:items-center sm:gap-1.5"
                  }
                >
                  {availableSizes.map((sz) => {
                    const active = selectedSize === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setSelectedSize(sz)}
                        className={`rounded-lg border font-semibold transition-all duration-200 active:scale-95 ${
                          isSingle
                            ? "h-8 min-w-[2.4rem] px-2.5 text-xs"
                            : "h-6 px-1 text-[10px] sm:h-7 sm:min-w-[2rem] sm:px-2 sm:text-xs"
                        } ${
                          active
                            ? "border-[#D4AF37] bg-[#D4AF37] text-[#09090B]"
                            : "border-[var(--border-subtle)] bg-[var(--bg-page)] text-[var(--text-primary)] hover:border-[#D4AF37]/70"
                        }`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                disabled={!product.in_stock}
                onClick={() =>
                  addToCart(product, selectedSize, 1, selectedColor)
                }
                className={`flex w-full items-center justify-center rounded-xl border border-[#D4AF37] bg-[var(--bg-surface)] font-semibold uppercase text-[var(--text-primary)] transition-all duration-200 hover:bg-[#D4AF37] hover:text-[#09090B] active:scale-[0.985] disabled:cursor-not-allowed disabled:border-[var(--border-subtle)] disabled:text-[var(--text-muted)] disabled:hover:bg-[var(--bg-surface)] ${
                  isSingle
                    ? "gap-2 py-3 text-xs tracking-[0.14em]"
                    : "gap-1.5 py-2 text-[10px] tracking-[0.06em] min-[400px]:text-[11px] sm:gap-2 sm:py-2.5 sm:text-xs sm:tracking-[0.14em]"
                }`}
              >
                <ShoppingBag className="h-3 w-3 text-[#D4AF37] sm:h-3.5 sm:w-3.5" />
                <span className="truncate">
                  {product.in_stock ? t.shop.addToCart : t.shop.outOfStock}
                </span>
              </button>
            </div>
          </div>
        </div>
      </SpotlightCard>
    </div>
  );
}
