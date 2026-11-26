"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  Copy,
  ShieldCheck,
  Smartphone,
  Upload,
} from "lucide-react";
import type { PaymentMethod } from "@/types";
import { useI18n } from "@/lib/i18n/context";
import { useCart } from "@/components/providers/CartProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { INSTAPAY_NUMBER, VODAFONE_CASH_NUMBER } from "@/lib/constants";
import { EGYPT_MOBILE_REGEX } from "@/lib/security/validation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ElectricLoader } from "@/components/brand/ElectricLoader";
import HoldButton from "@/components/react-bits/HoldButton";

const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export function CheckoutClient() {
  const { locale, t } = useI18n();
  const { theme } = useTheme();
  const { items, subtotal, clearCart } = useCart();
  const { user, profile, loading: authLoading, openAuthModal } = useAuth();
  const formRef = useRef<HTMLFormElement | null>(null);

  const [city, setCity] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("vodafone_cash");
  const [senderPhone, setSenderPhone] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedOrderCode, setCompletedOrderCode] = useState<string | null>(
    null
  );

  const isVerifiedProfile = Boolean(user && user.email_confirmed_at && profile?.phone);

  const activeTargetNumber =
    paymentMethod === "vodafone_cash" ? VODAFONE_CASH_NUMBER : INSTAPAY_NUMBER;

  const handleCopy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleReceiptChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!user) {
      setError(t.checkout.signInToUpload);
      openAuthModal();
      return;
    }

    setError(null);

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const mimeOk = file.type ? ALLOWED_MIME.has(file.type.toLowerCase()) : false;
    const extOk = ALLOWED_EXT.has(ext);

    if (!mimeOk && !extOk) {
      setError(t.checkout.uploadInvalidType);
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      setError(t.checkout.uploadTooLarge);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/orders/receipt", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.receiptPath) {
        if (res.status === 401) {
          openAuthModal();
          setError(t.checkout.signInToUpload);
          return;
        }
        if (data?.errorCode === "INVALID_TYPE") {
          setError(t.checkout.uploadInvalidType);
          return;
        }
        if (data?.errorCode === "TOO_LARGE") {
          setError(t.checkout.uploadTooLarge);
          return;
        }
        setError(data?.error || t.checkout.uploadFailed);
        return;
      }

      setReceiptPath(data.receiptPath);
      setReceiptPreview(URL.createObjectURL(file));
    } catch {
      setError(t.checkout.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const validateBeforeSubmit = (): boolean => {
    setError(null);
    if (!isVerifiedProfile) {
      openAuthModal();
      return false;
    }
    if (items.length === 0) {
      setError(t.checkout.emptyCart);
      return false;
    }
    if (formRef.current && !formRef.current.reportValidity()) {
      return false;
    }
    if (!receiptPath) {
      setError("Please upload your transfer receipt screenshot.");
      return false;
    }
    if (senderPhone && !EGYPT_MOBILE_REGEX.test(senderPhone.trim())) {
      setError("Sender phone must be a valid Egyptian mobile (01XXXXXXXXX).");
      return false;
    }
    return true;
  };

  const submitOrder = async () => {
    if (!validateBeforeSubmit() || !receiptPath) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            size: item.size,
            colorName: item.colorNameEn || item.colorNameAr || undefined,
            quantity: item.quantity,
          })),
          paymentMethod,
          receiptPath,
          senderPhone: senderPhone.trim() || undefined,
          transactionRef: transactionRef.trim() || undefined,
          shippingAddress: shippingAddress.trim(),
          city: city.trim(),
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not submit order.");
        return;
      }

      // Notify Telegram via protected server route if server-side dispatch did not confirm
      if (data.order?.id && !data.order.telegram_notified) {
        try {
          const notifyRes = await fetch("/api/orders/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: data.order.id }),
          });
          if (!notifyRes.ok) {
            const notifyErr = await notifyRes.json().catch(() => null);
            console.warn(
              "[Checkout] Telegram fallback notification failed:",
              notifyErr
            );
          }
        } catch (err) {
          console.warn("[Checkout] Telegram fallback request failed:", err);
        }
      }

      clearCart();
      setCompletedOrderCode(data.order?.order_code || "ULTIMATE");
    } catch {
      setError("Network error while creating your order.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitOrder();
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-page)] transition-colors duration-300">
      <ElectricLoader
        overlay
        visible={submitting}
        label={
          locale === "ar"
            ? "جاري تأكيد الطلب..."
            : "ULTIMATE // PROCESSING ORDER"
        }
      />
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-8 min-[400px]:px-4 sm:px-6 sm:py-12 lg:px-8">
        {completedOrderCode ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-[#D4AF37]/60 bg-[var(--bg-surface)] p-6 text-center sm:p-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent-gold-ink)]">
              {completedOrderCode}
            </p>
            <h1 className="mt-2 text-2xl font-medium text-[var(--text-primary)]">
              {t.checkout.successTitle}
            </h1>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              {t.checkout.successDesc}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/orders"
                className="rounded-xl bg-[#D4AF37] px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#09090B]"
              >
                {t.checkout.viewOrders}
              </Link>
              <Link
                href="/"
                className="rounded-xl border border-[var(--border-strong)] px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] hover:border-[#D4AF37]"
              >
                {t.checkout.backToShop}
              </Link>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="mx-auto max-w-lg rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              {t.checkout.emptyCart}
            </p>
            <Link
              href="/#shop"
              className="mt-6 inline-block rounded-xl bg-[#D4AF37] px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#09090B]"
            >
              {t.checkout.backToShop}
            </Link>
          </div>
        ) : (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-gold-ink)]">
              {t.checkout.eyebrow}
            </p>
            <h1 className="font-display mt-2 text-3xl font-extrabold uppercase tracking-tight text-[var(--text-primary)]">
              {t.checkout.title}
            </h1>

            {!authLoading && !isVerifiedProfile && (
              <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#D4AF37]/50 bg-[#D4AF37]/10 p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#D4AF37]" />
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                      {t.checkout.authRequiredTitle}
                    </h2>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {t.checkout.authRequiredDesc}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openAuthModal}
                  className="shrink-0 rounded-xl bg-[#D4AF37] px-5 py-2.5 text-xs font-semibold text-[#09090B]"
                >
                  {t.checkout.openAuth}
                </button>
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-xl border border-[#D4AF37] bg-[#D4AF37]/10 px-4 py-3 text-xs text-[var(--accent-gold-ink)]">
                {error}
              </div>
            )}

            <form
              ref={formRef}
              onSubmit={handleSubmit}
              className="mt-8 grid gap-8 lg:grid-cols-12"
            >
              <div className="space-y-8 lg:col-span-7">
                {/* 1. Delivery Details */}
                <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-6">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">
                    {t.checkout.shippingTitle}
                  </h2>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs text-[var(--text-secondary)]">
                        {t.checkout.cityLabel}
                      </label>
                      <input
                        type="text"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder={t.checkout.cityPlaceholder}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs text-[var(--text-secondary)]">
                        {t.checkout.addressLabel}
                      </label>
                      <input
                        type="text"
                        required
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        placeholder={t.checkout.addressPlaceholder}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs text-[var(--text-secondary)]">
                        {t.checkout.notesLabel}
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={t.checkout.notesPlaceholder}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none"
                      />
                    </div>
                  </div>
                </section>

                {/* 2. Vodafone Cash / InstaPay */}
                <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-6">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">
                    {t.checkout.paymentTitle}
                  </h2>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        {
                          id: "vodafone_cash" as PaymentMethod,
                          label: t.checkout.vodafoneCash,
                          number: VODAFONE_CASH_NUMBER,
                        },
                        {
                          id: "instapay" as PaymentMethod,
                          label: t.checkout.instapay,
                          number: INSTAPAY_NUMBER,
                        },
                      ] as const
                    ).map((opt) => {
                      const active = paymentMethod === opt.id;
                      return (
                        <div
                          key={opt.id}
                          onClick={() => setPaymentMethod(opt.id)}
                          className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                            active
                              ? "border-[#D4AF37] bg-[#D4AF37]/10"
                              : "border-[var(--border-subtle)] hover:border-[#D4AF37]/60"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                              <Smartphone className="h-4 w-4 text-[#D4AF37]" />
                              {opt.label}
                            </span>
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                handleCopy(opt.number, opt.id);
                              }}
                              className="inline-flex items-center gap-1 rounded-xl border border-[#D4AF37]/60 px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-gold-ink)] hover:bg-[#D4AF37] hover:text-[#09090B]"
                            >
                              {copiedKey === opt.id ? (
                                <>
                                  <Check className="h-3 w-3" />
                                  {t.checkout.copied}
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  {t.checkout.copyNumber}
                                </>
                              )}
                            </button>
                          </div>
                          <p className="mt-2 font-mono text-base font-bold tracking-wider text-[var(--accent-gold-ink)]">
                            {opt.number}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <p className="mt-4 text-xs text-[var(--text-secondary)]">
                    {t.checkout.transferTo}{" "}
                    <span className="font-mono font-bold text-[var(--accent-gold-ink)]">
                      {activeTargetNumber}
                    </span>
                  </p>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs text-[var(--text-secondary)]">
                        {t.checkout.senderPhoneLabel}
                      </label>
                      <input
                        type="tel"
                        value={senderPhone}
                        onChange={(e) =>
                          setSenderPhone(e.target.value.replace(/[^\d]/g, ""))
                        }
                        placeholder={t.checkout.senderPhonePlaceholder}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs text-[var(--text-secondary)]">
                        {t.checkout.txRefLabel}
                      </label>
                      <input
                        type="text"
                        value={transactionRef}
                        onChange={(e) => setTransactionRef(e.target.value)}
                        placeholder={t.checkout.txRefPlaceholder}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* 3. Receipt Upload */}
                  <div className="mt-6">
                    <label className="mb-2 block text-xs font-semibold text-[var(--text-primary)]">
                      {t.checkout.receiptLabel}
                    </label>
                    {!user ? (
                      <button
                        type="button"
                        onClick={openAuthModal}
                        className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#D4AF37]/60 bg-[#D4AF37]/5 p-6 text-center transition-colors hover:border-[#D4AF37]"
                      >
                        <Upload className="mb-2 h-5 w-5 text-[#D4AF37]" />
                        <span className="text-xs font-semibold text-[var(--accent-gold-ink)]">
                          {t.checkout.signInToUpload}
                        </span>
                      </button>
                    ) : (
                      <label
                        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-colors ${
                          receiptPath
                            ? "border-[#D4AF37] bg-[#D4AF37]/10"
                            : "border-[var(--border-strong)] hover:border-[#D4AF37]"
                        }`}
                      >
                        <Upload className="mb-2 h-5 w-5 text-[#D4AF37]" />
                        <span className="text-xs font-semibold text-[var(--text-primary)]">
                          {uploading
                            ? t.checkout.uploadingReceipt
                            : receiptPath
                              ? t.checkout.receiptUploaded
                              : t.checkout.receiptHint}
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,.jpg,.jpeg,.png,.webp"
                          disabled={uploading}
                          onChange={handleReceiptChange}
                          className="hidden"
                        />
                      </label>
                    )}

                    {receiptPreview && (
                      <div className="mt-3 flex items-start gap-3">
                        <div className="relative h-36 w-36 overflow-hidden rounded-xl border border-[#D4AF37]/50 sm:h-40 sm:w-40">
                          <Image
                            src={receiptPreview}
                            alt="Transfer Receipt Preview"
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setReceiptPath(null);
                            setReceiptPreview(null);
                          }}
                          className="rounded-xl border border-[var(--border-subtle)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] hover:border-[#D4AF37] hover:text-[var(--text-primary)]"
                        >
                          {t.cart.remove}
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-[#D4AF37]/40 bg-[var(--bg-surface)] p-4 sm:p-6 lg:sticky lg:top-24">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">
                    {t.checkout.summaryTitle}
                  </h2>

                  <div className="mt-4 space-y-3 border-b border-[var(--border-subtle)] pb-4">
                    {items.map((item) => (
                      <div
                        key={`${item.productId}-${item.size}-${item.colorNameEn || "default"}`}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="text-[var(--text-secondary)]">
                          <span className="font-semibold text-[var(--text-primary)]">
                            {locale === "ar" ? item.title_ar : item.title_en}
                          </span>{" "}
                          <span className="text-[var(--accent-gold-ink)]">
                            ({item.size}
                            {item.colorNameEn || item.colorNameAr
                              ? ` · ${
                                  locale === "ar"
                                    ? item.colorNameAr || item.colorNameEn
                                    : item.colorNameEn || item.colorNameAr
                                }`
                              : ""}
                            ) × {item.quantity}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-[var(--text-primary)]">
                          {item.price_egp * item.quantity} {t.shop.egp}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">
                      {t.checkout.totalDue}
                    </span>
                    <span className="font-mono text-2xl font-bold text-[var(--accent-gold-ink)]">
                      {subtotal} {t.shop.egp}
                    </span>
                  </div>

                  <div className="mt-6">
                    <HoldButton
                      doneLabel={t.checkout.holdDone}
                      backgroundColor={theme === "dark" ? "#27272a" : "#18181b"}
                      fillColor="#D4AF37"
                      textColor="#f5f5f5"
                      fillTextColor="#09090B"
                      size="md"
                      radius={14}
                      fillDirection="right"
                      holdTime={2000}
                      releaseTime={200}
                      pressScale={0.97}
                      wave
                      waveAmplitude={6}
                      glow
                      resetAfter={1200}
                      disabled={submitting || uploading}
                      onBeforeHold={validateBeforeSubmit}
                      onHold={submitOrder}
                    >
                      {submitting
                        ? t.checkout.submittingOrder
                        : t.checkout.placeOrder}
                    </HoldButton>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
