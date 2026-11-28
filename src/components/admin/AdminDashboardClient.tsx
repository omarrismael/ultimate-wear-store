"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  Edit3,
  Eye,
  MessageCircle,
  PackagePlus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import type {
  Order,
  OrderStatus,
  Product,
  StoreSection,
  StoreSettings,
} from "@/types";
import {
  DEFAULT_STORE_SECTIONS,
  DEFAULT_STORE_SETTINGS,
} from "@/lib/constants";
import { useI18n } from "@/lib/i18n/context";
import { formatWhatsAppUrl } from "@/lib/security/validation";
import { Navbar } from "@/components/layout/Navbar";
import { ElectricLoader } from "@/components/brand/ElectricLoader";
import {
  ProductEditorModal,
  type ProductFormState,
} from "./ProductEditorModal";
import { SectionsManagerTab } from "./SectionsManagerTab";
import { SalesAnalyticsTab } from "./SalesAnalyticsTab";

const EMPTY_FORM: ProductFormState = {
  title_en: "",
  title_ar: "",
  description_en: "",
  description_ar: "",
  category: "heavyweight",
  price_egp: "1850",
  compare_at_price_egp: "",
  sizes: ["S", "M", "L", "XL"],
  size_stock: {},
  image_url: "/images/hoodies/obsidian-crest.jpg",
  colors: [],
  is_featured: false,
  in_stock: true,
};

const ORDER_STATUSES: OrderStatus[] = [
  "pending_verification",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

export function AdminDashboardClient({
  initialProducts,
  initialSections = DEFAULT_STORE_SECTIONS,
  initialSettings = DEFAULT_STORE_SETTINGS,
  syncedWithDatabase: initialSynced = true,
}: {
  initialProducts: Product[];
  initialSections?: StoreSection[];
  initialSettings?: StoreSettings;
  syncedWithDatabase?: boolean;
}) {
  const { locale, t } = useI18n();

  const [tab, setTab] = useState<
    "products" | "sections" | "orders" | "analytics"
  >("products");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [sections, setSections] = useState<StoreSection[]>(initialSections);
  const [settings, setSettings] = useState<StoreSettings>(initialSettings);
  const [syncedWithDatabase, setSyncedWithDatabase] = useState(initialSynced);

  const [searchQuery, setSearchQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState<"all" | OrderStatus>("all");
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [savingProduct, setSavingProduct] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [savingSections, setSavingSections] = useState(false);
  const [sectionsSavedNotice, setSectionsSavedNotice] = useState<string | null>(
    null
  );

  const [lightboxReceipt, setLightboxReceipt] = useState<string | null>(null);
  const [confirmDeleteOrderId, setConfirmDeleteOrderId] = useState<string | null>(
    null
  );
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightboxReceipt) setLightboxReceipt(null);
        else if (isProductModalOpen) setIsProductModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxReceipt, isProductModalOpen]);

  const loadProducts = useCallback(async () => {
    const res = await fetch("/api/admin/products");
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products || []);
    }
  }, []);

  const loadOrders = useCallback(async (status: "all" | OrderStatus) => {
    setLoadingOrders(true);
    try {
      const qs = status === "all" ? "" : `?status=${status}`;
      const res = await fetch(`/api/admin/orders${qs}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "orders") {
      loadOrders(orderFilter);
    }
  }, [tab, orderFilter, loadOrders]);

  const sectionMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const sec of sections) {
      map.set(sec.slug, locale === "ar" ? sec.label_ar : sec.label_en);
    }
    return map;
  }, [sections, locale]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (sectionFilter !== "all" && p.category !== sectionFilter) return false;
      if (!q) return true;
      return (
        p.title_en.toLowerCase().includes(q) ||
        p.title_ar.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery, sectionFilter]);

  const openCreateModal = () => {
    setForm({
      ...EMPTY_FORM,
      category: sections[0]?.slug || "heavyweight",
    });
    setFormError(null);
    setIsProductModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setForm({
      id: product.id,
      title_en: product.title_en,
      title_ar: product.title_ar,
      description_en: product.description_en,
      description_ar: product.description_ar,
      category: product.category,
      price_egp: String(product.price_egp),
      compare_at_price_egp: product.compare_at_price_egp
        ? String(product.compare_at_price_egp)
        : "",
      sizes: product.sizes,
      size_stock: product.size_stock || {},
      image_url: product.image_url,
      colors: Array.isArray(product.colors) ? product.colors : [],
      is_featured: product.is_featured,
      in_stock: product.in_stock,
    });
    setFormError(null);
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const priceNum = Number(form.price_egp);
    const compareNum = form.compare_at_price_egp
      ? Number(form.compare_at_price_egp)
      : null;

    if (!Number.isInteger(priceNum) || priceNum < 50) {
      setFormError("Price must be a valid integer >= 50 EGP.");
      return;
    }
    if (
      compareNum !== null &&
      (!Number.isInteger(compareNum) || compareNum < priceNum)
    ) {
      setFormError("Compare-at price must be greater than or equal to price.");
      return;
    }

    setSavingProduct(true);
    try {
      const payload = {
        title_en: form.title_en,
        title_ar: form.title_ar,
        description_en: form.description_en,
        description_ar: form.description_ar,
        category: form.category,
        price_egp: priceNum,
        compare_at_price_egp: compareNum,
        sizes: form.sizes,
        size_stock: form.size_stock,
        image_url: form.image_url,
        colors: form.colors,
        is_featured: form.is_featured,
        in_stock: form.in_stock,
      };

      const url = form.id
        ? `/api/admin/products/${form.id}`
        : "/api/admin/products";
      const method = form.id ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to save product.");
        return;
      }

      await loadProducts();
      setIsProductModalOpen(false);
    } finally {
      setSavingProduct(false);
    }
  };

  const handleQuickPatchProduct = async (
    id: string,
    patch: Partial<Pick<Product, "in_stock" | "is_featured" | "category">>
  ) => {
    setActionError(null);
    const res = await fetch(`/api/admin/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
      );
    } else {
      const data = await res.json().catch(() => null);
      setActionError(data?.error || "Failed to update product.");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    setActionError(null);
    const res = await fetch(`/api/admin/products/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setConfirmDeleteId(null);
    } else {
      const data = await res.json().catch(() => null);
      setActionError(data?.error || "Failed to delete product.");
    }
  };

  const handleSaveSections = async () => {
    setActionError(null);
    setSectionsSavedNotice(null);
    setSavingSections(true);
    try {
      const res = await fetch("/api/admin/sections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections, settings }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Failed to save sections.");
        return;
      }
      if (Array.isArray(data.sections)) setSections(data.sections);
      if (data.settings) setSettings(data.settings);
      if (typeof data.syncedWithDatabase === "boolean") {
        setSyncedWithDatabase(data.syncedWithDatabase);
      }
      setSectionsSavedNotice(t.admin.sectionsSaved);
    } finally {
      setSavingSections(false);
    }
  };

  const handleUpdateOrderStatus = async (
    orderId: string,
    status: OrderStatus
  ) => {
    setActionError(null);
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
    } else {
      const data = await res.json().catch(() => null);
      setActionError(data?.error || "Failed to update order status.");
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    setActionError(null);
    setDeletingOrderId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setActionError(data?.error || "Failed to delete order permanently.");
        return;
      }
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setConfirmDeleteOrderId(null);
    } finally {
      setDeletingOrderId(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-page)] transition-colors duration-300">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-8 min-[400px]:px-4 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-subtle)] pb-6 sm:flex-row sm:items-center">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              {t.admin.title}
            </h1>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {t.admin.subtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-[var(--border-strong)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[#D4AF37]"
            >
              {t.admin.backToStore}
            </Link>
            {tab === "products" && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-2 text-xs font-semibold text-[#09090B]"
              >
                <PackagePlus className="h-4 w-4" />
                {t.admin.newProduct}
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-6 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setTab("products")}
            className={`rounded-xl border px-4 py-2 text-xs font-semibold transition-colors sm:px-5 ${
              tab === "products"
                ? "border-[#D4AF37] bg-[#D4AF37] text-[#09090B]"
                : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[#D4AF37]"
            }`}
          >
            {t.admin.tabs.products} ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("sections")}
            className={`rounded-xl border px-4 py-2 text-xs font-semibold transition-colors sm:px-5 ${
              tab === "sections"
                ? "border-[#D4AF37] bg-[#D4AF37] text-[#09090B]"
                : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[#D4AF37]"
            }`}
          >
            {t.admin.tabs.sections} ({sections.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("orders")}
            className={`rounded-xl border px-4 py-2 text-xs font-semibold transition-colors sm:px-5 ${
              tab === "orders"
                ? "border-[#D4AF37] bg-[#D4AF37] text-[#09090B]"
                : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[#D4AF37]"
            }`}
          >
            {t.admin.tabs.orders}
          </button>
          <button
            type="button"
            onClick={() => setTab("analytics")}
            className={`rounded-xl border px-4 py-2 text-xs font-semibold transition-colors sm:px-5 ${
              tab === "analytics"
                ? "border-[#D4AF37] bg-[#D4AF37] text-[#09090B]"
                : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[#D4AF37]"
            }`}
          >
            {t.admin.tabs.analytics}
          </button>
        </div>

        {actionError && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-[#D4AF37] bg-[#D4AF37]/10 px-4 py-2.5 text-xs text-[var(--accent-gold-ink)]">
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="ms-4 font-bold hover:underline"
            >
              ×
            </button>
          </div>
        )}

        {/* Products Tab */}
        {tab === "products" && (
          <div className="mt-6 space-y-5">
            {/* Search & Section Filter Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    locale === "ar" ? "ابحث عن هودي..." : "Search hoodies..."
                  }
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2 pe-3 ps-9 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSectionFilter("all")}
                  className={`rounded-full border px-3 py-1 text-[11px] font-medium ${
                    sectionFilter === "all"
                      ? "border-[#D4AF37] bg-[#D4AF37] text-[#09090B]"
                      : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                  }`}
                >
                  {t.shop.allCategories}
                </button>
                {sections.map((sec) => (
                  <button
                    key={sec.slug}
                    type="button"
                    onClick={() => setSectionFilter(sec.slug)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-medium ${
                      sectionFilter === sec.slug
                        ? "border-[#D4AF37] bg-[#D4AF37] text-[#09090B]"
                        : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {locale === "ar" ? sec.label_ar : sec.label_en}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 transition-colors hover:border-[#D4AF37]/40"
                >
                  <div className="flex gap-4">
                    <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[#111114]">
                      <Image
                        src={product.image_url}
                        alt={product.title_en}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display truncate text-sm font-semibold text-[var(--text-primary)]">
                        {locale === "ar" ? product.title_ar : product.title_en}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                        {locale === "ar" ? product.title_en : product.title_ar}
                      </p>
                      <p className="mt-1.5 font-mono text-sm font-bold text-[var(--accent-gold-ink)]">
                        {product.price_egp} {t.shop.egp}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {product.sizes.join(" · ")}
                        </span>
                        {product.colors && product.colors.length > 0 && (
                          <div className="flex items-center gap-1">
                            {product.colors.map((c) => (
                              <span
                                key={c.id}
                                title={locale === "ar" ? c.name_ar : c.name_en}
                                className="h-3 w-3 rounded-full border border-white/40"
                                style={{ backgroundColor: c.hex }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Section Reassign */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      {locale === "ar" ? "السكشن:" : "Section:"}
                    </span>
                    <select
                      value={product.category}
                      onChange={(e) =>
                        handleQuickPatchProduct(product.id, {
                          category: e.target.value,
                        })
                      }
                      aria-label={`Change section for ${product.title_en}`}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] px-2.5 py-1 text-[11px] text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none"
                    >
                      {sections.map((sec) => (
                        <option key={sec.slug} value={sec.slug}>
                          {locale === "ar" ? sec.label_ar : sec.label_en}
                        </option>
                      ))}
                      {!sectionMap.has(product.category) && (
                        <option value={product.category}>
                          {product.category}
                        </option>
                      )}
                    </select>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleQuickPatchProduct(product.id, {
                          is_featured: !product.is_featured,
                        })
                      }
                      className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-semibold ${
                        product.is_featured
                          ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[var(--accent-gold-ink)]"
                          : "border-[var(--border-subtle)] text-[var(--text-muted)]"
                      }`}
                    >
                      <Star className="h-3 w-3" />
                      {t.admin.featured}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleQuickPatchProduct(product.id, {
                          in_stock: !product.in_stock,
                        })
                      }
                      className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-semibold ${
                        product.in_stock
                          ? "border-[var(--border-strong)] text-[var(--text-primary)]"
                          : "border-[#D4AF37]/50 text-[var(--accent-gold-ink)]"
                      }`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {product.in_stock ? t.admin.inStock : t.admin.soldOut}
                    </button>

                    <div className="ms-auto flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(product)}
                        className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:border-[#D4AF37] hover:text-[#D4AF37]"
                        title={t.admin.editProduct}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>{locale === "ar" ? "تعديل" : "Edit"}</span>
                      </button>
                      {confirmDeleteId === product.id ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(product.id)}
                          className="rounded-xl border border-red-500/70 bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold text-red-400"
                        >
                          {locale === "ar" ? "تأكيد" : "Confirm"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(product.id)}
                          className="rounded-xl border border-[var(--border-subtle)] p-1.5 text-[var(--text-secondary)] hover:border-[#D4AF37] hover:text-[#D4AF37]"
                          title={t.admin.deleteProduct}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sections & Store Headings Tab */}
        {tab === "sections" && (
          <SectionsManagerTab
            sections={sections}
            settings={settings}
            syncedWithDatabase={syncedWithDatabase}
            onSectionsChange={(next) => {
              setSections(next);
              setSectionsSavedNotice(null);
            }}
            onSettingsChange={(next) => {
              setSettings(next);
              setSectionsSavedNotice(null);
            }}
            onSaveAll={handleSaveSections}
            saving={savingSections}
            savedNotice={sectionsSavedNotice}
          />
        )}

        {/* Orders Tab */}
        {tab === "orders" && (
          <div className="mt-6">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setOrderFilter("all")}
                className={`rounded-xl border px-4 py-1.5 text-xs font-semibold ${
                  orderFilter === "all"
                    ? "border-[#D4AF37] bg-[#D4AF37] text-[#09090B]"
                    : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                }`}
              >
                {t.admin.filterAll}
              </button>
              {ORDER_STATUSES.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setOrderFilter(st)}
                  className={`rounded-xl border px-4 py-1.5 text-xs font-semibold ${
                    orderFilter === st
                      ? "border-[#D4AF37] bg-[#D4AF37] text-[#09090B]"
                      : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                  }`}
                >
                  {t.orders.status[st]}
                </button>
              ))}
            </div>

            {loadingOrders ? (
              <ElectricLoader label="ULTIMATE // LOADING ORDERS" />
            ) : orders.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 text-center text-sm text-[var(--text-muted)]">
                {t.admin.noOrders}
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
                      <div>
                        <p className="font-mono text-sm font-bold text-[var(--accent-gold-ink)]">
                          {order.order_code}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-primary)]">
                          {order.customer_email} ·{" "}
                          <span className="font-mono">
                            {order.customer_phone}
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          {order.city} — {order.shipping_address}
                        </p>
                      </div>

                      <div className="text-end">
                        <p className="font-mono text-lg font-bold text-[var(--accent-gold-ink)]">
                          {order.total_amount} {t.shop.egp}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {order.payment_mode === "full_cod" ||
                          !order.receipt_path ||
                          order.receipt_path.endsWith("/cod-no-receipt")
                            ? locale === "ar"
                              ? "100% كاش عند التوصيل"
                              : "100% Cash on Delivery"
                            : `${t.orders.paymentMethod[order.payment_method]} (100% Transfer)`}
                          {order.sender_phone ? ` (${order.sender_phone})` : ""}
                        </p>
                        <p className="font-mono mt-0.5 text-[11px] text-[var(--text-muted)]">
                          {t.orders.paidNow}:{" "}
                          {typeof order.paid_amount === "number"
                            ? order.paid_amount
                            : order.payment_mode === "full_cod"
                              ? 0
                              : order.total_amount}{" "}
                          {t.shop.egp} · {t.orders.remainingCod}:{" "}
                          {typeof order.remaining_cod_amount === "number"
                            ? order.remaining_cod_amount
                            : order.payment_mode === "full_cod"
                              ? order.total_amount
                              : 0}{" "}
                          {t.shop.egp}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
                      {order.order_items?.map((item) => (
                        <div key={item.id} className="flex justify-between">
                          <span>
                            {locale === "ar"
                              ? item.product_title_ar
                              : item.product_title_en}{" "}
                            ({item.size}
                            {item.color_name ? ` · ${item.color_name}` : ""}) ×{" "}
                            {item.quantity}
                          </span>
                          <span className="font-mono">
                            {item.unit_price * item.quantity} {t.shop.egp}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
                      <div className="flex flex-wrap gap-2">
                        {ORDER_STATUSES.map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleUpdateOrderStatus(order.id, st)}
                            className={`rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                              order.status === st
                                ? "border-[#D4AF37] bg-[#D4AF37] text-[#09090B]"
                                : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[#D4AF37]"
                            }`}
                          >
                            {t.orders.status[st]}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        {order.receipt_signed_url && (
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxReceipt(
                                order.receipt_signed_url ?? null
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/60 px-3 py-1.5 text-xs font-semibold text-[var(--accent-gold-ink)] hover:bg-[#D4AF37] hover:text-[#09090B]"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {t.admin.viewReceipt}
                          </button>
                        )}
                        <a
                          href={formatWhatsAppUrl(
                            order.customer_phone,
                            `ULTIMATE Order ${order.order_code}`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[#D4AF37] hover:text-[#D4AF37]"
                        >
                          <MessageCircle className="h-3.5 w-3.5 text-[#D4AF37]" />
                          {t.admin.whatsappCustomer}
                        </a>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteOrderId(order.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t.admin.deleteOrder}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Sales & AI Insights Tab */}
        {tab === "analytics" && <SalesAnalyticsTab />}
      </main>

      <ProductEditorModal
        isOpen={isProductModalOpen}
        form={form}
        sections={sections}
        saving={savingProduct}
        error={formError}
        onChange={setForm}
        onError={setFormError}
        onSave={handleSaveProduct}
        onClose={() => setIsProductModalOpen(false)}
      />

      {/* Permanent Order Deletion Confirmation Modal */}
      {confirmDeleteOrderId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          onClick={() =>
            deletingOrderId ? null : setConfirmDeleteOrderId(null)
          }
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-red-500/50 bg-[var(--bg-surface)] p-6 shadow-2xl"
          >
            <h3 className="font-display text-lg font-extrabold uppercase text-[var(--text-primary)]">
              {t.admin.deleteOrder}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              {t.admin.deleteOrderConfirm}
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={Boolean(deletingOrderId)}
                onClick={() => setConfirmDeleteOrderId(null)}
                className="rounded-xl border border-[var(--border-strong)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[#D4AF37] disabled:opacity-50"
              >
                {locale === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={Boolean(deletingOrderId)}
                onClick={() => handleDeleteOrder(confirmDeleteOrderId)}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deletingOrderId
                  ? t.admin.deletingOrder
                  : t.admin.deleteOrder}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Lightbox */}
      {lightboxReceipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-4"
          onClick={() => setLightboxReceipt(null)}
        >
          <div
            className="relative max-h-[88dvh] w-full max-w-2xl overflow-hidden rounded-2xl border border-[#D4AF37]/60 bg-[var(--bg-surface)] p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxReceipt(null)}
              aria-label="Close receipt preview"
              className="absolute end-4 top-4 z-10 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="relative h-[60vh] w-full sm:h-[70vh]">
              <Image
                src={lightboxReceipt}
                alt="Transfer Receipt Lightbox"
                fill
                unoptimized
                className="object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
