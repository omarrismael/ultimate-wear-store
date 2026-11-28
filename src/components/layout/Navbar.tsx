"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Globe,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  ShoppingBag,
  Sun,
  UserCheck,
  User as UserIcon,
  X,
} from "lucide-react";
import { ADMIN_PORTAL_PATH, PRIMARY_ADMIN_EMAIL } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/context";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useCart } from "@/components/providers/CartProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLenis } from "@/components/providers/LenisProvider";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ReturnPolicyModal } from "@/components/layout/ReturnPolicyModal";

export function Navbar() {
  const pathname = usePathname();
  const { locale, t, toggleLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { totalItems, openCart, toastMessage } = useCart();
  const { user, profile, openAuthModal, signOut } = useAuth();
  const { scrollTo } = useLenis();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  const isHome = pathname === "/";
  const isAdmin = Boolean(
    profile?.is_admin ||
      (user?.email && user.email.toLowerCase() === PRIMARY_ADMIN_EMAIL)
  );

  const handleSectionLink = (
    e: React.MouseEvent<HTMLAnchorElement>,
    selector: string
  ) => {
    setMobileMenuOpen(false);
    if (!isHome) return;
    e.preventDefault();
    scrollTo(selector, -68);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-glass)] backdrop-blur-md transition-colors duration-300">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-2 px-3 min-[400px]:px-4 sm:px-6 lg:px-10">
        {/* Left: Brand */}
        <Link
          href="/"
          className="flex shrink-0 items-center transition-opacity hover:opacity-85"
        >
          <BrandLogo height={24} className="!h-[20px] min-[400px]:!h-[22px] sm:!h-[26px]" />
        </Link>

        {/* Center: Minimal Smooth Navigation Links */}
        <nav className="font-display hidden items-center gap-5 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)] md:flex lg:gap-7 lg:tracking-[0.22em]">
          <Link
            href="/#showcase"
            onClick={(e) => handleSectionLink(e, "#showcase")}
            className="transition-colors duration-200 hover:text-[#D4AF37]"
          >
            {t.nav.showcase}
          </Link>
          <Link
            href="/#shop"
            onClick={(e) => handleSectionLink(e, "#shop")}
            className="transition-colors duration-200 hover:text-[#D4AF37]"
          >
            {t.nav.shop}
          </Link>
          <Link
            href="/#about"
            onClick={(e) => handleSectionLink(e, "#about")}
            className="transition-colors duration-200 hover:text-[#D4AF37]"
          >
            {t.nav.about}
          </Link>
          <button
            type="button"
            onClick={() => setPolicyOpen(true)}
            className="uppercase transition-colors duration-200 hover:text-[#D4AF37]"
          >
            {t.nav.policy}
          </button>
          {user && (
            <Link
              href="/orders"
              className="transition-colors duration-200 hover:text-[#D4AF37]"
            >
              {t.nav.orders}
            </Link>
          )}
          {isAdmin && (
            <Link
              href={ADMIN_PORTAL_PATH}
              className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/60 bg-[#D4AF37]/10 px-3 py-1 text-[10px] font-semibold text-[#D4AF37] transition-colors hover:bg-[#D4AF37] hover:text-[#09090B]"
            >
              <ShieldCheck className="h-3 w-3" />
              {t.nav.admin}
            </Link>
          )}
        </nav>

        {/* Right: Soft Rounded Control Pills */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle Light/Dark Mode"
            title={theme === "light" ? t.nav.darkMode : t.nav.lightMode}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[10px] font-medium tracking-wider text-[var(--text-primary)] transition-all duration-200 hover:border-[#D4AF37] sm:px-2.5 sm:text-[11px]"
          >
            {theme === "light" ? (
              <Moon className="h-3.5 w-3.5 text-[#D4AF37]" />
            ) : (
              <Sun className="h-3.5 w-3.5 text-[#D4AF37]" />
            )}
            <span className="hidden lg:inline">
              {theme === "light" ? t.nav.darkMode : t.nav.lightMode}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleLocale}
            aria-label="Switch Language"
            className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[10px] font-medium tracking-wider text-[var(--text-primary)] transition-all duration-200 hover:border-[#D4AF37] sm:gap-1.5 sm:px-2.5 sm:text-[11px]"
          >
            <Globe className="h-3.5 w-3.5 text-[#D4AF37]" />
            <span>{locale === "en" ? "AR" : "EN"}</span>
          </button>

          {user ? (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                onClick={openAuthModal}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[11px] font-medium text-[var(--text-primary)] transition-all duration-200 hover:border-[#D4AF37] sm:px-2.5"
                title={user.email}
              >
                <UserCheck className="h-3.5 w-3.5 text-[#D4AF37]" />
                <span className="hidden max-w-[96px] truncate sm:inline">
                  {profile?.phone || user.email}
                </span>
              </button>
              <button
                type="button"
                onClick={signOut}
                aria-label={t.nav.signOut}
                title={t.nav.signOut}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-secondary)] transition-all duration-200 hover:border-[#D4AF37] hover:text-[var(--text-primary)]"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[11px] font-medium text-[var(--text-primary)] transition-all duration-200 hover:border-[#D4AF37] sm:px-3"
            >
              <UserIcon className="h-3.5 w-3.5 text-[#D4AF37]" />
              <span className="hidden sm:inline">{t.nav.signIn}</span>
            </button>
          )}

          <button
            id="nav-cart-trigger"
            type="button"
            onClick={openCart}
            className="relative inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37] bg-[#D4AF37] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#09090B] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97] sm:px-3 sm:text-[11px]"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.nav.cart}</span>
            <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#09090B] px-1 text-[10px] font-bold text-[#D4AF37]">
              {totalItems}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle Menu"
            aria-expanded={mobileMenuOpen}
            className="rounded-xl border border-[var(--border-subtle)] p-1.5 text-[var(--text-primary)] transition-colors hover:border-[#D4AF37] md:hidden"
          >
            {mobileMenuOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav className="animate-fade-up border-t border-[var(--border-subtle)] bg-[var(--bg-page)] px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            <Link
              href="/#showcase"
              onClick={(e) => handleSectionLink(e, "#showcase")}
              className="rounded-lg px-2 py-1.5 hover:bg-[var(--bg-elevated)] hover:text-[#D4AF37]"
            >
              {t.nav.showcase}
            </Link>
            <Link
              href="/#shop"
              onClick={(e) => handleSectionLink(e, "#shop")}
              className="rounded-lg px-2 py-1.5 hover:bg-[var(--bg-elevated)] hover:text-[#D4AF37]"
            >
              {t.nav.shop}
            </Link>
            <Link
              href="/#about"
              onClick={(e) => handleSectionLink(e, "#about")}
              className="rounded-lg px-2 py-1.5 hover:bg-[var(--bg-elevated)] hover:text-[#D4AF37]"
            >
              {t.nav.about}
            </Link>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setPolicyOpen(true);
              }}
              className="rounded-lg px-2 py-1.5 text-start uppercase hover:bg-[var(--bg-elevated)] hover:text-[#D4AF37]"
            >
              {t.nav.policy}
            </button>
            {user && (
              <Link
                href="/orders"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-2 py-1.5 hover:bg-[var(--bg-elevated)] hover:text-[#D4AF37]"
              >
                {t.nav.orders}
              </Link>
            )}
            {isAdmin && (
              <Link
                href={ADMIN_PORTAL_PATH}
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#D4AF37]/60 bg-[#D4AF37]/10 px-3 py-1.5 text-[#D4AF37]"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {t.nav.admin}
              </Link>
            )}
          </div>
        </nav>
      )}

      {toastMessage && (
        <div className="border-t border-[#D4AF37]/40 bg-[var(--bg-surface)] px-4 py-1.5 text-center text-[11px] font-medium tracking-wider text-[var(--accent-gold-ink)]">
          {toastMessage}
        </div>
      )}

      <ReturnPolicyModal
        isOpen={policyOpen}
        onClose={() => setPolicyOpen(false)}
      />
    </header>
  );
}
