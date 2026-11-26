"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Locale } from "@/types";
import { LOCALE_COOKIE_NAME } from "@/lib/constants";
import { dictionaries, type Dictionary } from "./dictionaries";

interface I18nContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  isRtl: boolean;
  t: Dictionary;
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLocale = "en",
  children,
}: {
  initialLocale?: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const saved = window.localStorage.getItem(LOCALE_COOKIE_NAME);
    if (saved === "ar" || saved === "en") {
      setLocaleState(saved);
    }
  }, []);

  useEffect(() => {
    const dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    window.localStorage.setItem(LOCALE_COOKIE_NAME, locale);
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  }, [locale]);

  const setLocale = (next: Locale) => setLocaleState(next);
  const toggleLocale = () => setLocaleState((prev) => (prev === "en" ? "ar" : "en"));

  return (
    <I18nContext.Provider
      value={{
        locale,
        dir: locale === "ar" ? "rtl" : "ltr",
        isRtl: locale === "ar",
        t: dictionaries[locale],
        setLocale,
        toggleLocale,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
