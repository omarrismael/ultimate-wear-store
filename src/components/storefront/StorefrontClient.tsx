"use client";

import React, { Suspense, useEffect, useState } from "react";
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
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BrandLoader } from "@/components/brand/BrandLoader";
import { useAuth } from "@/components/providers/AuthProvider";
import { FlyingHoodiesHero } from "./FlyingHoodiesHero";
import { ShopSection } from "./ShopSection";
import { QuickViewModal } from "./QuickViewModal";
import { AboutSection } from "./AboutSection";

export function StorefrontClient({
  products,
  sections = DEFAULT_STORE_SECTIONS,
  settings = DEFAULT_STORE_SETTINGS,
}: {
  products: Product[];
  sections?: StoreSection[];
  settings?: StoreSettings;
}) {
  const { loading: authLoading } = useAuth();
  const [quickViewState, setQuickViewState] = useState<{
    product: Product;
    colorIndex: number;
  } | null>(null);
  const [activeCategory, setActiveCategory] = useState<
    "all" | ProductCategory
  >("all");
  const [introActive, setIntroActive] = useState(true);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setIntroActive(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setIntroActive(false);
    }, 420);
    return () => window.clearTimeout(timer);
  }, []);

  const featuredProducts = products.filter((p) => p.is_featured);
  const heroProducts =
    featuredProducts.length >= 2 ? featuredProducts : products.slice(0, 4);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-page)] transition-colors duration-300">
      <BrandLoader
        overlay
        visible={introActive || authLoading}
        label="ULTIMATE // ZERO GRAVITY"
      />
      <Navbar />
      <main className="flex-1">
        <FlyingHoodiesHero
          featuredProducts={heroProducts}
          sections={sections}
          settings={settings}
          onQuickView={(product) =>
            setQuickViewState({ product, colorIndex: 0 })
          }
          onSelectCategory={(cat) => setActiveCategory(cat)}
        />
        <Suspense fallback={<BrandLoader label="ULTIMATE // COLLECTION" />}>
          <ShopSection
            products={products}
            sections={sections}
            settings={settings}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            onQuickView={(product, colorIndex = 0) =>
              setQuickViewState({ product, colorIndex })
            }
          />
        </Suspense>
        <AboutSection />
      </main>
      <Footer />
      <QuickViewModal
        product={quickViewState?.product ?? null}
        initialColorIndex={quickViewState?.colorIndex ?? 0}
        sections={sections}
        onClose={() => setQuickViewState(null)}
      />
    </div>
  );
}
