export interface EgyptGovernorate {
  key: string;
  name_en: string;
  name_ar: string;
}

export const EGYPT_GOVERNORATES: readonly EgyptGovernorate[] = [
  { key: "cairo", name_en: "Cairo", name_ar: "القاهرة" },
  { key: "giza", name_en: "Giza", name_ar: "الجيزة" },
  { key: "alexandria", name_en: "Alexandria", name_ar: "الإسكندرية" },
  { key: "qalyubia", name_en: "Qalyubia", name_ar: "القليوبية" },
  { key: "dakahlia", name_en: "Dakahlia", name_ar: "الدقهلية" },
  { key: "sharqia", name_en: "Sharqia", name_ar: "الشرقية" },
  { key: "gharbia", name_en: "Gharbia", name_ar: "الغربية" },
  { key: "menofia", name_en: "Menofia", name_ar: "المنوفية" },
  { key: "beheira", name_en: "Beheira", name_ar: "البحيرة" },
  { key: "kafr_el_sheikh", name_en: "Kafr El Sheikh", name_ar: "كفر الشيخ" },
  { key: "damietta", name_en: "Damietta", name_ar: "دمياط" },
  { key: "port_said", name_en: "Port Said", name_ar: "بورسعيد" },
  { key: "ismailia", name_en: "Ismailia", name_ar: "الإسماعيلية" },
  { key: "suez", name_en: "Suez", name_ar: "السويس" },
  { key: "fayoum", name_en: "Fayoum", name_ar: "الفيوم" },
  { key: "beni_suef", name_en: "Beni Suef", name_ar: "بني سويف" },
  { key: "minya", name_en: "Minya", name_ar: "المنيا" },
  { key: "assiut", name_en: "Assiut", name_ar: "أسيوط" },
  { key: "sohag", name_en: "Sohag", name_ar: "سوهاج" },
  { key: "qena", name_en: "Qena", name_ar: "قنا" },
  { key: "luxor", name_en: "Luxor", name_ar: "الأقصر" },
  { key: "aswan", name_en: "Aswan", name_ar: "أسوان" },
  { key: "red_sea", name_en: "Red Sea", name_ar: "البحر الأحمر" },
  { key: "matrouh", name_en: "Matrouh", name_ar: "مطروح" },
  { key: "new_valley", name_en: "New Valley", name_ar: "الوادي الجديد" },
  { key: "north_sinai", name_en: "North Sinai", name_ar: "شمال سيناء" },
  { key: "south_sinai", name_en: "South Sinai", name_ar: "جنوب سيناء" },
] as const;

export const QUICK_GOVERNORATE_KEYS = [
  "cairo",
  "giza",
  "alexandria",
  "dakahlia",
  "sharqia",
  "qalyubia",
] as const;

const ALIAS_MAP = new Map<string, EgyptGovernorate>();
for (const gov of EGYPT_GOVERNORATES) {
  ALIAS_MAP.set(gov.key.toLowerCase(), gov);
  ALIAS_MAP.set(gov.name_en.toLowerCase(), gov);
  ALIAS_MAP.set(gov.name_ar.trim(), gov);
}

// Common spelling variants for legacy free-text orders
ALIAS_MAP.set("el cairo", EGYPT_GOVERNORATES[0]);
ALIAS_MAP.set("القاهره", EGYPT_GOVERNORATES[0]);
ALIAS_MAP.set("الجيزه", EGYPT_GOVERNORATES[1]);
ALIAS_MAP.set("alex", EGYPT_GOVERNORATES[2]);
ALIAS_MAP.set("اسكندرية", EGYPT_GOVERNORATES[2]);
ALIAS_MAP.set("الاسكندرية", EGYPT_GOVERNORATES[2]);
ALIAS_MAP.set("اسكندريه", EGYPT_GOVERNORATES[2]);
ALIAS_MAP.set("القليوبيه", EGYPT_GOVERNORATES[3]);
ALIAS_MAP.set("الدقهليه", EGYPT_GOVERNORATES[4]);
ALIAS_MAP.set("الشرقيه", EGYPT_GOVERNORATES[5]);
ALIAS_MAP.set("الغربيه", EGYPT_GOVERNORATES[6]);
ALIAS_MAP.set("المنوفيه", EGYPT_GOVERNORATES[7]);
ALIAS_MAP.set("البحيره", EGYPT_GOVERNORATES[8]);
ALIAS_MAP.set("الاسماعيليه", EGYPT_GOVERNORATES[12]);

export function resolveGovernorate(
  raw?: string | null
): EgyptGovernorate | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const direct = ALIAS_MAP.get(trimmed.toLowerCase()) || ALIAS_MAP.get(trimmed);
  if (direct) return direct;

  const lower = trimmed.toLowerCase();
  for (const gov of EGYPT_GOVERNORATES) {
    if (
      lower.includes(gov.name_en.toLowerCase()) ||
      trimmed.includes(gov.name_ar)
    ) {
      return gov;
    }
  }
  return null;
}

export function getGovernorateLabel(
  rawOrKey: string | null | undefined,
  locale: "en" | "ar"
): string {
  const matched = resolveGovernorate(rawOrKey);
  if (matched) {
    return locale === "ar" ? matched.name_ar : matched.name_en;
  }
  return (rawOrKey || "").trim() || (locale === "ar" ? "غير محدد" : "Unspecified");
}
