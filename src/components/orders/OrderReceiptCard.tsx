"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { Order } from "@/types";
import { useI18n } from "@/lib/i18n/context";
import { getGovernorateLabel } from "@/lib/egypt-governorates";
import {
  ReceiptPrinter,
  type ReceiptPrinterStage,
} from "@/components/orders/ReceiptPrinter";

function BarcodeGraphic({ code }: { code: string }) {
  const bars = Array.from(code).flatMap((ch, idx) => {
    const n = ch.charCodeAt(0) + idx * 7;
    return [
      (n % 3) + 1,
      ((n >> 1) % 2) + 1,
      ((n >> 2) % 3) + 1,
    ];
  });

  return (
    <div className="mt-4 flex flex-col items-center border-t border-dashed border-current/25 pt-3">
      <div className="flex h-9 items-stretch justify-center gap-[1.5px]">
        {bars.slice(0, 38).map((w, i) => (
          <span
            key={i}
            className={i % 2 === 0 ? "bg-current" : "bg-transparent"}
            style={{ width: `${w}px` }}
          />
        ))}
      </div>
      <span className="mt-1.5 text-[10px] tracking-[0.26em] opacity-80">
        {code}
      </span>
    </div>
  );
}

export function OrderReceiptCard({
  order,
  index = 0,
}: {
  order: Order;
  index?: number;
}) {
  const { locale, t } = useI18n();
  const isAr = locale === "ar";

  const [stage, setStage] = useState<ReceiptPrinterStage>("processing");
  const [runKey, setRunKey] = useState(0);

  const runSequence = useCallback(() => {
    setStage("processing");
    const t1 = window.setTimeout(() => {
      setStage("printing");
    }, 350 + Math.min(index, 4) * 120);
    const t2 = window.setTimeout(() => {
      setStage("complete");
    }, 2150 + Math.min(index, 4) * 120);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [index]);

  useEffect(() => {
    return runSequence();
  }, [runSequence, runKey]);

  const isFullCod =
    order.payment_mode === "full_cod" ||
    !order.receipt_path ||
    order.receipt_path.endsWith("/cod-no-receipt");

  const paidNow =
    typeof order.paid_amount === "number"
      ? order.paid_amount
      : isFullCod
        ? 0
        : order.total_amount;

  const remainingCod =
    typeof order.remaining_cod_amount === "number"
      ? order.remaining_cod_amount
      : isFullCod
        ? order.total_amount
        : 0;

  const govLabel = getGovernorateLabel(
    order.governorate || order.city,
    locale
  );

  return (
    <div className="flex flex-col items-center">
      <ReceiptPrinter.Root key={runKey} stage={stage} feedMotion="stepped">
        <ReceiptPrinter.Machine>
          <ReceiptPrinter.Header>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#D4AF37]">
                ULTIMATE
              </p>
              <p className="font-mono text-xs font-bold text-white dark:text-[#09090B]">
                {order.order_code}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-2.5 py-1 text-[10px] font-semibold text-[#D4AF37]">
                {t.orders.status[order.status]}
              </span>
              <button
                type="button"
                onClick={() => setRunKey((k) => k + 1)}
                title={t.orders.replayReceipt}
                aria-label={t.orders.replayReceipt}
                className="rounded-lg border border-white/15 p-1.5 text-white/75 transition-colors hover:border-[#D4AF37] hover:text-[#D4AF37] dark:border-black/20 dark:text-black/75"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </ReceiptPrinter.Header>

          <ReceiptPrinter.Screen>
            <ReceiptPrinter.Status>
              {stage === "processing"
                ? isAr
                  ? "جاري تجهيز الإيصال..."
                  : "Processing order receipt"
                : stage === "printing"
                  ? isAr
                    ? "جاري طباعة الفاتورة..."
                    : "Printing thermal receipt"
                  : `${order.order_code} · ${t.orders.status[order.status]}`}
            </ReceiptPrinter.Status>
          </ReceiptPrinter.Screen>
        </ReceiptPrinter.Machine>

        <ReceiptPrinter.Output>
          <ReceiptPrinter.Paper>
            <div className="border-b border-dashed border-current/25 pb-3 text-center">
              <p className="text-xs font-extrabold uppercase tracking-[0.26em]">
                ULTIMATE WEAR
              </p>
              <p className="mt-1 text-[10px] opacity-75">
                {new Date(order.created_at).toLocaleString()}
              </p>
              <p className="mt-0.5 text-[10px] opacity-75">
                {govLabel}
              </p>
            </div>

            <div className="mt-3 space-y-2 border-b border-dashed border-current/25 pb-3 text-[11px]">
              {order.order_items?.map((item) => (
                <div key={item.id} className="space-y-0.5">
                  <div className="flex justify-between gap-2 font-semibold">
                    <span className="truncate">
                      {isAr ? item.product_title_ar : item.product_title_en}
                    </span>
                    <span className="shrink-0">
                      {item.unit_price * item.quantity} {t.shop.egp}
                    </span>
                  </div>
                  <p className="text-[10px] opacity-75">
                    {item.size}
                    {item.color_name ? ` · ${item.color_name}` : ""} ×{" "}
                    {item.quantity}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 space-y-1.5 text-[11px]">
              <div className="flex justify-between opacity-80">
                <span>{t.cart.subtotal}</span>
                <span>
                  {order.total_amount} {t.shop.egp}
                </span>
              </div>
              <div className="flex justify-between opacity-80">
                <span>{isAr ? "الشحن" : "Shipping"}</span>
                <span>{t.orders.shippingFree}</span>
              </div>
              <div className="flex justify-between font-bold text-[#9E7C14] dark:text-[#D4AF37]">
                <span>{t.orders.paidNow}</span>
                <span>
                  {paidNow} {t.shop.egp}
                </span>
              </div>
              <div className="flex justify-between border-t border-dashed border-current/25 pt-1.5 text-xs font-extrabold">
                <span>{t.orders.remainingCod}</span>
                <span>
                  {remainingCod} {t.shop.egp}
                </span>
              </div>
            </div>

            <BarcodeGraphic code={order.order_code} />
          </ReceiptPrinter.Paper>
        </ReceiptPrinter.Output>
      </ReceiptPrinter.Root>
    </div>
  );
}
