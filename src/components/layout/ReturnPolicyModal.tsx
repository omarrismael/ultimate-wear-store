"use client";

import React, { useEffect } from "react";
import { ShieldCheck, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { BrandLogo } from "@/components/brand/BrandLogo";

interface ReturnPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReturnPolicyModal({ isOpen, onClose }: ReturnPolicyModalProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="return-policy-title"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up relative w-full max-w-lg rounded-2xl border border-[#D4AF37]/50 bg-[var(--bg-surface)] p-6 shadow-2xl sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t.policy.close}
          className="absolute end-4 top-4 rounded-full border border-[var(--border-subtle)] p-1.5 text-[var(--text-secondary)] hover:border-[#D4AF37] hover:text-[#D4AF37]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex justify-center">
          <BrandLogo height={24} />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/60 bg-[#D4AF37]/10 text-[#D4AF37]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent-gold-ink)]">
              {t.policy.eyebrow}
            </p>
            <h2
              id="return-policy-title"
              className="font-display text-lg font-extrabold uppercase text-[var(--text-primary)]"
            >
              {t.policy.title}
            </h2>
          </div>
        </div>

        <div className="mt-5 space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] p-4 text-sm leading-relaxed text-[var(--text-primary)]">
          <p>{t.policy.body}</p>
          <p className="border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-secondary)]">
            {t.policy.shippingNote}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-[#D4AF37] py-2.5 text-xs font-bold uppercase tracking-wider text-[#09090B]"
        >
          {t.policy.close}
        </button>
      </div>
    </div>
  );
}
