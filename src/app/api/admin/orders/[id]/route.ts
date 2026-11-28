import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/security/admin-auth";
import { createOptionalServiceClient } from "@/lib/supabase/service";
import { adminOrderStatusSchema, uuidSchema } from "@/lib/security/validation";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, error } = await requireAdminApi();
  if (error) return error;

  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = adminOrderStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid order status" },
        { status: 400 }
      );
    }

    const dbWriter = createOptionalServiceClient() ?? supabase;
    const { data, error: updateErr } = await dbWriter
      .from("orders")
      .update({ status: parsed.data.status })
      .eq("id", id)
      .select("*")
      .single();

    if (updateErr || !data) {
      return NextResponse.json(
        { error: updateErr?.message || "Order not found" },
        { status: 400 }
      );
    }

    return NextResponse.json({ order: data });
  } catch {
    return NextResponse.json(
      { error: "Unable to update order status" },
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
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  try {
    const adminDb = createOptionalServiceClient() ?? supabase;

    // 1. Inspect order to clean up any uploaded payment receipt in storage
    const { data: existingOrder, error: fetchErr } = await adminDb
      .from("orders")
      .select("id, receipt_path")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 400 });
    }
    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (existingOrder.receipt_path) {
      const { error: storageErr } = await adminDb.storage
        .from("payment-receipts")
        .remove([existingOrder.receipt_path]);
      if (storageErr) {
        console.warn(
          `[Admin Order Delete] Failed to delete receipt '${existingOrder.receipt_path}':`,
          storageErr.message
        );
      }
    }

    // 2. Permanently delete order (order_items cascades via FK)
    const { error: delErr } = await adminDb
      .from("orders")
      .delete()
      .eq("id", id);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 400 });
    }

    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    console.error("[Admin Order Delete] Unexpected error:", err);
    return NextResponse.json(
      { error: "Unable to delete order permanently." },
      { status: 500 }
    );
  }
}
