import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { FALLBACK_PRODUCTS } from "@/lib/constants";
import { enrichProductsWithOverrides } from "@/lib/store-config";
import type { Product } from "@/types";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
      return NextResponse.json({
        products: await enrichProductsWithOverrides(FALLBACK_PRODUCTS),
        isFallback: true,
      });
    }

    const enriched = await enrichProductsWithOverrides(data as Product[]);
    return NextResponse.json({ products: enriched });
  } catch {
    return NextResponse.json({
      products: await enrichProductsWithOverrides(FALLBACK_PRODUCTS),
      isFallback: true,
    });
  }
}
