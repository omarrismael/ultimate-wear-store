"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RotateCw, ShoppingBag, X } from "lucide-react";
import type {
  Product,
  ProductColorVariant,
  ProductSize,
  StoreSection,
} from "@/types";
import { useI18n } from "@/lib/i18n/context";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useCart } from "@/components/providers/CartProvider";
import { useLenis } from "@/components/providers/LenisProvider";
import { CircularCarousel } from "@/components/react-bits/CircularCarousel";
import { getProductCarouselItems } from "@/lib/product-angles";

interface QuickViewModalProps {
  product: Product | null;
  initialColorIndex?: number;
  sections?: StoreSection[];
  onClose: () => void;
}

export function QuickViewModal({
  product,
  initialColorIndex = 0,
  sections = [],
  onClose,
}: QuickViewModalProps) {
  const { locale, t } = useI18n();
  const { theme } = useTheme();
  const { addToCart } = useCart();
  const { stopScroll, startScroll } = useLenis();
  const [size, setSize] = useState<ProductSize>("L");
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [activeAngle, setActiveAngle] = useState(0);
  const [carouselDims, setCarouselDims] = useState({ cardWidth: 220, gap: 25 });

  useEffect(() => {
    const syncDims = () => {
      const w = window.innerWidth;
      if (w < 380) {
        setCarouselDims({ cardWidth: 150, gap: 16 });
      } else if (w < 640) {
        setCarouselDims({ cardWidth: 175, gap: 20 });
      } else if (w < 1024) {
        setCarouselDims({ cardWidth: 205, gap: 24 });
      } else {
        setCarouselDims({ cardWidth: 220, gap: 25 });
      }
    };
    syncDims();
    window.addEventListener("resize", syncDims);
    return () => window.removeEventListener("resize", syncDims);
  }, []);

  useEffect(() => {
    if (product) {
      stopScroll();
      setActiveAngle(0);
      setSelectedColorIdx(initialColorIndex);
      const valid =
        product.sizes.length > 0 ? product.sizes : (["M"] as ProductSize[]);
      setSize(valid.includes("L") ? "L" : valid[0]);
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    } else {
      startScroll();
    }
  }, [product, initialColorIndex, stopScroll, startScroll, onClose]);

  const colorVariants: ProductColorVariant[] = useMemo(() => {
    if (!product || !Array.isArray(product.colors)) return [];
    return product.colors;
  }, [product]);

  const selectedColor =
    colorVariants.length > 0
      ? colorVariants[selectedColorIdx] || colorVariants[0]
      : null;

  const carouselItems = useMemo(() => {
    if (!product) return [];
    return getProductCarouselItems(product, locale, selectedColor);
  }, [product, locale, selectedColor]);

  if (!product) return null;

  const title = locale === "ar" ? product.title_ar : product.title_en;
  const description =
    locale === "ar" ? product.description_ar : product.description_en;
  const fadeColor = theme === "dark" ? "#18181D" : "#FFFFFF";
  const matchedSection = sections.find((s) => s.slug === product.category);
  const categoryLabel = matchedSection
    ? locale === "ar"
      ? matchedSection.label_ar
      : matchedSection.label_en
    : (t.shop.categories as Record<string, string>)[product.category] ||
      product.category;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2.5 backdrop-blur-md sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        data-lenis-prevent
        onClick={(e) => e.stopPropagation()}
        className="relative grid max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-[#D4AF37]/45 bg-[var(--bg-surface)] shadow-2xl lg:grid-cols-12"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t.quickView.close}
          className="absolute end-3 top-3 z-30 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-primary)] transition-colors hover:border-[#D4AF37] hover:text-[#D4AF37] sm:end-4 sm:top-4 sm:p-2"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Left: Smooth 3D Cylinder CircularCarousel (Front / Side / Back / Detail) */}
        <div className="relative flex flex-col justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] lg:col-span-7 lg:border-b-0 lg:border-e">
          <div className="flex items-center justify-between gap-2 px-4 pe-12 pt-3.5 text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)] sm:px-5 sm:pe-14 sm:pt-4 sm:text-[10px] sm:tracking-[0.2em]">
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[var(--accent-gold-ink)]">
              <RotateCw className="h-3 w-3" />
              {carouselItems[activeAngle]?.title || "360°"}
            </span>
            <span className="truncate">{t.quickView.dragHint}</span>
          </div>

          <div className="relative h-[285px] w-full min-[400px]:h-[330px] sm:h-[410px] md:h-[450px] lg:h-[520px]">
            <CircularCarousel
              items={carouselItems}
              preset="cylinder"
              intro="rise"
              cardWidth={carouselDims.cardWidth}
              aspectRatio={1}
              speed={14}
              captions={false}
              gap={carouselDims.gap}
              tilt={-5}
              curve={1}
              perspective={2500}
              autoplay="drift"
              interval={3}
              direction="left"
              momentum={0.6}
              snap
              pauseOnHover
              focusOnClick
              draggable
              parallax={0.3}
              stretch={0.5}
              fadeColor={fadeColor}
              depthFade={0.55}
              innerShade={0.6}
              cornerRadius={12}
              onActiveChange={setActiveAngle}
            />
          </div>
        </div>

        {/* Right: Clean Product Details, Color Skin & Size Purchase */}
        <div className="flex flex-col justify-between p-4 sm:p-6 md:p-8 lg:col-span-5">
          <div>
            <span className="font-mono inline-block rounded-full border border-[#D4AF37]/45 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-gold-ink)]">
              {categoryLabel}
            </span>

            <h2 className="font-display mt-3 text-2xl font-medium tracking-tight text-[var(--text-primary)]">
              {title}
            </h2>

            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-mono text-xl font-semibold text-[var(--accent-gold-ink)]">
                {product.price_egp} {t.shop.egp}
              </span>
              {product.compare_at_price_egp &&
                product.compare_at_price_egp > product.price_egp && (
                  <span className="font-mono text-sm text-[var(--text-muted)] line-through">
                    {product.compare_at_price_egp} {t.shop.egp}
                  </span>
                )}
            </div>

            <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
              {description}
            </p>

            <p className="font-editorial mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm italic text-[var(--text-secondary)]">
              {t.quickView.fabricNote}
            </p>
            <p className="mt-2.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
              <strong className="text-[var(--accent-gold-ink)]">
                {t.policy.title}:
              </strong>{" "}
              {t.policy.body} {t.policy.shippingNote}
            </p>
          </div>

          <div className="mt-6 space-y-4">
            {colorVariants.length > 0 && (
              <div>
                <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <span>{locale === "ar" ? "اللون / السكن" : "Colorway"}</span>
                  {selectedColor && (
                    <span className="text-[var(--text-primary)]">
                      {locale === "ar"
                        ? selectedColor.name_ar
                        : selectedColor.name_en}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {colorVariants.map((variant, idx) => {
                    const active = idx === selectedColorIdx;
                    const cName =
                      locale === "ar" ? variant.name_ar : variant.name_en;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setSelectedColorIdx(idx)}
                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                          active
                            ? "border-[#D4AF37] bg-[#D4AF37]/12 text-[var(--text-primary)]"
                            : "border-[var(--border-subtle)] bg-[var(--bg-page)] text-[var(--text-secondary)] hover:border-[#D4AF37]/60"
                        }`}
                      >
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-white/40"
                          style={{ backgroundColor: variant.hex }}
                        />
                        <span>{cName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {t.quickView.selectSize}
              </p>
              <div className="flex gap-2">
                {product.sizes.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setSize(sz)}
                    className={`h-10 flex-1 rounded-xl border text-xs font-semibold transition-colors ${
                      size === sz
                        ? "border-[#D4AF37] bg-[#D4AF37] text-[#09090B]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-page)] text-[var(--text-primary)] hover:border-[#D4AF37]"
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={!product.in_stock}
              onClick={() => {
                addToCart(product, size, 1, selectedColor);
                onClose();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4AF37] py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#09090B] transition-opacity hover:opacity-95 disabled:opacity-40"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>
                {product.in_stock ? t.quickView.addToBag : t.shop.outOfStock}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
