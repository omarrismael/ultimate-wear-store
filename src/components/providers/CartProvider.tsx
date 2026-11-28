"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  CartItem,
  Product,
  ProductColorVariant,
  ProductSize,
} from "@/types";
import { useI18n } from "@/lib/i18n/context";

const CART_STORAGE_KEY = "ultimate_wear_cart_v1";

interface CartContextValue {
  items: CartItem[];
  isCartOpen: boolean;
  toastMessage: string | null;
  totalItems: number;
  subtotal: number;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (
    product: Product,
    size: ProductSize,
    quantity?: number,
    color?: ProductColorVariant | null
  ) => void;
  updateQuantity: (
    productId: string,
    size: ProductSize,
    quantity: number,
    colorNameEn?: string
  ) => void;
  removeItem: (
    productId: string,
    size: ProductSize,
    colorNameEn?: string
  ) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const validSizes = new Set<ProductSize>([
            "S",
            "M",
            "L",
            "XL",
            "XXL",
            "3XL",
          ]);
          const sanitized = parsed.filter(
            (item): item is CartItem =>
              Boolean(item) &&
              typeof item.productId === "string" &&
              typeof item.title_en === "string" &&
              typeof item.title_ar === "string" &&
              typeof item.price_egp === "number" &&
              item.price_egp > 0 &&
              typeof item.image_url === "string" &&
              validSizes.has(item.size) &&
              typeof item.quantity === "number" &&
              Number.isInteger(item.quantity) &&
              item.quantity >= 1 &&
              item.quantity <= 20
          );
          setItems(sanitized);

          // Reconcile any stale fallback product UUIDs with live DB product IDs by slug
          if (sanitized.some((i) => i.productId.startsWith("11111111-"))) {
            fetch("/api/products")
              .then((r) => (r.ok ? r.json() : null))
              .then((data) => {
                if (!active || !Array.isArray(data?.products)) return;
                const bySlug = new Map<string, Product>();
                for (const p of data.products as Product[]) {
                  if (p?.slug) bySlug.set(p.slug, p);
                }
                setItems((prev) =>
                  prev.map((item) => {
                    const live = item.slug ? bySlug.get(item.slug) : undefined;
                    if (!live || live.id === item.productId) return item;
                    return {
                      ...item,
                      productId: live.id,
                      price_egp: live.price_egp,
                      title_en: live.title_en,
                      title_ar: live.title_ar,
                      image_url: live.image_url,
                    };
                  })
                );
              })
              .catch(() => null);
          }
        }
      }
    } catch {
      // Ignore malformed localStorage
    } finally {
      setHydrated(true);
    }
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  const addToCart = useCallback(
    (
      product: Product,
      size: ProductSize,
      quantity = 1,
      color?: ProductColorVariant | null
    ) => {
      const colorNameEn = color?.name_en;
      const colorNameAr = color?.name_ar;
      const colorHex = color?.hex;
      const itemImage = color?.image_url || product.image_url;

      setItems((prev) => {
        const existingIndex = prev.findIndex(
          (item) =>
            item.productId === product.id &&
            item.size === size &&
            (item.colorNameEn || "") === (colorNameEn || "")
        );
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = {
            ...next[existingIndex],
            image_url: itemImage,
            quantity: Math.min(20, next[existingIndex].quantity + quantity),
          };
          return next;
        }
        return [
          ...prev,
          {
            productId: product.id,
            slug: product.slug,
            title_en: product.title_en,
            title_ar: product.title_ar,
            category: product.category,
            price_egp: product.price_egp,
            image_url: itemImage,
            size,
            colorNameEn,
            colorNameAr,
            colorHex,
            quantity: Math.min(20, Math.max(1, quantity)),
          },
        ];
      });

      setToastMessage(t.shop.addedToast);
      // Choreographed scroll-to-cart glide: highlight cart trigger and open slide-over drawer
      window.setTimeout(() => {
        setIsCartOpen(true);
      }, 280);
    },
    [t.shop.addedToast]
  );

  const updateQuantity = useCallback(
    (
      productId: string,
      size: ProductSize,
      quantity: number,
      colorNameEn?: string
    ) => {
      const targetColor = colorNameEn || "";
      if (quantity <= 0) {
        setItems((prev) =>
          prev.filter(
            (i) =>
              !(
                i.productId === productId &&
                i.size === size &&
                (i.colorNameEn || "") === targetColor
              )
          )
        );
        return;
      }
      setItems((prev) =>
        prev.map((i) =>
          i.productId === productId &&
          i.size === size &&
          (i.colorNameEn || "") === targetColor
            ? { ...i, quantity: Math.min(20, quantity) }
            : i
        )
      );
    },
    []
  );

  const removeItem = useCallback(
    (productId: string, size: ProductSize, colorNameEn?: string) => {
      const targetColor = colorNameEn || "";
      setItems((prev) =>
        prev.filter(
          (i) =>
            !(
              i.productId === productId &&
              i.size === size &&
              (i.colorNameEn || "") === targetColor
            )
        )
      );
    },
    []
  );

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = useMemo(
    () => items.reduce((acc, item) => acc + item.quantity, 0),
    [items]
  );

  const subtotal = useMemo(
    () => items.reduce((acc, item) => acc + item.price_egp * item.quantity, 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        isCartOpen,
        toastMessage,
        totalItems,
        subtotal,
        openCart,
        closeCart,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}
