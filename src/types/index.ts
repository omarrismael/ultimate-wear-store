export type Locale = "en" | "ar";

export type ProductSize = "S" | "M" | "L" | "XL";

export type DefaultProductCategory =
  | "heavyweight"
  | "oversized"
  | "zip"
  | "essential";

export type ProductCategory = DefaultProductCategory | (string & {});

export interface ProductColorVariant {
  id: string;
  name_en: string;
  name_ar: string;
  hex: string;
  image_url: string;
}

export interface StoreSection {
  slug: string;
  label_en: string;
  label_ar: string;
  sort_order: number;
  is_active: boolean;
  show_in_hero: boolean;
}

export interface StoreSettings {
  hero_badge_en: string;
  hero_badge_ar: string;
  hero_headline_en: string;
  hero_headline_ar: string;
  hero_subheadline_en: string;
  hero_subheadline_ar: string;
  featured_title_en: string;
  featured_title_ar: string;
  shop_eyebrow_en: string;
  shop_eyebrow_ar: string;
  shop_title_en: string;
  shop_title_ar: string;
  shop_subtitle_en: string;
  shop_subtitle_ar: string;
}

export type PaymentMethod = "vodafone_cash" | "instapay";

export type OrderStatus =
  | "pending_verification"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  slug: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  category: ProductCategory;
  price_egp: number;
  compare_at_price_egp: number | null;
  sizes: ProductSize[];
  image_url: string;
  colors?: ProductColorVariant[];
  is_featured: boolean;
  in_stock: boolean;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  productId: string;
  slug: string;
  title_en: string;
  title_ar: string;
  price_egp: number;
  image_url: string;
  size: ProductSize;
  colorNameEn?: string;
  colorNameAr?: string;
  colorHex?: string;
  quantity: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_title_en: string;
  product_title_ar: string;
  size: ProductSize;
  color_name?: string | null;
  quantity: number;
  unit_price: number;
}

export interface Order {
  id: string;
  order_code: string;
  user_id: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: string;
  city: string;
  payment_method: PaymentMethod;
  sender_phone: string | null;
  transaction_ref: string | null;
  receipt_path: string;
  receipt_signed_url?: string | null;
  total_amount: number;
  status: OrderStatus;
  notes: string | null;
  telegram_notified: boolean;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}
