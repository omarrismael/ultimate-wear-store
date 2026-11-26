import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { LOCALE_COOKIE_NAME, THEME_COOKIE_NAME } from "@/lib/constants";
import type { Locale } from "@/types";
import { AppProviders } from "@/components/providers/AppProviders";
import type { ThemeMode } from "@/components/providers/ThemeProvider";

export const metadata: Metadata = {
  title: "ULTIMATE — Luxury Heavyweight Hoodies | ultimate-wear.com",
  description:
    "Bilingual Egyptian luxury streetwear brand. 520GSM heavyweight hoodies sculpted in deep black, crisp white, and gold.",
  metadataBase: new URL("https://ultimate-wear.com"),
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const initialLocale: Locale = savedLocale === "ar" ? "ar" : "en";
  const savedTheme = cookieStore.get(THEME_COOKIE_NAME)?.value;
  const initialTheme: ThemeMode = savedTheme === "dark" ? "dark" : "light";

  return (
    <html
      lang={initialLocale}
      dir={initialLocale === "ar" ? "rtl" : "ltr"}
      data-theme={initialTheme}
      style={{ colorScheme: initialTheme }}
      suppressHydrationWarning
    >
      <head>
        {/* Multi-Font Editorial Typography: Syne + Cairo (Display), Cormorant Garamond + Amiri (Editorial Serif), Plus Jakarta Sans + IBM Plex Sans Arabic (Body), JetBrains Mono (Telemetry) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Cairo:wght@500;600;700;800&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,400;1,600&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Syne:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[var(--bg-page)] font-sans text-[var(--text-primary)] antialiased transition-colors duration-300">
        <AppProviders initialLocale={initialLocale} initialTheme={initialTheme}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
