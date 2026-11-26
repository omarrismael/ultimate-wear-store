"use client";

import React, { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Layers,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { StoreSection, StoreSettings } from "@/types";
import { useI18n } from "@/lib/i18n/context";

interface SectionsManagerTabProps {
  sections: StoreSection[];
  settings: StoreSettings;
  syncedWithDatabase: boolean;
  onSectionsChange: (next: StoreSection[]) => void;
  onSettingsChange: (next: StoreSettings) => void;
  onSaveAll: () => Promise<void>;
  saving: boolean;
  savedNotice: string | null;
}

export function SectionsManagerTab({
  sections,
  settings,
  syncedWithDatabase,
  onSectionsChange,
  onSettingsChange,
  onSaveAll,
  saving,
  savedNotice,
}: SectionsManagerTabProps) {
  const { locale, t } = useI18n();
  const [newLabelEn, setNewLabelEn] = useState("");
  const [newLabelAr, setNewLabelAr] = useState("");
  const [newSlug, setNewSlug] = useState("");

  const addSection = () => {
    const cleanEn = newLabelEn.trim();
    const cleanAr = newLabelAr.trim() || cleanEn;
    if (!cleanEn) return;

    const generatedSlug = (
      newSlug.trim() ||
      cleanEn
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    ).slice(0, 38);

    if (!generatedSlug || generatedSlug.length < 2) return;
    if (sections.some((s) => s.slug === generatedSlug)) return;

    onSectionsChange([
      ...sections,
      {
        slug: generatedSlug,
        label_en: cleanEn,
        label_ar: cleanAr,
        sort_order: sections.length + 1,
        is_active: true,
        show_in_hero: true,
      },
    ]);
    setNewLabelEn("");
    setNewLabelAr("");
    setNewSlug("");
  };

  const updateSection = (slug: string, patch: Partial<StoreSection>) => {
    onSectionsChange(
      sections.map((sec) => (sec.slug === slug ? { ...sec, ...patch } : sec))
    );
  };

  const moveSection = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const copy = [...sections];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    onSectionsChange(
      copy.map((s, idx) => ({ ...s, sort_order: idx + 1 }))
    );
  };

  const removeSection = (slug: string) => {
    if (sections.length <= 1) return;
    onSectionsChange(sections.filter((s) => s.slug !== slug));
  };

  return (
    <div className="mt-6 space-y-6">
      {!syncedWithDatabase && (
        <div className="rounded-2xl border border-[#D4AF37]/40 bg-[#D4AF37]/8 px-4 py-3 text-xs text-[var(--accent-gold-ink)]">
          {locale === "ar"
            ? "ملحوظة: التعديلات شغالة ومحفوظة على السيرفر حالياً. لربطها نهائياً بقاعدة بيانات Supabase، شغّل التحديث الموجود في supabase/schema.sql."
            : "Note: Sections & skins work locally on the server right now. To sync permanently into Supabase Postgres tables, run the updated supabase/schema.sql."}
        </div>
      )}

      {/* 1. Hoodie Sections / Categories */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#D4AF37]" />
            <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
              {locale === "ar"
                ? "سكشنز الهوديز والتصنيفات"
                : "Hoodie Sections & Categories"}
            </h2>
          </div>
          <span className="font-mono text-xs text-[var(--text-muted)]">
            {sections.length} {locale === "ar" ? "سكشن" : "sections"}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {sections.map((sec, idx) => (
            <div
              key={sec.slug}
              className="flex flex-col gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] p-3 sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(idx, -1)}
                  disabled={idx === 0}
                  className="rounded-lg border border-[var(--border-subtle)] p-1.5 text-[var(--text-secondary)] hover:border-[#D4AF37] disabled:opacity-30"
                  title="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(idx, 1)}
                  disabled={idx === sections.length - 1}
                  className="rounded-lg border border-[var(--border-subtle)] p-1.5 text-[var(--text-secondary)] hover:border-[#D4AF37] disabled:opacity-30"
                  title="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <span className="ms-1 rounded-lg bg-[var(--bg-surface)] px-2 py-1 font-mono text-[10px] text-[var(--text-muted)]">
                  {sec.slug}
                </span>
              </div>

              <div className="grid flex-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={sec.label_en}
                  onChange={(e) =>
                    updateSection(sec.slug, { label_en: e.target.value })
                  }
                  placeholder="Section Name (EN)"
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
                />
                <input
                  type="text"
                  dir="rtl"
                  value={sec.label_ar}
                  onChange={(e) =>
                    updateSection(sec.slug, { label_ar: e.target.value })
                  }
                  placeholder="اسم السكشن (AR)"
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex cursor-pointer items-center gap-1.5 text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={sec.is_active}
                    onChange={(e) =>
                      updateSection(sec.slug, { is_active: e.target.checked })
                    }
                    className="accent-[#D4AF37]"
                  />
                  {locale === "ar" ? "ظاهر" : "Active"}
                </label>

                <label className="flex cursor-pointer items-center gap-1.5 text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={sec.show_in_hero}
                    onChange={(e) =>
                      updateSection(sec.slug, {
                        show_in_hero: e.target.checked,
                      })
                    }
                    className="accent-[#D4AF37]"
                  />
                  {locale === "ar" ? "بالهيرو" : "In Hero"}
                </label>

                <button
                  type="button"
                  disabled={sections.length <= 1}
                  onClick={() => removeSection(sec.slug)}
                  className="rounded-lg border border-[var(--border-subtle)] p-1.5 text-[var(--text-muted)] hover:border-red-500/60 hover:text-red-400 disabled:opacity-30"
                  title="Remove section"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add New Section Bar */}
        <div className="mt-4 grid gap-2.5 rounded-xl border border-dashed border-[#D4AF37]/50 bg-[#D4AF37]/5 p-3 sm:grid-cols-4">
          <input
            type="text"
            value={newLabelEn}
            onChange={(e) => setNewLabelEn(e.target.value)}
            placeholder={
              locale === "ar" ? "اسم السكشن بالإنجليزي" : "New Section (EN)"
            }
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
          />
          <input
            type="text"
            dir="rtl"
            value={newLabelAr}
            onChange={(e) => setNewLabelAr(e.target.value)}
            placeholder={
              locale === "ar" ? "اسم السكشن بالعربي" : "New Section (AR)"
            }
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
          />
          <input
            type="text"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            placeholder="slug (optional e.g. winter-drop)"
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
          />
          <button
            type="button"
            onClick={addSection}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-[#09090B]"
          >
            <Plus className="h-3.5 w-3.5" />
            {locale === "ar" ? "إضافة سكشن" : "Add Section"}
          </button>
        </div>
      </div>

      {/* 2. Hero & Shop Headings Copy */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-6">
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-4">
          <Sparkles className="h-4 w-4 text-[#D4AF37]" />
          <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
            {locale === "ar"
              ? "عناوين الهيرو وسكشن المتجر"
              : "Hero & Shop Section Headings"}
          </h2>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Hero Top Badge (EN)
            </label>
            <input
              type="text"
              value={settings.hero_badge_en}
              onChange={(e) =>
                onSettingsChange({ ...settings, hero_badge_en: e.target.value })
              }
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Hero Top Badge (AR)
            </label>
            <input
              type="text"
              dir="rtl"
              value={settings.hero_badge_ar}
              onChange={(e) =>
                onSettingsChange({ ...settings, hero_badge_ar: e.target.value })
              }
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Hero Headline (EN)
            </label>
            <input
              type="text"
              value={settings.hero_headline_en}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  hero_headline_en: e.target.value,
                })
              }
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Hero Headline (AR)
            </label>
            <input
              type="text"
              dir="rtl"
              value={settings.hero_headline_ar}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  hero_headline_ar: e.target.value,
                })
              }
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Hero Subheadline (EN)
            </label>
            <input
              type="text"
              value={settings.hero_subheadline_en}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  hero_subheadline_en: e.target.value,
                })
              }
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Hero Subheadline (AR)
            </label>
            <input
              type="text"
              dir="rtl"
              value={settings.hero_subheadline_ar}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  hero_subheadline_ar: e.target.value,
                })
              }
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Featured Menu Title (EN)
            </label>
            <input
              type="text"
              value={settings.featured_title_en}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  featured_title_en: e.target.value,
                })
              }
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Featured Menu Title (AR)
            </label>
            <input
              type="text"
              dir="rtl"
              value={settings.featured_title_ar}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  featured_title_ar: e.target.value,
                })
              }
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Shop Section Title (EN)
            </label>
            <input
              type="text"
              value={settings.shop_title_en}
              onChange={(e) =>
                onSettingsChange({ ...settings, shop_title_en: e.target.value })
              }
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Shop Section Title (AR)
            </label>
            <input
              type="text"
              dir="rtl"
              value={settings.shop_title_ar}
              onChange={(e) =>
                onSettingsChange({ ...settings, shop_title_ar: e.target.value })
              }
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Shop Subtitle (EN)
            </label>
            <input
              type="text"
              value={settings.shop_subtitle_en}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  shop_subtitle_en: e.target.value,
                })
              }
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Shop Subtitle (AR)
            </label>
            <input
              type="text"
              dir="rtl"
              value={settings.shop_subtitle_ar}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  shop_subtitle_ar: e.target.value,
                })
              }
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {savedNotice ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <Check className="h-4 w-4" />
            {savedNotice}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={saving}
          onClick={onSaveAll}
          className="rounded-xl bg-[#D4AF37] px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#09090B] disabled:opacity-50"
        >
          {saving ? "Saving..." : t.admin.saveSections}
        </button>
      </div>
    </div>
  );
}
