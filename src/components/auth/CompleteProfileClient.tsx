"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Phone, ShieldCheck, User as UserIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/components/providers/AuthProvider";
import { EGYPT_MOBILE_REGEX } from "@/lib/security/validation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { BrandLoader } from "@/components/brand/BrandLoader";
import { GovernorateSelector } from "@/components/checkout/GovernorateSelector";

function sanitizeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export function CompleteProfileClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, t } = useI18n();
  const isAr = locale === "ar";
  const { user, profile, loading, refreshProfile, openAuthModal } = useAuth();

  const nextPath = sanitizeNext(searchParams.get("next"));

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [governorate, setGovernorate] = useState("cairo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    const meta = (user.user_metadata || {}) as Record<string, unknown>;
    const existingName =
      profile?.full_name ||
      (typeof meta.full_name === "string" ? meta.full_name : "") ||
      (typeof meta.name === "string" ? meta.name : "");
    const existingPhone =
      profile?.phone || (typeof meta.phone === "string" ? meta.phone : "");
    const existingGov =
      profile?.governorate ||
      (typeof meta.governorate === "string" ? meta.governorate : "");

    if (existingName && !fullName) setFullName(existingName);
    if (existingPhone && !phone) setPhone(existingPhone);
    if (existingGov) setGovernorate(existingGov);
  }, [user, profile, fullName, phone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();

    if (cleanName.length < 2) {
      setError(
        isAr
          ? "يرجى إدخال الاسم بالكامل (حرفين على الأقل)."
          : "Please enter your full name (at least 2 characters)."
      );
      return;
    }
    if (!EGYPT_MOBILE_REGEX.test(cleanPhone)) {
      setError(t.auth.errors.INVALID_PHONE);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: cleanName,
          phone: cleanPhone,
          governorate: governorate || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || t.auth.errors.GENERIC);
        return;
      }

      setSaved(true);
      await refreshProfile();
      window.setTimeout(() => {
        router.replace(nextPath);
        router.refresh();
      }, 650);
    } catch {
      setError(t.auth.errors.NETWORK_ERROR);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <BrandLoader fullScreen label="ULTIMATE // ONBOARDING" />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-page)] transition-colors duration-300">
      <Navbar />
      <main className="bg-editorial-grid mx-auto flex w-full flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-[#D4AF37]/45 bg-[var(--bg-surface)] p-6 shadow-2xl sm:p-8">
          <div className="mb-4 flex justify-center">
            <BrandLogo height={26} />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/60 bg-[#D4AF37]/10 text-[#D4AF37]">
              {saved ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent-gold-ink)]">
                {isAr ? "استكمال الحساب" : "ONBOARDING REQUIRED"}
              </p>
              <h1 className="font-display text-xl font-extrabold uppercase text-[var(--text-primary)]">
                {isAr ? "أكمل بيانات التواصل" : "Complete Your Profile"}
              </h1>
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">
            {isAr
              ? "لإتمام التسجيل عبر جوجل وتأكيد الطلبات، يرجى إدخال الاسم بالكامل ورقم الموبايل المصري."
              : "To finish your Google sign-in and unlock checkout, please provide your full name and Egyptian mobile number."}
          </p>

          {!user ? (
            <div className="mt-6 space-y-4">
              <p className="text-xs text-[var(--text-secondary)]">
                {isAr
                  ? "يرجى تسجيل الدخول أولاً."
                  : "Please sign in to continue."}
              </p>
              <button
                type="button"
                onClick={openAuthModal}
                className="w-full rounded-xl bg-[#D4AF37] py-3 text-xs font-bold uppercase tracking-wider text-[#09090B]"
              >
                {t.nav.signIn}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {error && (
                <div className="rounded-xl border border-[#ff3b30]/50 bg-[#ff3b30]/10 px-3.5 py-2.5 text-xs text-[#ff3b30]">
                  {error}
                </div>
              )}

              {saved && (
                <div className="flex items-center gap-2 rounded-xl border border-[#D4AF37] bg-[#D4AF37]/15 px-3.5 py-3 text-xs font-semibold text-[var(--accent-gold-ink)]">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#D4AF37]" />
                  <span>
                    {isAr
                      ? "تم حفظ البيانات! جاري التحويل..."
                      : "Profile saved! Redirecting..."}
                  </span>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  {t.auth.fullNameLabel}
                </label>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D4AF37]" />
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t.auth.fullNamePlaceholder}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] py-3 pe-4 ps-10 text-sm text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  {t.auth.phoneLabel}
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D4AF37]" />
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/[^\d]/g, ""))
                    }
                    placeholder={t.auth.phonePlaceholder}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] py-3 pe-4 ps-10 text-sm text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  {t.checkout.cityLabel}
                </label>
                <GovernorateSelector
                  value={governorate}
                  onChange={setGovernorate}
                  required={false}
                />
              </div>

              <button
                type="submit"
                disabled={saving || saved}
                className="w-full rounded-xl bg-[#D4AF37] py-3 text-xs font-bold uppercase tracking-wider text-[#09090B] transition-opacity hover:opacity-95 disabled:opacity-50"
              >
                {saving
                  ? t.auth.saving
                  : isAr
                    ? "حفظ والمتابعة"
                    : "Save & Continue"}
              </button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
