"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/components/providers/AuthProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { BrandLoader } from "@/components/brand/ElectricLoader";
import { ADMIN_PORTAL_PATH } from "@/lib/constants";

export function ResetPasswordClient() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();
  const { refreshProfile } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkRecoverySession() {
      // Handle direct PKCE recovery links (?code=...) as well as /auth/callback redirects
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        const { error: exchangeErr } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeErr) {
          console.error(
            "[Reset Password] Code exchange failed:",
            exchangeErr.message
          );
        } else {
          window.history.replaceState({}, "", "/reset-password");
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (active) {
        setHasSession(Boolean(session));
      }
    }

    checkRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(Boolean(session));
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t.auth.passwordPlaceholder);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.auth.resetMismatch);
      return;
    }

    setSaving(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password,
      });

      if (updateErr) {
        setError(updateErr.message);
        return;
      }

      setSuccess(true);
      const profile = await refreshProfile();
      const target = profile?.is_admin ? ADMIN_PORTAL_PATH : "/";
      window.setTimeout(() => {
        router.replace(target);
        router.refresh();
      }, 1100);
    } catch {
      setError(t.auth.errors.NETWORK_ERROR);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-page)] transition-colors duration-300">
      <Navbar />
      <main className="bg-editorial-grid mx-auto flex w-full flex-1 items-center justify-center px-4 py-14">
        <div className="w-full max-w-md rounded-2xl border border-[#D4AF37]/45 bg-[var(--bg-surface)] p-6 shadow-2xl sm:p-8">
          <div className="mb-4 flex justify-center">
            <BrandLogo height={26} />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/60 bg-[#D4AF37]/10 text-[#D4AF37]">
              {success ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-gold-ink)]">
                {t.auth.resetEyebrow}
              </p>
              <h1 className="font-display text-xl font-extrabold uppercase tracking-tight text-[var(--text-primary)]">
                {t.auth.resetPageTitle}
              </h1>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-[var(--text-secondary)]">
            {t.auth.resetPageSubtitle}
          </p>

          {success && (
            <div
              role="status"
              className="mt-4 flex items-center gap-2 rounded-xl border border-[#D4AF37] bg-[#D4AF37]/15 px-3.5 py-3 text-xs font-semibold text-[var(--accent-gold-ink)]"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#D4AF37]" />
              <span>{t.auth.resetSuccessToast}</span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-[#ff3b30]/50 bg-[#ff3b30]/10 px-3.5 py-2.5 text-xs text-[#ff3b30]"
            >
              {error}
            </div>
          )}

          {hasSession === null ? (
            <BrandLoader label="ULTIMATE // RECOVERY" />
          ) : hasSession === false ? (
            <div className="mt-6 space-y-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 text-xs text-[var(--text-secondary)]">
              <p>{t.auth.resetInvalidSession}</p>
              <Link
                href="/"
                className="inline-block rounded-xl bg-[#D4AF37] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#09090B]"
              >
                {t.auth.backToHome}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  {t.auth.newPasswordLabel}
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D4AF37]" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.auth.passwordPlaceholder}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] py-3 pe-4 ps-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  {t.auth.confirmPasswordLabel}
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D4AF37]" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t.auth.passwordPlaceholder}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] py-3 pe-4 ps-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || success || hasSession === null}
                className="w-full rounded-xl bg-[#D4AF37] py-3 text-xs font-semibold uppercase tracking-wider text-[#09090B] transition-opacity hover:opacity-95 disabled:opacity-50"
              >
                {saving ? t.auth.saving : t.auth.resetSubmit}
              </button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
