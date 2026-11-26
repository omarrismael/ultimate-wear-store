import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/security/admin-auth";
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

    const { data, error: updateErr } = await supabase
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
