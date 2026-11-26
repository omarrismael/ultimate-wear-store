"use client";

import React from "react";
import { ArrowUpRight } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { DEVELOPER_LINKEDIN, DEVELOPER_NAME } from "@/lib/constants";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { BrandLogo } from "@/components/brand/BrandLogo";

export function AboutSection() {
  const { t } = useI18n();

  return (
    <section
      id="about"
      className="bg-[var(--bg-page)] py-12 transition-colors duration-300 sm:py-16 md:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-[1440px] px-3 min-[400px]:px-4 sm:px-6 md:px-8 lg:px-10">
        <div className="flex flex-col justify-between gap-6 sm:gap-8 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <BrandLogo height={22} className="mb-1 opacity-80" />
            <h2 className="font-display mt-3 text-3xl font-extrabold uppercase text-[var(--text-primary)] min-[400px]:text-4xl sm:text-5xl">
              {t.about.title}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
              {t.about.body}
            </p>
          </div>

          <SpotlightCard className="w-fit rounded-2xl px-6 py-4">
            <a
              href={DEVELOPER_LINKEDIN}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent-gold-ink)] transition-colors hover:underline"
            >
              <span>
                {t.about.creditPrefix} {DEVELOPER_NAME}
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0" />
            </a>
          </SpotlightCard>
        </div>
      </div>
    </section>
  );
}
