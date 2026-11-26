"use client";

import React from "react";
import type { Locale } from "@/types";
import { I18nProvider } from "@/lib/i18n/context";
import { ThemeProvider, type ThemeMode } from "./ThemeProvider";
import { AuthProvider } from "./AuthProvider";
import { CartProvider } from "./CartProvider";
import { LenisProvider } from "./LenisProvider";
import { AuthModal } from "@/components/layout/AuthModal";
import { CartDrawer } from "@/components/storefront/CartDrawer";

export function AppProviders({
  initialLocale,
  initialTheme = "light",
  children,
}: {
  initialLocale: Locale;
  initialTheme?: ThemeMode;
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider initialTheme={initialTheme}>
      <I18nProvider initialLocale={initialLocale}>
        <AuthProvider>
          <CartProvider>
            <LenisProvider>
              {children}
              <CartDrawer />
              <AuthModal />
            </LenisProvider>
          </CartProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
