import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createOrderSchema } from "@/lib/security/validation";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";
import { sendOrderTelegramNotification } from "@/lib/telegram/notify";
import type { Order, OrderItem, Product } from "@/types";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: orders, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ orders: orders || [] });
  } catch {
    return NextResponse.json(
      { error: "Unable to load orders." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required before placing an order." },
        { status: 401 }
      );
    }
    if (!user.email_confirmed_at) {
      return NextResponse.json(
        { error: "Please verify your email via OTP before placing an order." },
        { status: 403 }
      );
    }

    const ip = getClientIp(request);
    const orderRate = checkRateLimit(
      `order:create:${user.id}:${ip}`,
      RATE_LIMITS.ORDER_CREATE.limit,
      RATE_LIMITS.ORDER_CREATE.windowMs,
      RATE_LIMITS.ORDER_CREATE.blockMs
    );
    if (!orderRate.allowed) {
      return NextResponse.json(
        {
          error: `Order limit reached. Please wait ${orderRate.retryAfterSeconds}s.`,
          retryAfterSeconds: orderRate.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(orderRate.retryAfterSeconds) },
        }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, phone, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const meta = (user.user_metadata || {}) as Record<string, unknown>;
    const resolvedPhone =
      profile?.phone ||
      (typeof meta.phone === "string" && meta.phone.trim()
        ? meta.phone.trim()
        : null);
    const resolvedName =
      profile?.full_name ||
      (typeof meta.full_name === "string" && meta.full_name.trim()
        ? meta.full_name.trim()
        : undefined);

    if (!resolvedPhone) {
      return NextResponse.json(
        { error: "Verified WhatsApp / phone number is required." },
        { status: 400 }
      );
    }

    // Ensure profile row exists for FK integrity and keep phone synced
    if (!profile || !profile.phone) {
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email || "",
          phone: resolvedPhone,
          ...(resolvedName ? { full_name: resolvedName } : {}),
        },
        { onConflict: "id" }
      );
    }

    const body = await request.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid order data." },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Ensure uploaded receipt belongs strictly to the authenticated user's folder
    if (!input.receiptPath.startsWith(`${user.id}/`)) {
      return NextResponse.json(
        { error: "Invalid receipt ownership path." },
        { status: 403 }
      );
    }

    // Fetch authoritative product records from Postgres (never trust client prices)
    const productIds = Array.from(
      new Set(input.items.map((item) => item.productId))
    );
    const { data: dbProducts, error: productsErr } = await supabase
      .from("products")
      .select("*")
      .in("id", productIds);

    if (productsErr || !dbProducts) {
      return NextResponse.json(
        { error: "Unable to verify products." },
        { status: 400 }
      );
    }

    const productMap = new Map<string, Product>();
    for (const p of dbProducts as Product[]) {
      productMap.set(p.id, p);
    }

    let computedTotal = 0;
    const normalizedItems: Array<{
      product_id: string;
      product_title_en: string;
      product_title_ar: string;
      size: "S" | "M" | "L" | "XL";
      color_name: string | null;
      quantity: number;
      unit_price: number;
    }> = [];

    for (const reqItem of input.items) {
      const dbProduct = productMap.get(reqItem.productId);
      if (!dbProduct) {
        return NextResponse.json(
          { error: "One or more products are no longer available." },
          { status: 400 }
        );
      }
      if (!dbProduct.in_stock) {
        return NextResponse.json(
          { error: `${dbProduct.title_en} is currently sold out.` },
          { status: 400 }
        );
      }
      if (!dbProduct.sizes.includes(reqItem.size)) {
        return NextResponse.json(
          {
            error: `Size ${reqItem.size} is unavailable for ${dbProduct.title_en}.`,
          },
          { status: 400 }
        );
      }

      computedTotal += dbProduct.price_egp * reqItem.quantity;
      normalizedItems.push({
        product_id: dbProduct.id,
        product_title_en: dbProduct.title_en,
        product_title_ar: dbProduct.title_ar,
        size: reqItem.size,
        color_name: reqItem.colorName || null,
        quantity: reqItem.quantity,
        unit_price: dbProduct.price_egp,
      });
    }

    const randomCode = crypto.randomBytes(2).toString("hex").toUpperCase();
    const orderCode = `ULT-${new Date().getFullYear().toString().slice(-2)}${String(
      new Date().getMonth() + 1
    ).padStart(2, "0")}-${randomCode}`;

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        order_code: orderCode,
        user_id: user.id,
        customer_email: profile?.email || user.email || "",
        customer_phone: resolvedPhone,
        shipping_address: input.shippingAddress,
        city: input.city,
        payment_method: input.paymentMethod,
        sender_phone: input.senderPhone || null,
        transaction_ref: input.transactionRef || null,
        receipt_path: input.receiptPath,
        total_amount: computedTotal,
        status: "pending_verification",
        notes: input.notes || null,
        telegram_notified: false,
      })
      .select("*")
      .single();

    if (orderErr || !order) {
      return NextResponse.json(
        { error: orderErr?.message || "Failed to create order." },
        { status: 400 }
      );
    }

    let { data: insertedItems, error: itemsErr } = await supabase
      .from("order_items")
      .insert(
        normalizedItems.map((item) => ({
          ...item,
          order_id: order.id,
        }))
      )
      .select("*");

    // Fallback if Supabase table hasn't added optional color_name column yet
    if (
      itemsErr &&
      (itemsErr.message?.includes("color_name") || itemsErr.code === "PGRST204")
    ) {
      const retry = await supabase
        .from("order_items")
        .insert(
          normalizedItems.map(({ color_name, ...rest }) => {
            void color_name;
            return {
              ...rest,
              order_id: order.id,
            };
          })
        )
        .select("*");
      itemsErr = retry.error;
      insertedItems = retry.data;
    }

    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 400 });
    }

    const typedOrder = order as Order;
    const typedItems = ((insertedItems || normalizedItems) as OrderItem[]).map(
      (item, idx) => ({
        ...item,
        id: item.id || `${order.id}-${idx}`,
        order_id: order.id,
      })
    );

    // Dispatch Telegram notification server-side right after order creation.
    // Persistence is already committed; notification failures are logged & returned cleanly.
    const telegramResult = await sendOrderTelegramNotification(
      supabase,
      typedOrder,
      typedItems,
      resolvedName
    );

    let finalTelegramNotified = false;
    if (telegramResult.sent) {
      const { error: rpcErr } = await supabase.rpc(
        "mark_order_telegram_notified",
        { p_order_id: typedOrder.id }
      );
      if (rpcErr) {
        console.warn(
          `[Orders] Failed to mark telegram_notified for ${typedOrder.order_code}:`,
          rpcErr.message
        );
      } else {
        finalTelegramNotified = true;
      }
    } else {
      console.error(
        `[Orders] Telegram alert did not succeed for ${typedOrder.order_code}:`,
        telegramResult.error
      );
    }

    return NextResponse.json(
      {
        order: { ...typedOrder, telegram_notified: finalTelegramNotified },
        notifications: {
          telegram: telegramResult,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Unexpected error creating order." },
      { status: 500 }
    );
  }
}
