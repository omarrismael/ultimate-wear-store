import type {
  Product,
  ProductCategory,
  ProductSize,
  StoreSection,
  StoreSettings,
} from "@/types";

export const BRAND_NAME = "ULTIMATE";
export const BRAND_DOMAIN = "ultimate-wear.com";
export const PRIMARY_ADMIN_EMAIL = "okhatab055@gmail.com";
export const ADMIN_PORTAL_PATH = "/studio-vault";
export const DEVELOPER_NAME = "Omar Khatab";
export const DEVELOPER_LINKEDIN = "https://www.linkedin.com/in/omarkhatabb/";

export const VODAFONE_CASH_NUMBER =
  process.env.NEXT_PUBLIC_VODAFONE_CASH_NUMBER || "01018471149";

export const INSTAPAY_NUMBER =
  process.env.NEXT_PUBLIC_INSTAPAY_NUMBER || "01018471149";

export const PRODUCT_SIZES: ProductSize[] = ["S", "M", "L", "XL"];

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  "heavyweight",
  "oversized",
  "zip",
  "essential",
];

export const DEFAULT_COLOR_PRESETS = [
  { name_en: "Obsidian Black", name_ar: "أسود أوبسيديان", hex: "#111114" },
  { name_en: "Ivory Cream", name_ar: "أوف وايت آيفوري", hex: "#F4F1EA" },
  { name_en: "Charcoal Slate", name_ar: "رمادي فحمي", hex: "#3A3A42" },
  { name_en: "Sand Gold", name_ar: "رملي ذهبي", hex: "#C8A96A" },
  { name_en: "Espresso Mocha", name_ar: "موكا بني داكن", hex: "#4B362A" },
  { name_en: "Forest Olive", name_ar: "زيتي داكن", hex: "#364538" },
  { name_en: "Burgundy Noir", name_ar: "نبيتي داكن", hex: "#5A1F2B" },
  { name_en: "Midnight Navy", name_ar: "كحلي ليلي", hex: "#1E293B" },
] as const;

export const DEFAULT_STORE_SECTIONS: StoreSection[] = [
  {
    slug: "heavyweight",
    label_en: "Heavyweight",
    label_ar: "ثقيل 520GSM",
    sort_order: 1,
    is_active: true,
    show_in_hero: true,
  },
  {
    slug: "oversized",
    label_en: "Oversized",
    label_ar: "أوفرسايز",
    sort_order: 2,
    is_active: true,
    show_in_hero: true,
  },
  {
    slug: "zip",
    label_en: "Gold Zip",
    label_ar: "سحاب ذهبي",
    sort_order: 3,
    is_active: true,
    show_in_hero: true,
  },
  {
    slug: "essential",
    label_en: "Essential",
    label_ar: "أساسي",
    sort_order: 4,
    is_active: true,
    show_in_hero: true,
  },
];

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  hero_badge_en: "DROP 01",
  hero_badge_ar: "DROP 01",
  hero_headline_en: "WORN BY THE FEW.",
  hero_headline_ar: "للقِلّة فقط.",
  hero_subheadline_en: "Heavyweight presence. Zero noise.",
  hero_subheadline_ar: "حضور ثقيل. تفاصيل تتكلم بصمت.",
  featured_title_en: "FEATURED DROP",
  featured_title_ar: "المجموعة",
  shop_eyebrow_en: "THE COLLECTION",
  shop_eyebrow_ar: "المجموعة المختارة",
  shop_title_en: "Curated Heavyweight Hoodies",
  shop_title_ar: "هوديز ثقيلة فاخرة",
  shop_subtitle_en:
    "Small-batch Egyptian cotton fleece designed for structured drape and enduring luxury.",
  shop_subtitle_ar:
    "إنتاج بكميات محدودة من أجود الأقطان المصرية لقصة متماسكة وفخامة تدوم.",
};

export const LOCALE_COOKIE_NAME = "ultimate_locale";
export const THEME_COOKIE_NAME = "ultimate_theme";

export const FALLBACK_PRODUCTS: Product[] = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    slug: "obsidian-crest-hoodie",
    title_en: "Obsidian Crest 520GSM Hoodie",
    title_ar: "هودي أوبسيديان كريست 520GSM",
    description_en:
      "Engineered from brushed 520GSM Egyptian French terry in deep obsidian black with precision gold crest embroidery and dropped shoulders.",
    description_ar:
      "مصنوع من قطن مصري فاخر بوزن 520 جرام باللون الأسود الداكن مع تطريز ذهبي دقيق وقصة أكتاف ساقطة فخمة.",
    category: "heavyweight",
    price_egp: 1850,
    compare_at_price_egp: 2200,
    sizes: ["S", "M", "L", "XL"],
    image_url: "/images/hoodies/obsidian-crest.jpg",
    is_featured: true,
    in_stock: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    slug: "ivory-atelier-hoodie",
    title_en: "Ivory Atelier Edition Hoodie",
    title_ar: "هودي أتيليه آيفوري إديشن",
    description_en:
      "Architectural crisp ivory silhouette cut in heavyweight double-knit cotton with minimalist tonal seams and gold metal aglets.",
    description_ar:
      "تصميم معماري باللون الأبيض الناصع من القطن المزدوج الثقيل مع خياطة متناسقة وأطراف رباط معدنية ذهبية.",
    category: "oversized",
    price_egp: 1950,
    compare_at_price_egp: null,
    sizes: ["S", "M", "L", "XL"],
    image_url: "/images/hoodies/ivory-atelier.jpg",
    is_featured: true,
    in_stock: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "11111111-1111-4111-8111-111111111103",
    slug: "gold-monolith-hoodie",
    title_en: "Gold Monolith Drop Hoodie",
    title_ar: "هودي جولد مونوليث إصدار خاص",
    description_en:
      "Limited-run black monolith fleece featuring metallic gold back typography, double-layered structured hood, and ribbed cuffs.",
    description_ar:
      "إصدار محدود باللون الأسود الفاخر مع طباعة ذهبية معدنية بارزة وقبعة مزدوجة الطبقات وأساور متينة.",
    category: "heavyweight",
    price_egp: 2150,
    compare_at_price_egp: 2500,
    sizes: ["M", "L", "XL"],
    image_url: "/images/hoodies/gold-monolith.jpg",
    is_featured: true,
    in_stock: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "11111111-1111-4111-8111-111111111104",
    slug: "eclipse-heavyweight-hoodie",
    title_en: "Eclipse Boxy Street Hoodie",
    title_ar: "هودي إكليبس بوكسي ستريت",
    description_en:
      "Cropped boxy streetwear proportions in matte black 500GSM fleece with gold-piped kangaroo pocket and reinforced collar.",
    description_ar:
      "قصة بوكسي عصرية من الصوف القطني 500 جرام بلون أسود مطفي مع جيب أمامي مطرز بحواف ذهبية.",
    category: "oversized",
    price_egp: 1750,
    compare_at_price_egp: null,
    sizes: ["S", "M", "L", "XL"],
    image_url: "/images/hoodies/eclipse-heavyweight.jpg",
    is_featured: true,
    in_stock: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "11111111-1111-4111-8111-111111111105",
    slug: "sovereign-zip-hoodie",
    title_en: "Sovereign Gold-Zip Hoodie",
    title_ar: "هودي سوفرين بسحاب ذهبي",
    description_en:
      "Full two-way luxury gold hardware zipper hoodie crafted from dense black interlock cotton for clean layered styling.",
    description_ar:
      "هودي بسحاب معدني ذهبي مزدوج الاتجاه مصنوع من قطن إنترلوك أسود كثيف لإطلالة طبقية أنيقة.",
    category: "zip",
    price_egp: 2250,
    compare_at_price_egp: 2600,
    sizes: ["S", "M", "L", "XL"],
    image_url: "/images/hoodies/sovereign-zip.jpg",
    is_featured: false,
    in_stock: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "11111111-1111-4111-8111-111111111106",
    slug: "nocturnal-essential-hoodie",
    title_en: "Nocturnal Signature Essential",
    title_ar: "هودي نوكتورنال سيجنتشر",
    description_en:
      "Everyday luxury essential in deep black cotton with subtle gold ULTIMATE chest monogram and ultra-soft interior.",
    description_ar:
      "قطعة أساسية فاخرة للاستخدام اليومي من القطن الأسود مع شعار ULTIMATE الذهبي الدقيق وبطانة فائقة النعومة.",
    category: "essential",
    price_egp: 1600,
    compare_at_price_egp: null,
    sizes: ["S", "M", "L", "XL"],
    image_url: "/images/hoodies/nocturnal-oversized.jpg",
    is_featured: false,
    in_stock: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];
