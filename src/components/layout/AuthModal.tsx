"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User as UserIcon,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLenis } from "@/components/providers/LenisProvider";
import { EGYPT_MOBILE_REGEX } from "@/lib/security/validation";
import CodeSlots, { type CodeSlotsStatus } from "@/components/react-bits/CodeSlots";
import { BrandLogo } from "@/components/brand/BrandLogo";

type AuthMode = "signin" | "register";
type SignInMethod = "password" | "otp";
type AuthStep = "credentials" | "otp" | "phone" | "forgot";

export function AuthModal() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();
  const { theme } = useTheme();
  const {
    user,
    profile,
    isAuthModalOpen,
    closeAuthModal,
    refreshProfile,
    signOut,
  } = useAuth();
  const { stopScroll, startScroll } = useLenis();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [signInMethod, setSignInMethod] = useState<SignInMethod>("password");
  const [step, setStep] = useState<AuthStep>("credentials");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [slotStatus, setSlotStatus] = useState<CodeSlotsStatus>("idle");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (isAuthModalOpen) {
      stopScroll();
      const meta = (user?.user_metadata || {}) as Record<string, unknown>;
      const resolvedName =
        profile?.full_name ??
        (typeof meta.full_name === "string" && meta.full_name.trim()
          ? meta.full_name
          : typeof meta.name === "string"
            ? meta.name
            : "");
      const resolvedPhone =
        profile?.phone ??
        (typeof meta.phone === "string" ? meta.phone : "");

      if (user) {
        setStep("phone");
        setFullName(resolvedName);
        setPhone(resolvedPhone);
      } else {
        setStep("credentials");
      }
      setError(null);
      setResetSent(false);
      setSlotStatus("idle");
    } else {
      startScroll();
    }
  }, [isAuthModalOpen, user, profile, stopScroll, startScroll]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!isAuthModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAuthModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const isDark = theme === "dark";

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2) {
      setError(t.auth.fullNameLabel);
      return;
    }
    if (!EGYPT_MOBILE_REGEX.test(cleanPhone)) {
      setError(t.auth.errors.INVALID_PHONE);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          fullName: cleanName,
          phone: cleanPhone,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.retryAfterSeconds) setCooldown(data.retryAfterSeconds);
        setError(resolveAuthError(data, "GENERIC"));
        return;
      }

      // Redirect to dedicated Verify Email page (carrying name+phone so user is NEVER asked again)
      try {
        window.sessionStorage.setItem(
          "ultimate_pending_verify_email",
          cleanEmail
        );
        window.sessionStorage.setItem(
          "ultimate_pending_verify_profile",
          JSON.stringify({
            email: cleanEmail,
            fullName: cleanName,
            phone: cleanPhone,
          })
        );
      } catch {
        // Ignore storage error
      }
      closeAuthModal();
      router.push(
        `/verify-email?email=${encodeURIComponent(cleanEmail)}`
      );
    } catch {
      setError(t.auth.errors.NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.requiresVerification) {
          closeAuthModal();
          router.push(
            `/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`
          );
          return;
        }
        if (data?.retryAfterSeconds) setCooldown(data.retryAfterSeconds);
        setError(resolveAuthError(data, "INVALID_CREDENTIALS"));
        return;
      }

      const refreshed = await refreshProfile();
      if (refreshed?.phone) {
        closeAuthModal();
        router.refresh();
      } else {
        setStep("phone");
      }
    } catch {
      setError(t.auth.errors.NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "login" }),
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
      setStep("otp");
    } catch {
      setError(t.auth.errors.NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  };

  const verifyOtpCode = async (code: string): Promise<boolean> => {
    if (code.length !== 6 || busy) return false;
    setError(null);
    setBusy(true);
    setSlotStatus("verifying");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: code, flow: "login" }),
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
      const refreshed = await refreshProfile();
      if (refreshed?.phone) {
        window.setTimeout(() => {
          closeAuthModal();
          router.refresh();
        }, 450);
      } else {
        window.setTimeout(() => setStep("phone"), 450);
      }
      return true;
    } catch {
      setSlotStatus("error");
      setError(t.auth.errors.NETWORK_ERROR);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError(t.auth.errors.MISSING_CODE);
      setSlotStatus("error");
      return;
    }
    await verifyOtpCode(otp);
  };

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EGYPT_MOBILE_REGEX.test(phone.trim())) {
      setError(t.auth.errors.INVALID_PHONE);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/profile/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          fullName: fullName.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(resolveAuthError(data, "GENERIC"));
        return;
      }
      await refreshProfile();
      closeAuthModal();
    } catch {
      setError(t.auth.errors.NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (oauthErr) {
        setError(oauthErr.message);
        setGoogleBusy(false);
      }
    } catch {
      setError(t.auth.errors.NETWORK_ERROR);
      setGoogleBusy(false);
    }
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError(t.auth.emailPlaceholder);
      return;
    }

    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        { redirectTo }
      );
      if (resetErr) {
        setError(resetErr.message);
        return;
      }
      setResetSent(true);
    } catch {
      setError(t.auth.errors.NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-md sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={closeAuthModal}
    >
      <div
        data-lenis-prevent
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#D4AF37]/45 bg-[var(--bg-surface)] p-4 shadow-2xl sm:p-6"
      >
        <button
          type="button"
          onClick={closeAuthModal}
          aria-label="Close"
          className="absolute end-4 top-4 rounded-full border border-[var(--border-subtle)] p-1.5 text-[var(--text-secondary)] transition-colors hover:border-[#D4AF37] hover:text-[#D4AF37]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5">
          <div className="mb-4 flex justify-center">
            <BrandLogo height={28} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/60 bg-[#D4AF37]/10 text-[#D4AF37]">
              {step === "phone" ? (
                <Phone className="h-5 w-5" />
              ) : step === "forgot" ? (
                <KeyRound className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="font-display text-lg font-extrabold uppercase text-[var(--text-primary)]">
                {step === "phone"
                  ? profile?.phone
                    ? t.auth.accountTitle
                    : t.auth.phoneTitle
                  : step === "forgot"
                    ? t.auth.forgotTitle
                    : mode === "register"
                      ? t.auth.registerTitle
                      : t.auth.title}
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                {step === "phone"
                  ? profile?.phone
                    ? t.auth.accountSubtitle
                    : t.auth.phoneSubtitle
                  : step === "forgot"
                    ? t.auth.forgotSubtitle
                    : mode === "register"
                      ? t.auth.registerSubtitle
                      : t.auth.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Sign In / Register Mode Switcher + Continue with Google */}
        {step === "credentials" && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                }}
                className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                  mode === "signin"
                    ? "bg-[#D4AF37] text-[#09090B]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t.auth.tabSignIn}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
                className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                  mode === "register"
                    ? "bg-[#D4AF37] text-[#09090B]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t.auth.tabRegister}
              </button>
            </div>

            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={busy || googleBusy}
              className="mb-3.5 flex w-full items-center justify-center gap-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] py-2.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[#D4AF37] disabled:opacity-50"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3.4 14.7 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12S6.8 21.5 12 21.5c6.9 0 9.1-4.8 9.1-7.3 0-.5-.1-.9-.1-1.3H12z"
                />
                <path
                  fill="#34A853"
                  d="M3.7 7.6l3.2 2.3C7.8 8 9.7 6.5 12 6.5c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3.4 14.7 2.5 12 2.5 8.2 2.5 5 4.7 3.7 7.6z"
                />
                <path
                  fill="#FBBC05"
                  d="M12 21.5c2.6 0 4.8-.9 6.4-2.4l-3-2.5c-.8.6-1.9 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1l-3.2 2.5c1.4 3.2 4.8 5.5 8.8 5.5z"
                />
                <path
                  fill="#4285F4"
                  d="M21.1 14.2c0-.5-.1-.9-.1-1.3H12v3.9h5.5c-.3 1.4-1.1 2.4-2.1 3.1l3 2.5c1.8-1.6 2.7-4 2.7-8.2z"
                />
              </svg>
              <span>{t.auth.continueWithGoogle}</span>
            </button>

            <div className="mb-3.5 flex items-center gap-3 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
              <span className="h-px flex-1 bg-[var(--border-subtle)]" />
              <span>{t.auth.orDivider}</span>
              <span className="h-px flex-1 bg-[var(--border-subtle)]" />
            </div>
          </>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-[#ff3b30]/50 bg-[#ff3b30]/10 px-3.5 py-2.5 text-xs text-[#ff3b30]">
            {error}
          </div>
        )}

        {/* REGISTER WITH FULL NAME + PHONE + EMAIL + PASSWORD -> SINGLE STEP */}
        {step === "credentials" && mode === "register" && (
          <form onSubmit={handleRegister} className="space-y-3.5">
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
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] py-3 pe-4 ps-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none"
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
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder={t.auth.phonePlaceholder}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] py-3 pe-4 ps-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                {t.auth.emailLabel}
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D4AF37]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.auth.emailPlaceholder}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] py-3 pe-4 ps-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                {t.auth.passwordLabel}
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

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#D4AF37] py-3 text-xs font-semibold uppercase tracking-wider text-[#09090B] transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {busy ? t.auth.registering : t.auth.registerSubmit}
            </button>
          </form>
        )}

        {/* SIGN IN (PASSWORD OR 6-DIGIT OTP) */}
        {step === "credentials" && mode === "signin" && (
          <div className="space-y-4">
            <div className="flex items-center justify-end gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setSignInMethod("password");
                  setError(null);
                }}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  signInMethod === "password"
                    ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t.auth.modePassword}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSignInMethod("otp");
                  setError(null);
                }}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  signInMethod === "otp"
                    ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t.auth.modeOtp}
              </button>
            </div>

            {signInMethod === "password" ? (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    {t.auth.emailLabel}
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D4AF37]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.auth.emailPlaceholder}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] py-3 pe-4 ps-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-xs font-medium text-[var(--text-secondary)]">
                      {t.auth.passwordLabel}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setResetSent(false);
                        setStep("forgot");
                      }}
                      className="text-[11px] font-medium text-[var(--accent-gold-ink)] hover:underline"
                    >
                      {t.auth.forgotPassword}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D4AF37]" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.auth.passwordPlaceholder}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] py-3 pe-4 ps-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-[#D4AF37] py-3 text-xs font-semibold uppercase tracking-wider text-[#09090B] transition-opacity hover:opacity-95 disabled:opacity-50"
                >
                  {busy ? t.auth.loggingIn : t.auth.loginSubmit}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    {t.auth.emailLabel}
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D4AF37]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.auth.emailPlaceholder}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] py-3 pe-4 ps-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={busy || cooldown > 0}
                  className="w-full rounded-xl bg-[#D4AF37] py-3 text-xs font-semibold uppercase tracking-wider text-[#09090B] transition-opacity hover:opacity-95 disabled:opacity-50"
                >
                  {busy
                    ? t.auth.sending
                    : cooldown > 0
                      ? `${t.auth.resendIn} ${cooldown}s`
                      : t.auth.sendOtp}
                </button>
              </form>
            )}
          </div>
        )}

        {/* FORGOT PASSWORD STEP */}
        {step === "forgot" && (
          <form onSubmit={handleSendResetEmail} className="space-y-4">
            {resetSent ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-[#D4AF37]/60 bg-[#D4AF37]/10 p-3.5 text-xs text-[var(--text-primary)]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
                <span>{t.auth.resetSentSuccess}</span>
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  {t.auth.emailLabel}
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D4AF37]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.auth.emailPlaceholder}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] py-3 pe-4 ps-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>
            )}

            {!resetSent && (
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-[#D4AF37] py-3 text-xs font-semibold uppercase tracking-wider text-[#09090B] transition-opacity hover:opacity-95 disabled:opacity-50"
              >
                {busy ? t.auth.sendingReset : t.auth.sendResetLink}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setError(null);
                setResetSent(false);
                setStep("credentials");
              }}
              className="w-full text-center text-xs font-medium text-[var(--accent-gold-ink)] hover:underline"
            >
              {t.auth.backToSignIn}
            </button>
          </form>
        )}

        {/* IN-MODAL CODE SLOTS STEP (FOR OTP SIGN-IN) */}
        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <p className="text-xs text-[var(--text-secondary)]">
              {t.auth.otpSentTo}{" "}
              <span className="font-semibold text-[var(--accent-gold-ink)]">
                {email}
              </span>
            </p>

            <div className="flex flex-col items-center">
              <CodeSlots
                length={6}
                value={otp}
                status={slotStatus}
                onChange={(code) => {
                  setOtp(code);
                  if (slotStatus !== "idle") setSlotStatus("idle");
                  if (error) setError(null);
                }}
                onComplete={async (code) => {
                  await verifyOtpCode(code);
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
                disabled={busy}
              />
            </div>

            <button
              type="submit"
              disabled={busy || otp.length !== 6}
              className="w-full rounded-xl bg-[#D4AF37] py-3 text-xs font-semibold uppercase tracking-wider text-[#09090B] transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {busy ? t.auth.verifying : t.auth.verifyOtp}
            </button>

            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <button
                type="button"
                onClick={() => {
                  setOtp("");
                  setSlotStatus("idle");
                  setStep("credentials");
                }}
                className="hover:text-[#D4AF37]"
              >
                {t.auth.changeEmail}
              </button>
              <button
                type="button"
                disabled={cooldown > 0 || busy}
                onClick={handleSendOtp}
                className="font-medium text-[var(--accent-gold-ink)] disabled:opacity-45"
              >
                {cooldown > 0
                  ? `${t.auth.resendIn} ${cooldown}s`
                  : t.auth.resendBtn}
              </button>
            </div>
          </form>
        )}

        {/* MANDATORY PHONE / WHATSAPP STEP */}
        {step === "phone" && (
          <form onSubmit={handleSavePhone} className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-secondary)]">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#D4AF37]" />
              <span className="truncate">{user?.email}</span>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                {t.auth.fullNameLabel}
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t.auth.fullNamePlaceholder}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                {t.auth.phoneLabel}
              </label>
              <input
                type="tel"
                inputMode="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
                placeholder={t.auth.phonePlaceholder}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#D4AF37] py-3 text-xs font-semibold uppercase tracking-wider text-[#09090B] transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {busy ? t.auth.saving : t.auth.savePhone}
            </button>

            <div className="flex items-center justify-between pt-1 text-xs text-[var(--text-secondary)]">
              <button
                type="button"
                onClick={closeAuthModal}
                className="hover:text-[#D4AF37]"
              >
                {t.auth.backToHome}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  setStep("credentials");
                  setError(null);
                }}
                className="font-medium text-[var(--accent-gold-ink)] hover:underline"
              >
                {t.nav.signOut}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
