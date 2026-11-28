"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, MapPin, Search, X } from "lucide-react";
import {
  EGYPT_GOVERNORATES,
  QUICK_GOVERNORATE_KEYS,
  resolveGovernorate,
} from "@/lib/egypt-governorates";
import { useI18n } from "@/lib/i18n/context";

interface GovernorateSelectorProps {
  value: string;
  onChange: (governorateKey: string) => void;
  required?: boolean;
}

export function GovernorateSelector({
  value,
  onChange,
  required = true,
}: GovernorateSelectorProps) {
  const { locale, t } = useI18n();
  const isAr = locale === "ar";
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedGov = useMemo(() => resolveGovernorate(value), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return EGYPT_GOVERNORATES;
    return EGYPT_GOVERNORATES.filter(
      (g) =>
        g.name_en.toLowerCase().includes(q) ||
        g.name_ar.includes(query.trim()) ||
        g.key.includes(q)
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const quickGovernorates = useMemo(
    () =>
      QUICK_GOVERNORATE_KEYS.map((k) =>
        EGYPT_GOVERNORATES.find((g) => g.key === k)
      ).filter((g): g is NonNullable<typeof g> => Boolean(g)),
    []
  );

  return (
    <div ref={wrapRef} className="space-y-2.5">
      {/* Quick-Pick Selector Strip ("Shreeta") */}
      <div className="flex flex-wrap gap-1.5">
        {quickGovernorates.map((gov) => {
          const active = selectedGov?.key === gov.key;
          return (
            <button
              key={gov.key}
              type="button"
              onClick={() => {
                onChange(gov.key);
                setOpen(false);
              }}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                active
                  ? "border-[#D4AF37] bg-[#D4AF37] text-[#09090B]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-page)] text-[var(--text-secondary)] hover:border-[#D4AF37] hover:text-[var(--text-primary)]"
              }`}
            >
              {isAr ? gov.name_ar : gov.name_en}
            </button>
          );
        })}
      </div>

      {/* Searchable 27-Governorate Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-4 py-3 text-start text-sm text-[var(--text-primary)] transition-colors hover:border-[#D4AF37] focus:border-[#D4AF37] focus:outline-none"
        >
          <span className="flex min-w-0 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-[#D4AF37]" />
            <span className="truncate">
              {selectedGov
                ? isAr
                  ? `${selectedGov.name_ar} (${selectedGov.name_en})`
                  : `${selectedGov.name_en} (${selectedGov.name_ar})`
                : t.checkout.cityPlaceholder}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Hidden native input for HTML form validity when required */}
        {required && (
          <input
            type="text"
            tabIndex={-1}
            aria-hidden="true"
            required
            value={selectedGov?.key || ""}
            onChange={() => {}}
            className="pointer-events-none absolute inset-x-0 bottom-0 h-0 w-full opacity-0"
          />
        )}

        {open && (
          <div className="absolute start-0 end-0 top-full z-40 mt-1.5 overflow-hidden rounded-2xl border border-[#D4AF37]/50 bg-[var(--bg-surface)] shadow-2xl">
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.checkout.searchGovernorate}
                className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="max-h-60 overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">
                  {isAr ? "لا توجد محافظة مطابقة" : "No matching governorate"}
                </p>
              ) : (
                filtered.map((gov) => {
                  const active = selectedGov?.key === gov.key;
                  return (
                    <button
                      key={gov.key}
                      type="button"
                      onClick={() => {
                        onChange(gov.key);
                        setQuery("");
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors ${
                        active
                          ? "bg-[#D4AF37] font-semibold text-[#09090B]"
                          : "text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                      }`}
                    >
                      <span>{isAr ? gov.name_ar : gov.name_en}</span>
                      <span
                        className={`text-[11px] ${
                          active ? "text-[#09090B]/80" : "text-[var(--text-muted)]"
                        }`}
                      >
                        {isAr ? gov.name_en : gov.name_ar}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
