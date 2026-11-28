"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { Palette, Plus, Trash2, Upload, X } from "lucide-react";
import type {
  ProductColorVariant,
  ProductSize,
  StoreSection,
} from "@/types";
import { DEFAULT_COLOR_PRESETS, PRODUCT_SIZES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/context";
import { createClient } from "@/lib/supabase/client";

export interface ProductFormState {
  id?: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  category: string;
  price_egp: string;
  compare_at_price_egp: string;
  sizes: ProductSize[];
  size_stock: Partial<Record<ProductSize, number>>;
  image_url: string;
  colors: ProductColorVariant[];
  is_featured: boolean;
  in_stock: boolean;
}

interface ProductEditorModalProps {
  isOpen: boolean;
  form: ProductFormState;
  sections: StoreSection[];
  saving: boolean;
  error: string | null;
  onChange: React.Dispatch<React.SetStateAction<ProductFormState>>;
  onError: (msg: string | null) => void;
  onSave: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function ProductEditorModal({
  isOpen,
  form,
  sections,
  saving,
  error,
  onChange,
  onError,
  onSave,
  onClose,
}: ProductEditorModalProps) {
  const { locale, t } = useI18n();
  const supabase = useMemo(() => createClient(), []);
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const [previewColorIdx, setPreviewColorIdx] = useState<number | null>(null);

  if (!isOpen) return null;

  const uploadProductPhoto = async (file: File): Promise<string | null> => {
    onError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      onError("Image must be PNG, JPG, or WEBP.");
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError("Image must be 5MB or smaller.");
      return null;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "webp";
    const fileName = `hoodie-${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("product-images")
      .upload(fileName, file, { contentType: file.type, upsert: false });

    if (uploadErr) {
      onError(uploadErr.message);
      return null;
    }

    const { data: pub } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);
    return pub.publicUrl;
  };

  const handleMainImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingTarget("main");
    try {
      const url = await uploadProductPhoto(file);
      if (url) onChange((prev) => ({ ...prev, image_url: url }));
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleColorSlotUpload = async (
    variantId: string,
    slot: "front_image_url" | "back_image_url" | "detail_image_url" | "gallery",
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingTarget(`${variantId}:${slot}`);
    try {
      const url = await uploadProductPhoto(file);
      if (url) {
        onChange((prev) => ({
          ...prev,
          colors: prev.colors.map((c) => {
            if (c.id !== variantId) return c;
            if (slot === "gallery") {
              return {
                ...c,
                gallery_urls: [...(c.gallery_urls || []), url].slice(0, 6),
              };
            }
            return {
              ...c,
              [slot]: url,
              ...(slot === "front_image_url" ? { image_url: url } : {}),
            };
          }),
        }));
      }
    } finally {
      setUploadingTarget(null);
    }
  };

  const toggleSize = (sz: ProductSize) => {
    onChange((prev) => {
      const exists = prev.sizes.includes(sz);
      const next = exists
        ? prev.sizes.filter((s) => s !== sz)
        : [...prev.sizes, sz];
      return { ...prev, sizes: next.length > 0 ? next : [sz] };
    });
  };

  const updateSizeStock = (sz: ProductSize, raw: string) => {
    const val = raw.trim() === "" ? undefined : Math.max(0, Math.floor(Number(raw) || 0));
    onChange((prev) => {
      const nextStock = { ...prev.size_stock };
      if (val === undefined) {
        delete nextStock[sz];
      } else {
        nextStock[sz] = val;
      }
      return { ...prev, size_stock: nextStock };
    });
  };

  const addColorSkin = (preset?: {
    name_en: string;
    name_ar: string;
    hex: string;
  }) => {
    const defaultImg = form.image_url || "/images/hoodies/obsidian-crest.jpg";
    const newSkin: ProductColorVariant = {
      id: `skin-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`,
      name_en: preset?.name_en || "Limited Color",
      name_ar: preset?.name_ar || "لون خاص",
      hex: preset?.hex || "#27272A",
      image_url: defaultImg,
      front_image_url: defaultImg,
      back_image_url: "",
      detail_image_url: "",
      gallery_urls: [],
    };
    onChange((prev) => ({
      ...prev,
      colors: [...prev.colors, newSkin],
    }));
    setPreviewColorIdx(form.colors.length);
  };

  const updateColorField = (
    id: string,
    patch: Partial<ProductColorVariant>
  ) => {
    onChange((prev) => ({
      ...prev,
      colors: prev.colors.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  };

  const removeColorSkin = (id: string) => {
    onChange((prev) => ({
      ...prev,
      colors: prev.colors.filter((c) => c.id !== id),
    }));
    setPreviewColorIdx(null);
  };

  const activePreviewImage =
    previewColorIdx !== null && form.colors[previewColorIdx]?.image_url
      ? form.colors[previewColorIdx].image_url
      : form.image_url || "/images/hoodies/obsidian-crest.jpg";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#D4AF37]/50 bg-[var(--bg-surface)] p-4 shadow-2xl sm:p-6"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
            {form.id ? t.admin.editProduct : t.admin.newProduct}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border-subtle)] p-1.5 text-[var(--text-secondary)] hover:text-[#D4AF37]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live Visual Preview Strip */}
        <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-page)] p-3.5 sm:flex-row sm:items-center">
          <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-[#D4AF37]/40 bg-[#111114]">
            <Image
              src={activePreviewImage}
              alt={form.title_en || "Hoodie preview"}
              fill
              unoptimized
              sizes="80px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-sm font-semibold text-[var(--text-primary)]">
              {(locale === "ar" ? form.title_ar : form.title_en) ||
                "ULTIMATE Hoodie Preview"}
            </p>
            <p className="mt-0.5 font-mono text-xs font-bold text-[var(--accent-gold-ink)]">
              {form.price_egp || "0"} {t.shop.egp}
            </p>
            {form.colors.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {form.colors.map((c, idx) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setPreviewColorIdx(idx)}
                    title={locale === "ar" ? c.name_ar : c.name_en}
                    className={`h-4 w-4 rounded-full border transition-transform ${
                      previewColorIdx === idx
                        ? "scale-125 border-[#D4AF37] ring-1 ring-[#D4AF37]"
                        : "border-white/40"
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
                <span className="ms-1 text-[10px] text-[var(--text-muted)]">
                  {form.colors.length}{" "}
                  {locale === "ar" ? "لون / سكن" : "skins"}
                </span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-[#D4AF37] bg-[#D4AF37]/10 px-4 py-2.5 text-xs text-[var(--accent-gold-ink)]">
            {error}
          </div>
        )}

        <form onSubmit={onSave} className="mt-4 space-y-5">
          {/* 1. Titles & Descriptions */}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                Title (EN)
              </label>
              <input
                type="text"
                required
                value={form.title_en}
                onChange={(e) =>
                  onChange((p) => ({ ...p, title_en: e.target.value }))
                }
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                Title (AR)
              </label>
              <input
                type="text"
                required
                dir="rtl"
                value={form.title_ar}
                onChange={(e) =>
                  onChange((p) => ({ ...p, title_ar: e.target.value }))
                }
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                Description (EN)
              </label>
              <textarea
                rows={3}
                required
                value={form.description_en}
                onChange={(e) =>
                  onChange((p) => ({ ...p, description_en: e.target.value }))
                }
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3.5 py-2 text-sm text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                Description (AR)
              </label>
              <textarea
                rows={3}
                required
                dir="rtl"
                value={form.description_ar}
                onChange={(e) =>
                  onChange((p) => ({ ...p, description_ar: e.target.value }))
                }
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3.5 py-2 text-sm text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
              />
            </div>
          </div>

          {/* 2. Section, Price & Sizes */}
          <div className="grid gap-3.5 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                {locale === "ar" ? "السكشن / التصنيف" : "Section"}
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  onChange((p) => ({ ...p, category: e.target.value }))
                }
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
              >
                {sections.map((sec) => (
                  <option key={sec.slug} value={sec.slug}>
                    {locale === "ar" ? sec.label_ar : sec.label_en} ({sec.slug})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                Price (EGP)
              </label>
              <input
                type="number"
                required
                min={50}
                value={form.price_egp}
                onChange={(e) =>
                  onChange((p) => ({ ...p, price_egp: e.target.value }))
                }
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3.5 py-2.5 font-mono text-sm text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                Compare At (Optional)
              </label>
              <input
                type="number"
                min={50}
                value={form.compare_at_price_egp}
                onChange={(e) =>
                  onChange((p) => ({
                    ...p,
                    compare_at_price_egp: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3.5 py-2.5 font-mono text-sm text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs text-[var(--text-secondary)]">
                {locale === "ar"
                  ? "المقاسات المتاحة والمخزون الاختياري (S → 3XL)"
                  : "Size Matrix & Optional Per-Size Stock (S → 3XL)"}
              </label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {PRODUCT_SIZES.map((sz) => {
                  const active = form.sizes.includes(sz);
                  return (
                    <div
                      key={sz}
                      className={`rounded-xl border p-2 transition-colors ${
                        active
                          ? "border-[#D4AF37] bg-[#D4AF37]/10"
                          : "border-[var(--border-subtle)] bg-[var(--bg-page)]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSize(sz)}
                        className={`w-full rounded-lg py-1 text-xs font-bold ${
                          active
                            ? "bg-[#D4AF37] text-[#09090B]"
                            : "text-[var(--text-secondary)]"
                        }`}
                      >
                        {sz}
                      </button>
                      {active && (
                        <input
                          type="number"
                          min={0}
                          placeholder={locale === "ar" ? "الكمية" : "Qty"}
                          value={form.size_stock[sz] ?? ""}
                          onChange={(e) => updateSizeStock(sz, e.target.value)}
                          className="mt-1.5 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-1 text-center font-mono text-[11px] text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-5 pt-3 text-xs">
              <label className="flex cursor-pointer items-center gap-2 text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) =>
                    onChange((p) => ({ ...p, is_featured: e.target.checked }))
                  }
                  className="accent-[#D4AF37]"
                />
                {t.admin.featured}
              </label>

              <label className="flex cursor-pointer items-center gap-2 text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={form.in_stock}
                  onChange={(e) =>
                    onChange((p) => ({ ...p, in_stock: e.target.checked }))
                  }
                  className="accent-[#D4AF37]"
                />
                {t.admin.inStock}
              </label>
            </div>
          </div>

          {/* 3. Primary Cover Image */}
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              {locale === "ar"
                ? "الصورة الأساسية للهودي (رابط أو رفع)"
                : "Main Hoodie Image URL or Upload"}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                required
                value={form.image_url}
                onChange={(e) =>
                  onChange((p) => ({ ...p, image_url: e.target.value }))
                }
                className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
              />
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/60 px-4 py-2.5 text-xs font-semibold text-[var(--accent-gold-ink)] hover:bg-[#D4AF37] hover:text-[#09090B]">
                <Upload className="h-3.5 w-3.5" />
                <span>
                  {uploadingTarget === "main"
                    ? "Uploading..."
                    : t.admin.uploadImage}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleMainImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* 4. Multi-Color / Skin Variants Manager */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-page)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-[#D4AF37]" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                  {t.admin.colorsTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => addColorSkin()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/60 bg-[#D4AF37]/10 px-3 py-1.5 text-[11px] font-semibold text-[var(--accent-gold-ink)] hover:bg-[#D4AF37] hover:text-[#09090B]"
              >
                <Plus className="h-3.5 w-3.5" />
                {t.admin.addColor}
              </button>
            </div>

            {/* Quick Presets */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="me-1 text-[10px] text-[var(--text-muted)]">
                {locale === "ar" ? "إضافة سريعة:" : "Quick add:"}
              </span>
              {DEFAULT_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => addColorSkin(preset)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)] hover:border-[#D4AF37] hover:text-[var(--text-primary)]"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-white/40"
                    style={{ backgroundColor: preset.hex }}
                  />
                  {locale === "ar" ? preset.name_ar : preset.name_en}
                </button>
              ))}
            </div>

            {form.colors.length === 0 ? (
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                {locale === "ar"
                  ? "لا توجد ألوان إضافية بعد. اضغط على أي لون أو «إضافة لون / سكن» لإتاحة أكثر من لون لنفس الهودي."
                  : "No extra color skins yet. Click a preset or Add Color Skin to offer multiple colorways for this hoodie."}
              </p>
            ) : (
              <div className="mt-3.5 space-y-3">
                {form.colors.map((skin, idx) => (
                  <div
                    key={skin.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      <input
                        type="color"
                        value={skin.hex}
                        onChange={(e) =>
                          updateColorField(skin.id, { hex: e.target.value })
                        }
                        aria-label="Pick swatch color"
                        className="h-8 w-8 cursor-pointer rounded-lg border border-[var(--border-subtle)] bg-transparent p-0.5"
                      />
                      <input
                        type="text"
                        value={skin.name_en}
                        placeholder="Color Name (EN)"
                        onChange={(e) =>
                          updateColorField(skin.id, { name_en: e.target.value })
                        }
                        className="min-w-[120px] flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
                      />
                      <input
                        type="text"
                        dir="rtl"
                        value={skin.name_ar}
                        placeholder="اسم اللون (AR)"
                        onChange={(e) =>
                          updateColorField(skin.id, { name_ar: e.target.value })
                        }
                        className="min-w-[120px] flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeColorSkin(skin.id)}
                        className="rounded-lg border border-[var(--border-subtle)] p-1.5 text-[var(--text-muted)] hover:border-red-500/60 hover:text-red-400"
                        title="Remove color skin"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Structured Image Slots per Color Variant: Front / Back / Detail / Gallery */}
                    <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                      {(
                        [
                          {
                            slot: "front_image_url" as const,
                            labelEn: "1. Front View",
                            labelAr: "1. صورة الوش",
                            value: skin.front_image_url || skin.image_url || "",
                          },
                          {
                            slot: "back_image_url" as const,
                            labelEn: "2. Back View",
                            labelAr: "2. صورة الضهر",
                            value: skin.back_image_url || "",
                          },
                          {
                            slot: "detail_image_url" as const,
                            labelEn: "3. Detail / Close-up",
                            labelAr: "3. تفصيلة المنتج",
                            value: skin.detail_image_url || "",
                          },
                        ] as const
                      ).map((item) => (
                        <div
                          key={item.slot}
                          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] p-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-[var(--text-primary)]">
                              {locale === "ar" ? item.labelAr : item.labelEn}
                            </span>
                            {item.slot === "front_image_url" && (
                              <button
                                type="button"
                                onClick={() =>
                                  onChange((p) => ({
                                    ...p,
                                    image_url: item.value || skin.image_url,
                                  }))
                                }
                                className="text-[9px] font-semibold text-[var(--accent-gold-ink)] hover:underline"
                              >
                                {locale === "ar" ? "تعيين كأساسية" : "Set Cover"}
                              </button>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[#111114]">
                              {item.value ? (
                                <Image
                                  src={item.value}
                                  alt={`${skin.name_en} ${item.labelEn}`}
                                  fill
                                  unoptimized
                                  sizes="40px"
                                  className="object-cover"
                                />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-[9px] text-white/40">
                                  —
                                </span>
                              )}
                            </div>
                            <label className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#D4AF37]/50 px-2 py-1.5 text-[10px] font-semibold text-[var(--accent-gold-ink)] hover:bg-[#D4AF37] hover:text-[#09090B]">
                              <Upload className="h-3 w-3" />
                              <span>
                                {uploadingTarget === `${skin.id}:${item.slot}`
                                  ? "..."
                                  : locale === "ar"
                                    ? "رفع"
                                    : "Upload"}
                              </span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(e) =>
                                  handleColorSlotUpload(skin.id, item.slot, e)
                                }
                                className="hidden"
                              />
                            </label>
                          </div>
                          <input
                            type="text"
                            value={item.value}
                            placeholder={`/images/... (#${idx + 1})`}
                            onChange={(e) => {
                              const nextUrl = e.target.value;
                              updateColorField(skin.id, {
                                [item.slot]: nextUrl,
                                ...(item.slot === "front_image_url"
                                  ? { image_url: nextUrl }
                                  : {}),
                              });
                            }}
                            className="mt-1.5 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[10px] text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Optional Extra Gallery Shots */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)] hover:border-[#D4AF37] hover:text-[var(--text-primary)]">
                        <Plus className="h-3 w-3 text-[#D4AF37]" />
                        <span>
                          {uploadingTarget === `${skin.id}:gallery`
                            ? "..."
                            : locale === "ar"
                              ? "إضافة صورة معرض إضافية"
                              : "Add Extra Gallery Shot"}
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) =>
                            handleColorSlotUpload(skin.id, "gallery", e)
                          }
                          className="hidden"
                        />
                      </label>
                      {Array.isArray(skin.gallery_urls) &&
                        skin.gallery_urls.map((gUrl, gIdx) => (
                          <div
                            key={`${skin.id}-gal-${gIdx}`}
                            className="relative h-8 w-8 overflow-hidden rounded-md border border-[#D4AF37]/40"
                          >
                            <Image
                              src={gUrl}
                              alt="Gallery shot"
                              fill
                              unoptimized
                              sizes="32px"
                              className="object-cover"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateColorField(skin.id, {
                                  gallery_urls: (skin.gallery_urls || []).filter(
                                    (_, i) => i !== gIdx
                                  ),
                                })
                              }
                              aria-label="Remove gallery shot"
                              className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] text-white opacity-0 hover:opacity-100"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || uploadingTarget !== null}
            className="w-full rounded-xl bg-[#D4AF37] py-3 text-xs font-semibold uppercase tracking-wider text-[#09090B] disabled:opacity-50"
          >
            {saving ? "Saving..." : t.admin.saveProduct}
          </button>
        </form>
      </div>
    </div>
  );
}
