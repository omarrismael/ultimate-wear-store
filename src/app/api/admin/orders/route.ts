import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/security/admin-auth";
import type { Order } from "@/types";

export async function GET(request: NextRequest) {
  const { supabase, error } = await requireAdminApi();
  if (error) return error;

  const statusFilter = request.nextUrl.searchParams.get("status");
  let query = supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  if (
    statusFilter &&
    ["pending_verification", "confirmed", "shipped", "cancelled"].includes(
      statusFilter
    )
  ) {
    query = query.eq("status", statusFilter);
  }

  const { data: orders, error: queryErr } = await query;
  if (queryErr) {
    return NextResponse.json({ error: queryErr.message }, { status: 400 });
  }

  const enriched: Order[] = await Promise.all(
    ((orders || []) as Order[]).map(async (order) => {
      const { data: signed } = await supabase.storage
        .from("payment-receipts")
        .createSignedUrl(order.receipt_path, 3600);
      return {
        ...order,
        receipt_signed_url: signed?.signedUrl ?? null,
      };
    })
  );

  return NextResponse.json({ orders: enriched });
}
