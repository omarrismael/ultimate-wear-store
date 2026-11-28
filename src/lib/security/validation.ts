import { z } from "zod";

export const EGYPT_MOBILE_REGEX = /^01[0125][0-9]{8}$/;

export function sanitizeText(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatWhatsAppUrl(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");
  const international = digits.startsWith("01")
    ? `2${digits}`
    : digits.startsWith("0020")
      ? digits.slice(2)
      : digits;
  const base = `https://wa.me/${international}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export const otpRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  purpose: z.enum(["login", "signup"]).optional(),
});

export const otpVerifySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  token: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, "OTP must be 6 digits"),
  flow: z.enum(["login", "signup"]).optional(),
  // Collected once during registration — stored to profile on verify
  fullName: z.string().trim().min(2).max(80).transform(sanitizeText).optional(),
  phone: z
    .string()
    .trim()
    .regex(EGYPT_MOBILE_REGEX, "Invalid Egyptian mobile number")
    .optional(),
});

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(80)
    .transform(sanitizeText),
  phone: z
    .string()
    .trim()
    .regex(EGYPT_MOBILE_REGEX, "Enter a valid Egyptian mobile number (01XXXXXXXXX)"),
});

export const passwordLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(1, "Password is required").max(128),
});

export const PRODUCT_SIZE_ENUM = z.enum(["S", "M", "L", "XL", "XXL", "3XL"]);

export const phoneUpdateSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(EGYPT_MOBILE_REGEX, "Invalid Egyptian mobile number (01XXXXXXXXX)"),
  fullName: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .transform(sanitizeText)
    .optional(),
  governorate: z
    .string()
    .trim()
    .max(60)
    .transform(sanitizeText)
    .optional(),
});

export const orderItemInputSchema = z.object({
  productId: z.string().uuid(),
  size: PRODUCT_SIZE_ENUM,
  colorName: z
    .string()
    .trim()
    .max(60)
    .transform(sanitizeText)
    .optional(),
  quantity: z.number().int().min(1).max(20),
});

export const createOrderSchema = z
  .object({
    items: z.array(orderItemInputSchema).min(1).max(25),
    paymentMode: z.enum(["full_transfer", "full_cod"]).default("full_transfer"),
    paymentMethod: z.enum(["vodafone_cash", "instapay"]).default("vodafone_cash"),
    receiptPath: z
      .string()
      .trim()
      .max(300)
      .refine((val) => !val || (!val.includes("..") && !val.startsWith("/")), {
        message: "Invalid receipt storage path",
      })
      .optional()
      .nullable(),
    senderPhone: z
      .string()
      .trim()
      .regex(EGYPT_MOBILE_REGEX)
      .optional()
      .or(z.literal("")),
    transactionRef: z
      .string()
      .trim()
      .max(80)
      .transform(sanitizeText)
      .optional()
      .or(z.literal("")),
    governorate: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .transform(sanitizeText)
      .optional(),
    shippingAddress: z.string().trim().min(6).max(250).transform(sanitizeText),
    city: z.string().trim().min(2).max(80).transform(sanitizeText),
    notes: z
      .string()
      .trim()
      .max(300)
      .transform(sanitizeText)
      .optional()
      .or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.paymentMode === "full_transfer") {
      if (!data.receiptPath || data.receiptPath.length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please upload your transfer receipt screenshot.",
          path: ["receiptPath"],
        });
      }
    }
  });

export const notifyOrderSchema = z.object({
  orderId: z.string().uuid(),
});

export const uuidSchema = z.string().uuid();

const imagePathValidator = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (url) => url.startsWith("/images/") || url.startsWith("https://"),
    "Image URL must be a local /images/ path or https:// URL"
  );

export const colorVariantSchema = z.object({
  id: z.string().trim().min(1).max(60),
  name_en: z.string().trim().min(1).max(60).transform(sanitizeText),
  name_ar: z.string().trim().min(1).max(60).transform(sanitizeText),
  hex: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color hex must look like #111114"),
  image_url: imagePathValidator,
  front_image_url: imagePathValidator.optional().or(z.literal("")),
  back_image_url: imagePathValidator.optional().or(z.literal("")),
  detail_image_url: imagePathValidator.optional().or(z.literal("")),
  gallery_urls: z.array(imagePathValidator).max(6).optional().default([]),
});

export const sectionSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9-_]{1,39}$/,
    "Section slug must be 2-40 lowercase letters, numbers, hyphens, or underscores"
  );

export const adminProductBaseSchema = z.object({
  title_en: z.string().trim().min(2).max(120).transform(sanitizeText),
  title_ar: z.string().trim().min(2).max(120).transform(sanitizeText),
  description_en: z.string().trim().min(6).max(1000).transform(sanitizeText),
  description_ar: z.string().trim().min(6).max(1000).transform(sanitizeText),
  category: sectionSlugSchema,
  price_egp: z.number().int().min(50).max(100000),
  compare_at_price_egp: z.number().int().min(50).max(150000).nullable().optional(),
  sizes: z.array(PRODUCT_SIZE_ENUM).min(1).max(6),
  size_stock: z
    .record(PRODUCT_SIZE_ENUM, z.number().int().min(0).max(10000))
    .optional()
    .nullable(),
  image_url: imagePathValidator,
  colors: z.array(colorVariantSchema).max(12).optional().default([]),
  is_featured: z.boolean().default(false),
  in_stock: z.boolean().default(true),
});

export const adminProductSchema = adminProductBaseSchema.refine(
  (data) =>
    data.compare_at_price_egp == null ||
    data.compare_at_price_egp >= data.price_egp,
  {
    message: "Compare-at price must be greater than or equal to price.",
    path: ["compare_at_price_egp"],
  }
);

export const adminProductPatchSchema = adminProductBaseSchema.partial().refine(
  (data) =>
    data.compare_at_price_egp == null ||
    data.price_egp == null ||
    data.compare_at_price_egp >= data.price_egp,
  {
    message: "Compare-at price must be greater than or equal to price.",
    path: ["compare_at_price_egp"],
  }
);

export const storeSectionSchema = z.object({
  slug: sectionSlugSchema,
  label_en: z.string().trim().min(1).max(60).transform(sanitizeText),
  label_ar: z.string().trim().min(1).max(60).transform(sanitizeText),
  sort_order: z.number().int().min(0).max(999).default(0),
  is_active: z.boolean().default(true),
  show_in_hero: z.boolean().default(true),
});

export const storeSettingsSchema = z.object({
  hero_badge_en: z.string().trim().min(1).max(40).transform(sanitizeText),
  hero_badge_ar: z.string().trim().min(1).max(40).transform(sanitizeText),
  hero_headline_en: z.string().trim().min(2).max(120).transform(sanitizeText),
  hero_headline_ar: z.string().trim().min(2).max(120).transform(sanitizeText),
  hero_subheadline_en: z.string().trim().min(2).max(180).transform(sanitizeText),
  hero_subheadline_ar: z.string().trim().min(2).max(180).transform(sanitizeText),
  featured_title_en: z.string().trim().min(1).max(60).transform(sanitizeText),
  featured_title_ar: z.string().trim().min(1).max(60).transform(sanitizeText),
  shop_eyebrow_en: z.string().trim().min(1).max(60).transform(sanitizeText),
  shop_eyebrow_ar: z.string().trim().min(1).max(60).transform(sanitizeText),
  shop_title_en: z.string().trim().min(2).max(120).transform(sanitizeText),
  shop_title_ar: z.string().trim().min(2).max(120).transform(sanitizeText),
  shop_subtitle_en: z.string().trim().min(2).max(260).transform(sanitizeText),
  shop_subtitle_ar: z.string().trim().min(2).max(260).transform(sanitizeText),
});

export const storeConfigUpdateSchema = z.object({
  sections: z.array(storeSectionSchema).min(1).max(20).optional(),
  settings: storeSettingsSchema.optional(),
});

export const adminOrderStatusSchema = z.object({
  status: z.enum([
    "pending_verification",
    "confirmed",
    "shipped",
    "delivered",
    "cancelled",
  ]),
});
