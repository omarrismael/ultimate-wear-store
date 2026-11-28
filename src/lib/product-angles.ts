import type { Product, ProductColorVariant } from "@/types";
import type { CircularCarouselItem } from "@/components/react-bits/CircularCarousel";

const KNOWN_ANGLE_KEYS = [
  "obsidian-crest",
  "ivory-atelier",
  "gold-monolith",
  "eclipse-heavyweight",
  "sovereign-zip",
  "nocturnal-oversized",
] as const;

export function getProductCarouselItems(
  product: Product,
  locale: "en" | "ar",
  selectedColor?: ProductColorVariant | string | null
): CircularCarouselItem[] {
  const title = locale === "ar" ? product.title_ar : product.title_en;

  const variant: ProductColorVariant | null =
    selectedColor && typeof selectedColor === "object"
      ? selectedColor
      : typeof selectedColor === "string"
        ? product.colors?.find((c) => c.image_url === selectedColor) || null
        : null;

  // 1. If the selected color variant has structured Front/Back/Detail/Gallery uploads, build directly from them
  if (variant) {
    const front = variant.front_image_url || variant.image_url || product.image_url;
    const structured: CircularCarouselItem[] = [
      {
        src: front,
        alt: `${title} — ${locale === "ar" ? "الأمام" : "Front"}`,
        title: locale === "ar" ? "صورة الوش" : "Front",
        subtitle: title,
      },
    ];

    if (variant.back_image_url) {
      structured.push({
        src: variant.back_image_url,
        alt: `${title} — ${locale === "ar" ? "الضهر" : "Back"}`,
        title: locale === "ar" ? "صورة الضهر" : "Back",
        subtitle: title,
      });
    }
    if (variant.detail_image_url) {
      structured.push({
        src: variant.detail_image_url,
        alt: `${title} — ${locale === "ar" ? "التفاصيل" : "Detail"}`,
        title: locale === "ar" ? "تفصيلة المنتج" : "Detail",
        subtitle: title,
      });
    }
    if (Array.isArray(variant.gallery_urls)) {
      for (const url of variant.gallery_urls) {
        if (url) {
          structured.push({
            src: url,
            alt: `${title} — Gallery`,
            title: locale === "ar" ? "معرض" : "Gallery",
            subtitle: title,
          });
        }
      }
    }

    if (structured.length >= 2) {
      return structured;
    }
  }

  const primaryImage =
    (typeof selectedColor === "string"
      ? selectedColor
      : variant?.front_image_url || variant?.image_url) || product.image_url;

  const matchedKey = KNOWN_ANGLE_KEYS.find((k) => primaryImage.includes(k));

  if (matchedKey) {
    return [
      {
        src: primaryImage,
        alt: `${title} — Front`,
        title: locale === "ar" ? "الأمام" : "Front",
        subtitle: title,
      },
      {
        src: `/images/hoodies/angles/${matchedKey}-side.jpg`,
        alt: `${title} — Side Profile`,
        title: locale === "ar" ? "الجنب" : "Side",
        subtitle: title,
      },
      {
        src: `/images/hoodies/angles/${matchedKey}-back.jpg`,
        alt: `${title} — Back Silhouette`,
        title: locale === "ar" ? "الظهر" : "Back",
        subtitle: title,
      },
      {
        src: `/images/hoodies/angles/${matchedKey}-detail.jpg`,
        alt: `${title} — Detail`,
        title: locale === "ar" ? "التفاصيل" : "Detail",
        subtitle: title,
      },
    ];
  }

  const skinFrames =
    product.colors
      ?.filter((c) => (c.front_image_url || c.image_url) !== primaryImage)
      .slice(0, 2)
      .map((c) => ({
        src: c.front_image_url || c.image_url,
        alt: `${title} — ${locale === "ar" ? c.name_ar : c.name_en}`,
        title: locale === "ar" ? c.name_ar : c.name_en,
      })) || [];

  const baseFrames: CircularCarouselItem[] = [
    {
      src: primaryImage,
      alt: `${title} — Front`,
      title: locale === "ar" ? "الأمام" : "Front",
    },
    ...skinFrames,
    {
      src: primaryImage,
      alt: `${title} — Profile`,
      title: locale === "ar" ? "الجنب" : "Side",
    },
    {
      src: `/images/hoodies/angles/obsidian-crest-back.jpg`,
      alt: `${title} — Back`,
      title: locale === "ar" ? "الظهر" : "Back",
    },
    {
      src: primaryImage,
      alt: `${title} — Detail`,
      title: locale === "ar" ? "التفاصيل" : "Detail",
    },
  ];

  return baseFrames.slice(0, 4);
}
