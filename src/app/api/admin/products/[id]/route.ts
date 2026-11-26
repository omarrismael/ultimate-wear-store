import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/security/admin-auth";
import { adminProductPatchSchema, uuidSchema } from "@/lib/security/validation";
import {
  clearProductOverrides,
  enrichProductsWithOverrides,
  saveProductOverrides,
} from "@/lib/store-config";
import type { Product } from "@/types";

const BASE_CATEGORIES = new Set(["heavyweight", "oversized", "zip", "essential"]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, error } = await requireAdminApi();
  if (error) return error;

  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = adminProductPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid update payload" },
        { status: 400 }
      );
    }

    let { data, error: updateErr } = await supabase
      .from("products")
      .update(parsed.data)
      .eq("id", id)
      .select("*")
      .single();

    if (
      updateErr &&
      (updateErr.code === "PGRST204" ||
        updateErr.code === "42703" ||
        updateErr.code === "23514" ||
        updateErr.message?.includes("colors") ||
        updateErr.message?.includes("category"))
    ) {
      const { colors, category, ...rest } = parsed.data;
      void colors;
      const patchFallback: Record<string, unknown> = { ...rest };
      if (category !== undefined) {
        patchFallback.category = BASE_CATEGORIES.has(category)
          ? category
          : "heavyweight";
      }

      const retry = await supabase
        .from("products")
        .update(patchFallback)
        .eq("id", id)
        .select("*")
        .single();

      data = retry.data;
      updateErr = retry.error;
    }

    if (updateErr || !data) {
      return NextResponse.json(
        { error: updateErr?.message || "Failed to update product" },
        { status: 400 }
      );
    }

    if (parsed.data.colors !== undefined || parsed.data.category !== undefined) {
      await saveProductOverrides(id, {
        ...(parsed.data.colors !== undefined
          ? { colors: parsed.data.colors }
          : {}),
        ...(parsed.data.category !== undefined
          ? { category: parsed.data.category }
          : {}),
      });
    }

    const [enriched] = await enrichProductsWithOverrides([data as Product]);
    return NextResponse.json({ product: enriched });
  } catch {
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, error } = await requireAdminApi();
  if (error) return error;

  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
  }

  const { error: delErr } = await supabase
    .from("products")
    .delete()
    .eq("id", id);

  if (delErr) {
    if (delErr.code === "23503") {
      return NextResponse.json(
        {
          error:
            "This product is linked to existing orders and cannot be deleted. Mark it as Sold Out instead.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: delErr.message }, { status: 400 });
  }

  await clearProductOverrides(id);
  return NextResponse.json({ deleted: true });
}
