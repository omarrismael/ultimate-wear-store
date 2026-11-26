import React from "react";
import type { Product } from "@/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  enrichProductsWithOverrides,
  getStoreConfig,
} from "@/lib/store-config";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";

export const dynamic = "force-dynamic";

export default async function StudioVaultPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data }, storeConfig] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false }),
    getStoreConfig(supabase),
  ]);

  const products = await enrichProductsWithOverrides((data as Product[]) || []);

  return (
    <AdminDashboardClient
      initialProducts={products}
      initialSections={storeConfig.sections}
      initialSettings={storeConfig.settings}
      syncedWithDatabase={storeConfig.syncedWithDatabase}
    />
  );
}
