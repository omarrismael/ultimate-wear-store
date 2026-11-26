import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notifyOrderSchema } from "@/lib/security/validation";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";
import { sendOrderTelegramNotification } from "@/lib/telegram/notify";
import type { Order, OrderItem } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = getClientIp(request);
    const limit = checkRateLimit(
      `order:notify:${user.id}:${ip}`,
      RATE_LIMITS.ORDER_NOTIFY.limit,
      RATE_LIMITS.ORDER_NOTIFY.windowMs,
      RATE_LIMITS.ORDER_NOTIFY.blockMs
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Notification rate limit exceeded." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = notifyOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid orderId" }, { status: 400 });
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", parsed.data.orderId)
      .eq("user_id", user.id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.telegram_notified) {
      return NextResponse.json({ notified: true, alreadySent: true });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const meta = (user.user_metadata || {}) as Record<string, unknown>;
    const customerName =
      profile?.full_name ||
      (typeof meta.full_name === "string" ? meta.full_name : null) ||
      (typeof meta.name === "string" ? meta.name : null);

    const typedOrder = order as Order;
    const items = (order.order_items || []) as OrderItem[];

    const result = await sendOrderTelegramNotification(
      supabase,
      typedOrder,
      items,
      customerName
    );

    if (result.sent) {
      const { error: rpcErr } = await supabase.rpc(
        "mark_order_telegram_notified",
        { p_order_id: typedOrder.id }
      );
      if (rpcErr) {
        console.warn(
          `[Orders/Notify] Failed to mark telegram_notified for ${typedOrder.order_code}:`,
          rpcErr.message
        );
      }
      return NextResponse.json({
        notified: true,
        photoSent: result.photoSent ?? false,
        warning: result.error,
      });
    }

    console.error(
      `[Orders/Notify] Telegram delivery failed for ${typedOrder.order_code}:`,
      result.error
    );
    return NextResponse.json(
      {
        notified: false,
        error: result.error || "Telegram delivery failed.",
        upstreamStatus: result.statusCode,
      },
      { status: result.statusCode === 500 ? 500 : 502 }
    );
  } catch (err) {
    console.error("[Orders/Notify] Unexpected error:", err);
    return NextResponse.json(
      { error: "Notification dispatch failed." },
      { status: 500 }
    );
  }
}
