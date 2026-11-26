import type { Product } from "@/types";
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
  activeImageUrl?: string
): CircularCarouselItem[] {
  const title = locale === "ar" ? product.title_ar : product.title_en;
  const primaryImage = activeImageUrl || product.image_url;

  const matchedKey = KNOWN_ANGLE_KEYS.find((k) =>
    primaryImage.includes(k)
  );

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

  // If product has multiple color skins, include them across frames too
  const skinFrames =
    product.colors
      ?.filter((c) => c.image_url !== primaryImage)
      .slice(0, 2)
      .map((c) => ({
        src: c.image_url,
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
