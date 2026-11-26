"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUpRight, Play } from "lucide-react";
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
import { useLenis } from "@/components/providers/LenisProvider";

interface FlyingHoodiesHeroProps {
  featuredProducts: Product[];
  sections?: StoreSection[];
  settings?: StoreSettings;
  onQuickView?: (product: Product) => void;
  onSelectCategory?: (category: "all" | ProductCategory) => void;
}

const ORBIT_LAYOUTS = [
  {
    stageClass:
      "left-[1%] top-[2%] w-[104px] min-[390px]:w-[116px] sm:left-[3%] sm:top-[3%] sm:w-[144px] md:left-[6%] md:w-[162px] lg:left-[2%] lg:top-[3%] lg:w-[138px] xl:left-[5%] xl:top-[5%] xl:w-[162px] 2xl:left-[12%] 2xl:top-[6%] 2xl:w-[192px]",
    baseTilt: -4,
    pxFactor: 22,
    pyFactor: 18,
    scrollSpeed: -0.09,
    floatClass: "animate-orbit-a",
  },
  {
    stageClass:
      "right-[1%] top-[2%] w-[104px] min-[390px]:w-[116px] sm:right-[3%] sm:top-[3%] sm:w-[144px] md:right-[6%] md:w-[162px] lg:right-[20%] lg:top-[3%] lg:w-[136px] xl:right-[19%] xl:top-[5%] xl:w-[160px] 2xl:right-[17%] 2xl:top-[6%] 2xl:w-[190px]",
    baseTilt: 4,
    pxFactor: -24,
    pyFactor: 16,
    scrollSpeed: 0.08,
    floatClass: "animate-orbit-b",
  },
  {
    stageClass:
      "bottom-[2%] left-[2%] w-[104px] min-[390px]:w-[114px] sm:bottom-[3%] sm:left-[4%] sm:w-[142px] md:left-[7%] md:w-[160px] lg:bottom-[3%] lg:left-[4%] lg:w-[136px] xl:bottom-[5%] xl:left-[7%] xl:w-[160px] 2xl:left-[14%] 2xl:bottom-[6%] 2xl:w-[188px]",
    baseTilt: 3.5,
    pxFactor: 20,
    pyFactor: -20,
    scrollSpeed: 0.1,
    floatClass: "animate-orbit-b",
  },
  {
    stageClass:
      "bottom-[2%] right-[2%] w-[104px] min-[390px]:w-[114px] sm:bottom-[3%] sm:right-[4%] sm:w-[142px] md:right-[7%] md:w-[160px] lg:bottom-[3%] lg:right-[20%] lg:w-[142px] xl:bottom-[5%] xl:right-[19%] xl:w-[166px] 2xl:right-[17%] 2xl:bottom-[6%] 2xl:w-[198px]",
    baseTilt: -3.5,
    pxFactor: -26,
    pyFactor: -18,
    scrollSpeed: -0.08,
    floatClass: "animate-orbit-a",
  },
] as const;

export function FlyingHoodiesHero({
  featuredProducts,
  sections = DEFAULT_STORE_SECTIONS,
  settings = DEFAULT_STORE_SETTINGS,
  onQuickView,
  onSelectCategory,
}: FlyingHoodiesHeroProps) {
  const { locale, t } = useI18n();
  const { scrollTo, subscribeScroll } = useLenis();

  const stageRef = useRef<HTMLElement | null>(null);
  const modelWrapRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pointerTarget = useRef({ x: 0, y: 0 });
  const pointerCurrent = useRef({ x: 0, y: 0 });
  const scrollOffset = useRef(0);

  const [hoveredCategory, setHoveredCategory] = useState<
    "all" | ProductCategory | null
  >(null);
  const [hoveredHeroId, setHoveredHeroId] = useState<string | null>(null);

  const heroHoodies = featuredProducts.slice(0, 4);

  const heroSections = useMemo(() => {
    const seen = new Set<string>(["all"]);
    return sections.filter((s) => {
      if (!s.is_active || !s.show_in_hero || seen.has(s.slug)) return false;
      seen.add(s.slug);
      return true;
    });
  }, [sections]);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reducedMotion) return;

    const mq = window.matchMedia("(min-width: 1024px)");
    let rafId = 0;
    let unsubscribe: (() => void) | null = null;

    const clearTransforms = () => {
      if (modelWrapRef.current) {
        modelWrapRef.current.style.transform = "";
      }
      cardRefs.current.forEach((el) => {
        if (el) el.style.transform = "";
      });
    };

    const tick = () => {
      if (!mq.matches) {
        clearTransforms();
        rafId = 0;
        return;
      }

      pointerCurrent.current.x +=
        (pointerTarget.current.x - pointerCurrent.current.x) * 0.08;
      pointerCurrent.current.y +=
        (pointerTarget.current.y - pointerCurrent.current.y) * 0.08;

      const nx = pointerCurrent.current.x;
      const ny = pointerCurrent.current.y;
      const sy = scrollOffset.current;

      if (modelWrapRef.current) {
        const mx = nx * 14;
        const my = ny * 12 - sy * 0.07;
        const rotY = nx * 6;
        const rotX = -ny * 5;
        modelWrapRef.current.style.transform = `perspective(1200px) translate3d(${mx.toFixed(
          2
        )}px, ${my.toFixed(2)}px, 0) rotateX(${rotX.toFixed(
          2
        )}deg) rotateY(${rotY.toFixed(2)}deg)`;
      }

      cardRefs.current.forEach((el, idx) => {
        if (!el) return;
        const cfg = ORBIT_LAYOUTS[idx % ORBIT_LAYOUTS.length];
        const dx = nx * cfg.pxFactor;
        const dy = ny * cfg.pyFactor + sy * cfg.scrollSpeed;
        const tilt = cfg.baseTilt + nx * 3;
        el.style.transform = `perspective(1000px) translate3d(${dx.toFixed(
          2
        )}px, ${dy.toFixed(2)}px, 0) rotate(${tilt.toFixed(2)}deg)`;
      });

      rafId = window.requestAnimationFrame(tick);
    };

    const syncDesktopMotion = () => {
      if (mq.matches) {
        if (!unsubscribe) {
          unsubscribe = subscribeScroll((y) => {
            scrollOffset.current = Math.min(y, 900);
          });
        }
        if (!rafId) {
          rafId = window.requestAnimationFrame(tick);
        }
      } else {
        if (rafId) {
          window.cancelAnimationFrame(rafId);
          rafId = 0;
        }
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        clearTransforms();
      }
    };

    syncDesktopMotion();
    mq.addEventListener("change", syncDesktopMotion);

    return () => {
      mq.removeEventListener("change", syncDesktopMotion);
      if (rafId) window.cancelAnimationFrame(rafId);
      if (unsubscribe) unsubscribe();
      clearTransforms();
    };
  }, [subscribeScroll]);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!stageRef.current || window.innerWidth < 1024) return;
    const rect = stageRef.current.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    pointerTarget.current = {
      x: Math.max(-1, Math.min(1, nx)),
      y: Math.max(-1, Math.min(1, ny)),
    };
  };

  const handleMouseLeave = () => {
    pointerTarget.current = { x: 0, y: 0 };
    setHoveredHeroId(null);
  };

  const handleCategoryClick = (cat: "all" | ProductCategory) => {
    onSelectCategory?.(cat);
    scrollTo("#shop", -68);
  };

  const badgeText =
    locale === "ar" ? settings.hero_badge_ar : settings.hero_badge_en;
  const headlineText =
    locale === "ar" ? settings.hero_headline_ar : settings.hero_headline_en;
  const subheadlineText =
    locale === "ar"
      ? settings.hero_subheadline_ar
      : settings.hero_subheadline_en;
  const featuredPanelTitle =
    locale === "ar"
      ? settings.featured_title_ar
      : settings.featured_title_en;

  return (
    <section
      id="showcase"
      ref={stageRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="bg-editorial-grid relative overflow-hidden border-b border-[var(--border-subtle)] transition-colors duration-300"
    >
      {/* Subtle Curved Architectural Perspective Grid Overlay */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 820"
        preserveAspectRatio="none"
        className={`pointer-events-none absolute inset-0 h-full w-full transition-all duration-300 ${
          hoveredHeroId ? "blur-[2px] opacity-65" : "blur-0 opacity-100"
        }`}
      >
        <g
          fill="none"
          stroke="var(--grid-line)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        >
          <path d="M 0 110 Q 720 155 1440 110" />
          <path d="M 0 290 Q 720 320 1440 290" />
          <path d="M 0 530 Q 720 500 1440 530" />
          <path d="M 0 710 Q 720 665 1440 710" />
          <path d="M 220 0 Q 260 410 220 820" />
          <path d="M 480 0 Q 505 410 480 820" />
          <path d="M 960 0 Q 935 410 960 820" />
          <path d="M 1220 0 Q 1180 410 1220 820" />
        </g>
      </svg>

      {/* Main Spatial Canvas */}
      <div className="relative mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-[1440px] flex-col justify-between px-3 py-2.5 min-[400px]:px-4 min-[400px]:py-3 sm:px-6 sm:py-4 md:px-8 lg:h-[calc(100dvh-3.5rem)] lg:min-h-[600px] lg:max-h-[920px] lg:px-10 lg:py-5">
        {/* Minimal Quiet Authority Statement */}
        <div
          className={`relative z-30 flex items-center justify-between gap-2 text-[9px] font-medium uppercase tracking-[0.2em] text-[var(--text-muted)] transition-all duration-300 min-[400px]:text-[10px] sm:tracking-[0.24em] ${
            hoveredHeroId ? "blur-[2px] opacity-55" : ""
          }`}
        >
          <span className="font-mono text-[9px] font-bold tracking-[0.26em] text-[var(--accent-gold-ink)] min-[400px]:text-[10px]">
            {badgeText}
          </span>
          <button
            type="button"
            onClick={() => scrollTo("#shop", -68)}
            className="font-display inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold uppercase text-[var(--text-primary)] transition-colors hover:text-[#D4AF37] sm:text-sm"
          >
            <span>{headlineText}</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-[#D4AF37]" />
          </button>
        </div>

        {/* Center Spatial Stage: Orbiting Hoodie Cards surrounding Suspended Model across Mobile, Tablet, and Laptop */}
        <div className="relative my-1.5 flex flex-1 flex-col items-center justify-center sm:my-2 lg:my-0">
          {/* Spatial Orbit Area */}
          <div className="relative flex min-h-[370px] w-full flex-1 items-center justify-center min-[390px]:min-h-[405px] sm:min-h-[470px] md:min-h-[520px] lg:min-h-0">
            {/* CENTER ZERO-GRAVITY MODEL */}
            <div
              className={`relative z-20 flex items-center justify-center transition-all duration-300 ${
                hoveredHeroId
                  ? "scale-[0.97] blur-[3.5px] opacity-60"
                  : "scale-100 blur-0 opacity-100"
              }`}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute h-40 w-40 rounded-full blur-3xl sm:h-64 sm:w-64 lg:h-80 lg:w-80 xl:h-96 xl:w-96"
                style={{
                  background:
                    "radial-gradient(circle, rgba(212,175,55,0.2) 0%, transparent 70%)",
                }}
              />

              <div ref={modelWrapRef} className="will-change-transform">
                <div className="animate-zero-gravity relative aspect-[5/8] h-[clamp(195px,36dvh,255px)] min-[390px]:h-[clamp(215px,38dvh,280px)] sm:h-[clamp(260px,42dvh,340px)] md:h-[clamp(290px,46dvh,380px)] lg:h-[clamp(300px,56dvh,450px)] xl:h-[clamp(340px,60dvh,500px)]">
                  <Image
                    src="/images/hero/zero-gravity-model.png"
                    alt="ULTIMATE"
                    fill
                    priority
                    sizes="(max-width: 640px) 180px, (max-width: 1024px) 250px, 325px"
                    className="object-contain object-center drop-shadow-[0_28px_36px_rgba(0,0,0,0.28)]"
                  />
                </div>
              </div>
            </div>

            {/* 4 ORBITING FLYING HOODIE CARDS (Floating at 4 corners around model on BOTH Mobile & Laptop) */}
            {heroHoodies.map((product, index) => {
              const title =
                locale === "ar" ? product.title_ar : product.title_en;
              const layout = ORBIT_LAYOUTS[index % ORBIT_LAYOUTS.length];
              const isSelfHovered = hoveredHeroId === product.id;
              const isOtherHovered =
                hoveredHeroId !== null && hoveredHeroId !== product.id;
              const matchesCategory =
                hoveredCategory === null ||
                hoveredCategory === "all" ||
                hoveredCategory === product.category;

              return (
                <button
                  key={product.id}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  type="button"
                  onMouseEnter={() => setHoveredHeroId(product.id)}
                  onMouseLeave={() => setHoveredHeroId(null)}
                  onClick={() =>
                    onQuickView ? onQuickView(product) : scrollTo("#shop", -68)
                  }
                  className={`group pointer-events-auto absolute text-start transition-all duration-300 ease-out will-change-transform ${
                    layout.stageClass
                  } ${
                    isSelfHovered
                      ? "z-40 opacity-100"
                      : isOtherHovered
                        ? "z-20 lg:blur-[3px] lg:opacity-55"
                        : matchesCategory
                          ? "z-30 opacity-100"
                          : "z-20 opacity-35"
                  }`}
                >
                  <div
                    className={`${layout.floatClass} overflow-hidden rounded-xl border bg-[var(--bg-surface)]/95 p-1 shadow-[0_12px_26px_rgba(0,0,0,0.22)] backdrop-blur-sm transition-all duration-300 ease-out min-[400px]:rounded-2xl min-[400px]:p-1.5 sm:p-2 lg:shadow-[0_18px_40px_rgba(0,0,0,0.18)] ${
                      isSelfHovered
                        ? "border-[#D4AF37] md:scale-105 lg:scale-110 lg:shadow-[0_28px_60px_rgba(212,175,55,0.25)]"
                        : hoveredCategory && hoveredCategory === product.category
                          ? "border-[#D4AF37] ring-1 ring-[#D4AF37]"
                          : "border-[var(--border-strong)]"
                    }`}
                  >
                    <div className="relative aspect-[4/4.2] w-full overflow-hidden rounded-lg bg-[#18181D] min-[400px]:rounded-xl lg:aspect-square">
                      <Image
                        src={product.image_url}
                        alt={title}
                        fill
                        priority={index < 2}
                        sizes="(max-width: 640px) 120px, (max-width: 1024px) 165px, 200px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <span className="absolute start-1 top-1 rounded-full bg-[#111114]/85 px-1.5 py-0.5 font-mono text-[7px] font-medium tracking-widest text-[#D4AF37] min-[400px]:text-[8px] sm:start-2 sm:top-2 sm:px-2.5 sm:text-[9px]">
                        0{index + 1}
                      </span>
                      {product.colors && product.colors.length > 0 && (
                        <div className="absolute bottom-1 end-1 flex items-center -space-x-1 rounded-full bg-[#111114]/80 px-1 py-0.5 backdrop-blur-sm">
                          {product.colors.slice(0, 3).map((c) => (
                            <span
                              key={c.id}
                              className="h-2 w-2 rounded-full border border-white/60 sm:h-2.5 sm:w-2.5"
                              style={{ backgroundColor: c.hex }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-1 flex items-baseline justify-between gap-1 px-0.5 pb-0.5 sm:mt-1.5 sm:gap-2 sm:px-1">
                      <span className="font-display truncate text-[8.5px] font-bold uppercase text-[var(--text-primary)] group-hover:text-[#D4AF37] min-[400px]:text-[9.5px] sm:text-[11px]">
                        {title}
                      </span>
                      <span className="shrink-0 font-mono text-[8.5px] font-bold text-[var(--accent-gold-ink)] min-[400px]:text-[9px] sm:text-[10px]">
                        {product.price_egp}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* RIGHT COMPACT MENU (Desktop spatial hover navigator; on mobile #shop filter bar sits right below to avoid duplicate lists) */}
          <aside
            className={`hidden lg:block lg:absolute lg:end-0 lg:top-1/2 lg:z-30 lg:mt-0 lg:w-44 lg:-translate-y-1/2 lg:rounded-2xl lg:border lg:border-[var(--border-subtle)] lg:bg-[var(--bg-glass)] lg:p-3.5 lg:backdrop-blur-md lg:transition-all lg:duration-300 ${
              hoveredHeroId ? "lg:blur-[2.5px] lg:opacity-55" : ""
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--text-primary)]">
              <Play className="h-2.5 w-2.5 fill-[#D4AF37] text-[#D4AF37]" />
              <span className="font-display">{featuredPanelTitle}</span>
            </div>

            <ul className="mt-3 space-y-1 text-[11px] font-medium uppercase tracking-[0.16em]">
              <li>
                <button
                  type="button"
                  onMouseEnter={() => setHoveredCategory("all")}
                  onMouseLeave={() => setHoveredCategory(null)}
                  onClick={() => handleCategoryClick("all")}
                  className="w-full rounded-lg px-2 py-1 text-start text-[var(--text-secondary)] transition-all duration-200 hover:bg-[var(--bg-elevated)] hover:text-[#D4AF37]"
                >
                  {t.shop.allCategories}
                </button>
              </li>
              {heroSections.map((sec) => {
                const label = locale === "ar" ? sec.label_ar : sec.label_en;
                return (
                  <li key={sec.slug}>
                    <button
                      type="button"
                      onMouseEnter={() => setHoveredCategory(sec.slug)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      onClick={() => handleCategoryClick(sec.slug)}
                      className={`w-full truncate rounded-lg px-2 py-1 text-start transition-all duration-200 hover:bg-[var(--bg-elevated)] ${
                        hoveredCategory === sec.slug
                          ? "bg-[var(--bg-elevated)] text-[#D4AF37]"
                          : "text-[var(--text-secondary)] hover:text-[#D4AF37]"
                      }`}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>

        {/* Bottom Spatial Corner Telemetry */}
        <div
          className={`relative z-30 mt-2 flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2.5 text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)] transition-all duration-300 min-[400px]:text-[10px] sm:mt-3 sm:pt-3 sm:tracking-[0.2em] ${
            hoveredHeroId ? "blur-[2px] opacity-55" : ""
          }`}
        >
          <span className="font-editorial truncate text-xs normal-case italic tracking-normal text-[var(--text-secondary)] sm:text-sm">
            {subheadlineText}
          </span>
          <button
            type="button"
            onClick={() => scrollTo("#shop", -68)}
            className="font-display inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--text-primary)] transition-colors hover:text-[#D4AF37] sm:px-2.5 sm:text-xs"
          >
            <span>{t.hero.zeroGravityLabel}</span>
            <ArrowDown className="h-3.5 w-3.5 text-[#D4AF37]" />
          </button>
        </div>
      </div>
    </section>
  );
}
