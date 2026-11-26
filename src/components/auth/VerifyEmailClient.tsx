"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ADMIN_PORTAL_PATH } from "@/lib/constants";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import CodeSlots, { type CodeSlotsStatus } from "@/components/react-bits/CodeSlots";
import { BrandLogo } from "@/components/brand/BrandLogo";

function sanitizeRedirect(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { theme } = useTheme();
  const { refreshProfile } = useAuth();

  const queryEmail = searchParams.get("email")?.trim() || "";
  const nextPath = sanitizeRedirect(searchParams.get("redirect"));

  const [email, setEmail] = useState(queryEmail);
  const [otp, setOtp] = useState("");
  const [slotStatus, setSlotStatus] = useState<CodeSlotsStatus>("idle");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(queryEmail ? 60 : 0);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (queryEmail) {
      setEmail(queryEmail);
      try {
        window.sessionStorage.setItem("ultimate_pending_verify_email", queryEmail);
      } catch {
        // Ignore storage restrictions
      }
      return;
    }
    try {
      const saved = window.sessionStorage.getItem("ultimate_pending_verify_email");
      if (saved) setEmail(saved);
    } catch {
      // Ignore storage restrictions
    }
  }, [queryEmail]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const resolveAuthError = (
    data: { errorCode?: string; error?: string; retryAfterSeconds?: number } | null,
    fallbackCode: keyof typeof t.auth.errors = "GENERIC"
  ): string => {
    const code = (data?.errorCode as keyof typeof t.auth.errors | undefined) || fallbackCode;
    const base = t.auth.errors[code] || data?.error || t.auth.errors.GENERIC;
    if (code === "RATE_LIMITED" && data?.retryAfterSeconds) {
      return `${base} (${data.retryAfterSeconds}s)`;
    }
    return base;
  };

  const verifyCode = async (codeToVerify: string): Promise<boolean> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError(t.auth.verifyEmailMissing);
      setSlotStatus("error");
      return false;
    }
    if (!/^[0-9]{6}$/.test(codeToVerify)) {
      setError(t.auth.errors.MISSING_CODE);
      setSlotStatus("error");
      return false;
    }

    setError(null);
    setInfoMsg(null);
    setVerifying(true);
    setSlotStatus("verifying");

    try {
      let pendingProfile: {
        email?: string;
        fullName?: string;
        phone?: string;
      } | null = null;
      try {
        const raw = window.sessionStorage.getItem("ultimate_pending_verify_profile");
        if (raw) pendingProfile = JSON.parse(raw);
      } catch {
        // Ignore storage restrictions
      }

      const matchesPending =
        pendingProfile &&
        (!pendingProfile.email || pendingProfile.email === cleanEmail);

      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          token: codeToVerify,
          flow: "signup",
          fullName: matchesPending ? pendingProfile?.fullName : undefined,
          phone: matchesPending ? pendingProfile?.phone : undefined,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.retryAfterSeconds) setCooldown(data.retryAfterSeconds);
        setSlotStatus("error");
        setError(
          resolveAuthError(
            data,
            res.status === 410 ? "OTP_EXPIRED" : "OTP_INVALID"
          )
        );
        return false;
      }

      setSlotStatus("success");
      setSuccessMsg(t.auth.verifySuccessToast);

      try {
        window.sessionStorage.removeItem("ultimate_pending_verify_email");
        window.sessionStorage.removeItem("ultimate_pending_verify_profile");
      } catch {
        // Ignore
      }

      const refreshed = await refreshProfile();
      const target =
        nextPath !== "/"
          ? nextPath
          : refreshed?.is_admin || data?.isAdmin
            ? ADMIN_PORTAL_PATH
            : "/";

      window.setTimeout(() => {
        router.replace(target);
        router.refresh();
      }, 950);

      return true;
    } catch {
      setSlotStatus("error");
      setError(t.auth.errors.NETWORK_ERROR);
      return false;
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyCode(otp);
  };

  const handleResendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError(t.auth.verifyEmailMissing);
      return;
    }
    if (cooldown > 0 || resending) return;

    setError(null);
    setInfoMsg(null);
    setResending(true);

    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, purpose: "signup" }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (data?.retryAfterSeconds) {
          setCooldown(data.retryAfterSeconds);
        }
        setError(resolveAuthError(data, "OTP_SEND_FAILED"));
        return;
      }

      setOtp("");
      setSlotStatus("idle");
      setCooldown(60);
      setInfoMsg(t.auth.resendSuccessToast);
    } catch {
      setError(t.auth.errors.NETWORK_ERROR);
    } finally {
      setResending(false);
    }
  };

  // Theme-consistent CodeSlots palette
  const isDark = theme === "dark";

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
              {successMsg ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-gold-ink)]">
                {t.auth.verifyPageEyebrow}
              </p>
              <h1 className="font-display text-xl font-extrabold uppercase text-[var(--text-primary)]">
                {t.auth.verifyPageTitle}
              </h1>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-[var(--text-secondary)]">
            {t.auth.verifyPageSubtitle}
          </p>

          {queryEmail ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs font-medium text-[var(--text-primary)]">
              <Mail className="h-4 w-4 shrink-0 text-[#D4AF37]" />
              <span className="truncate font-mono">{email}</span>
            </div>
          ) : (
            <div className="mt-3">
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                {t.auth.emailLabel}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.auth.emailPlaceholder}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none"
              />
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="mt-4 flex items-center gap-2 rounded-xl border border-[#D4AF37] bg-[#D4AF37]/15 px-3.5 py-3 text-xs font-semibold text-[var(--accent-gold-ink)]"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#D4AF37]" />
              <span>{successMsg}</span>
            </div>
          )}

          {infoMsg && !successMsg && (
            <div
              role="status"
              className="mt-4 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs text-[var(--text-primary)]"
            >
              {infoMsg}
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

          <form onSubmit={handleVerifySubmit} className="mt-6 space-y-5">
            <div className="flex flex-col items-center">
              <CodeSlots
                length={6}
                value={otp}
                status={slotStatus}
                onChange={(nextCode) => {
                  setOtp(nextCode);
                  if (slotStatus !== "idle") setSlotStatus("idle");
                  if (error) setError(null);
                }}
                onComplete={async (code) => {
                  await verifyCode(code);
                }}
                accentColor={isDark ? "#f5f5f5" : "#09090B"}
                inkColor={isDark ? "#f5f5f5" : "#09090B"}
                slotColor={isDark ? "#27272a" : "#f4f4f5"}
                digitColor={isDark ? "#18181b" : "#ffffff"}
                dangerColor="#ff3b30"
                slotSize={44}
                gap={8}
                radius={12}
                bounce={0.2}
                settle={0.3}
                rise={8}
                cascade={20}
                mask={false}
                caret
                outcome="accept"
                disabled={verifying || Boolean(successMsg)}
              />
            </div>

            <button
              type="submit"
              disabled={verifying || otp.length !== 6 || Boolean(successMsg)}
              className="w-full rounded-xl bg-[#D4AF37] py-3 text-xs font-semibold uppercase tracking-wider text-[#09090B] transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {verifying ? t.auth.verifying : t.auth.verifyButton}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between border-t border-[var(--border-subtle)] pt-4 text-xs">
            <button
              type="button"
              disabled={cooldown > 0 || resending || Boolean(successMsg)}
              onClick={handleResendOtp}
              className="inline-flex items-center gap-1.5 font-medium text-[var(--accent-gold-ink)] transition-opacity hover:underline disabled:opacity-45"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`}
              />
              <span>
                {cooldown > 0
                  ? `${t.auth.resendIn} ${cooldown}s`
                  : t.auth.resendBtn}
              </span>
            </button>

            <Link
              href="/"
              className="text-[var(--text-secondary)] hover:text-[#D4AF37]"
            >
              {t.auth.backToHome}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
