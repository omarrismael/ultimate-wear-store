"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { useCart } from "@/components/providers/CartProvider";
import { useLenis } from "@/components/providers/LenisProvider";

export function CartDrawer() {
  const { locale, t } = useI18n();
  const {
    items,
    isCartOpen,
    closeCart,
    totalItems,
    subtotal,
    updateQuantity,
    removeItem,
  } = useCart();
  const { stopScroll, startScroll } = useLenis();

  useEffect(() => {
    if (isCartOpen) {
      stopScroll();
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") closeCart();
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    } else {
      startScroll();
    }
  }, [isCartOpen, stopScroll, startScroll, closeCart]);

  if (!isCartOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex-1" onClick={closeCart} />

      <aside
        data-lenis-prevent
        className="flex h-full w-full max-w-md flex-col border-s border-[#D4AF37]/40 bg-[var(--bg-surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-4 w-4 text-[#D4AF37]" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-primary)]">
              {t.cart.title} ({totalItems})
            </h2>
          </div>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Close Cart"
            className="rounded-full border border-[var(--border-subtle)] p-1.5 text-[var(--text-secondary)] hover:border-[#D4AF37] hover:text-[#D4AF37]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[#D4AF37]/40 text-[#D4AF37]">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {t.cart.emptyTitle}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {t.cart.emptySubtitle}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const title = locale === "ar" ? item.title_ar : item.title_en;
                return (
                  <div
                    key={`${item.productId}-${item.size}-${item.colorNameEn || "default"}`}
                    className="flex gap-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] p-3"
                  >
                    <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[#111114]">
                      <Image
                        src={item.image_url}
                        alt={title}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>

                    <div className="flex flex-1 flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                            {title}
                          </h3>
                          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-[var(--accent-gold-ink)]">
                            <span>
                              {t.shop.sizeLabel}: {item.size}
                            </span>
                            {(item.colorNameEn || item.colorNameAr) && (
                              <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
                                ·
                                {item.colorHex && (
                                  <span
                                    className="inline-block h-2.5 w-2.5 rounded-full border border-white/40"
                                    style={{ backgroundColor: item.colorHex }}
                                  />
                                )}
                                {locale === "ar"
                                  ? item.colorNameAr || item.colorNameEn
                                  : item.colorNameEn || item.colorNameAr}
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            removeItem(
                              item.productId,
                              item.size,
                              item.colorNameEn
                            )
                          }
                          aria-label={t.cart.remove}
                          className="text-[var(--text-muted)] transition-colors hover:text-[#D4AF37]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="inline-flex items-center rounded-xl border border-[var(--border-subtle)]">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.productId,
                                item.size,
                                item.quantity - 1,
                                item.colorNameEn
                              )
                            }
                            className="p-1.5 text-[var(--text-secondary)] hover:text-[#D4AF37]"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-2.5 font-mono text-xs font-semibold text-[var(--text-primary)]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.productId,
                                item.size,
                                item.quantity + 1,
                                item.colorNameEn
                              )
                            }
                            className="p-1.5 text-[var(--text-secondary)] hover:text-[#D4AF37]"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">
                          {item.price_egp * item.quantity} {t.shop.egp}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-[var(--border-subtle)] p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">
                {t.cart.subtotal}
              </span>
              <span className="font-mono text-lg font-semibold text-[var(--accent-gold-ink)]">
                {subtotal} {t.shop.egp}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              {t.cart.shippingNote}
            </p>
            <Link
              href="/checkout"
              onClick={closeCart}
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#D4AF37] py-3.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#09090B] transition-opacity hover:opacity-95"
            >
              {t.cart.proceedCheckout}
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
