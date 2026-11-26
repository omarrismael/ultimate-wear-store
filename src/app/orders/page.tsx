"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import type { Order } from "@/types";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/components/providers/AuthProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ElectricLoader } from "@/components/brand/ElectricLoader";

export default function OrdersPage() {
  const { locale, t } = useI18n();
  const { user, openAuthModal } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadOrders() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/orders");
        if (res.ok) {
          const data = await res.json();
          if (active) setOrders(data.orders || []);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadOrders();
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-page)] transition-colors duration-300">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-8 min-[400px]:px-4 sm:px-6 sm:py-12 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight text-[var(--text-primary)] sm:text-3xl">
              {t.orders.title}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {t.orders.subtitle}
            </p>
          </div>
          <Link
            href="/#shop"
            className="rounded-xl border border-[#D4AF37]/60 px-4 py-2 text-xs font-semibold text-[var(--accent-gold-ink)] hover:bg-[#D4AF37] hover:text-[#09090B]"
          >
            {t.checkout.backToShop}
          </Link>
        </div>

        {!user ? (
          <div className="mt-10 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center sm:p-10">
            <p className="text-sm text-[var(--text-secondary)]">
              {t.checkout.authRequiredTitle}
            </p>
            <button
              type="button"
              onClick={openAuthModal}
              className="mt-4 rounded-xl bg-[#D4AF37] px-6 py-3 text-xs font-semibold text-[#09090B]"
            >
              {t.nav.signIn}
            </button>
          </div>
        ) : loading ? (
          <ElectricLoader label="ULTIMATE // LOADING ORDERS" />
        ) : orders.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 text-center sm:p-12">
            <Package className="mx-auto mb-3 h-8 w-8 text-[#D4AF37]" />
            <p className="text-sm text-[var(--text-secondary)]">
              {t.orders.empty}
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-5">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
                  <div>
                    <p className="font-mono text-sm font-bold text-[var(--accent-gold-ink)]">
                      {order.order_code}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="rounded-xl border border-[#D4AF37]/50 bg-[#D4AF37]/10 px-3 py-1 text-xs font-semibold text-[var(--accent-gold-ink)]">
                      {t.orders.status[order.status]}
                    </span>
                    <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
                      {order.total_amount} {t.shop.egp}
                    </span>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-[var(--text-secondary)]">
                  {order.order_items?.map((item) => (
                    <div key={item.id} className="flex justify-between gap-3">
                      <span className="min-w-0">
                        {locale === "ar"
                          ? item.product_title_ar
                          : item.product_title_en}{" "}
                        ({item.size}
                        {item.color_name ? ` · ${item.color_name}` : ""}) ×{" "}
                        {item.quantity}
                      </span>
                      <span className="shrink-0 font-mono">
                        {item.unit_price * item.quantity} {t.shop.egp}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
