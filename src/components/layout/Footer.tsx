"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import {
  BRAND_DOMAIN,
  BRAND_NAME,
  DEVELOPER_LINKEDIN,
  DEVELOPER_NAME,
} from "@/lib/constants";
import { BrandLogo } from "@/components/brand/BrandLogo";

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-page)] py-12 transition-colors duration-300">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
          <div>
            <BrandLogo height={24} />
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              {BRAND_DOMAIN} · {t.tagline}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            <Link href="/#showcase" className="transition-colors hover:text-[#D4AF37]">
              {t.nav.showcase}
            </Link>
            <Link href="/#shop" className="transition-colors hover:text-[#D4AF37]">
              {t.nav.shop}
            </Link>
            <Link href="/#about" className="transition-colors hover:text-[#D4AF37]">
              {t.nav.about}
            </Link>
            <Link href="/orders" className="transition-colors hover:text-[#D4AF37]">
              {t.nav.orders}
            </Link>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-[var(--border-subtle)] pt-6 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} {BRAND_NAME}. {t.footer.rights}
          </p>
          <a
            href={DEVELOPER_LINKEDIN}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-[var(--text-primary)] transition-colors hover:text-[#D4AF37]"
          >
            <span>
              {t.footer.creditPrefix} {DEVELOPER_NAME}
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-[#D4AF37]" />
          </a>
        </div>
      </div>
    </footer>
  );
}
