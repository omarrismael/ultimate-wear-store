import React, { Suspense } from "react";
import type { Product } from "@/types";
import { FALLBACK_PRODUCTS } from "@/lib/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  enrichProductsWithOverrides,
  getStoreConfig,
} from "@/lib/store-config";
import { StorefrontClient } from "@/components/storefront/StorefrontClient";
import { BrandLoader } from "@/components/brand/BrandLoader";

export const dynamic = "force-dynamic";

async function getStoreData() {
  const supabase = await createServerSupabaseClient();
  let rawProducts: Product[] = FALLBACK_PRODUCTS;

  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      rawProducts = data as Product[];
    }
  } catch {
    rawProducts = FALLBACK_PRODUCTS;
  }

  const [products, storeConfig] = await Promise.all([
    enrichProductsWithOverrides(rawProducts),
    getStoreConfig(supabase),
  ]);

  return {
    products,
    sections: storeConfig.sections,
    settings: storeConfig.settings,
  };
}

async function StorefrontShell() {
  const { products, sections, settings } = await getStoreData();
  return (
    <StorefrontClient
      products={products}
      sections={sections}
      settings={settings}
    />
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<BrandLoader fullScreen label="ULTIMATE // LOADING" />}>
      <StorefrontShell />
    </Suspense>
  );
}
