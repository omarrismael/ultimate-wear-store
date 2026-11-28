import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/security/admin-auth";
import { adminProductSchema } from "@/lib/security/validation";
import {
  enrichProductsWithOverrides,
  saveProductOverrides,
} from "@/lib/store-config";
import type { Product } from "@/types";

const BASE_CATEGORIES = new Set(["heavyweight", "oversized", "zip", "essential"]);

export async function GET() {
  const { supabase, error } = await requireAdminApi();
  if (error) return error;

  const { data, error: queryErr } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (queryErr) {
    return NextResponse.json({ error: queryErr.message }, { status: 400 });
  }
  const products = await enrichProductsWithOverrides((data as Product[]) || []);
  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  const { supabase, error } = await requireAdminApi();
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = adminProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid product payload" },
        { status: 400 }
      );
    }

    const baseSlug = parsed.data.title_en
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const slug = `${baseSlug || "ultimate-hoodie"}-${Date.now().toString(36)}`;

    let { data, error: insertErr } = await supabase
      .from("products")
      .insert({
        ...parsed.data,
        slug,
      })
      .select("*")
      .single();

    // Compatibility fallback when Supabase hasn't received colors/size_stock/dynamic-category migration yet
    if (
      insertErr &&
      (insertErr.code === "PGRST204" ||
        insertErr.code === "42703" ||
        insertErr.code === "23514" ||
        insertErr.message?.includes("colors") ||
        insertErr.message?.includes("size_stock") ||
        insertErr.message?.includes("category"))
    ) {
      const { colors, size_stock, category, ...rest } = parsed.data;
      void colors;
      void size_stock;
      const safeCategory = BASE_CATEGORIES.has(category)
        ? category
        : "heavyweight";

      const retry = await supabase
        .from("products")
        .insert({
          ...rest,
          category: safeCategory,
          slug,
        })
        .select("*")
        .single();

      data = retry.data;
      insertErr = retry.error;
    }

    if (insertErr || !data) {
      return NextResponse.json(
        { error: insertErr?.message || "Failed to create product" },
        { status: 400 }
      );
    }

    const createdId = (data as Product).id;
    if (
      (parsed.data.colors && parsed.data.colors.length > 0) ||
      !BASE_CATEGORIES.has(parsed.data.category)
    ) {
      await saveProductOverrides(createdId, {
        colors: parsed.data.colors,
        category: parsed.data.category,
      });
    }

    const [enriched] = await enrichProductsWithOverrides([data as Product]);
    return NextResponse.json({ product: enriched }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
