import fs from "fs/promises";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_STORE_SECTIONS,
  DEFAULT_STORE_SETTINGS,
} from "@/lib/constants";
import type {
  Product,
  ProductColorVariant,
  StoreSection,
  StoreSettings,
} from "@/types";

interface LocalStoreConfigFile {
  sections?: StoreSection[];
  settings?: Partial<StoreSettings>;
  productColors?: Record<string, ProductColorVariant[]>;
  productSections?: Record<string, string>;
}

const CONFIG_DIR = path.join(process.cwd(), "data");
const CONFIG_PATH = path.join(CONFIG_DIR, "store-config.json");

async function readLocalConfig(): Promise<LocalStoreConfigFile> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeLocalConfig(next: LocalStoreConfigFile): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), "utf8");
  } catch {
    // Ignore read-only serverless filesystems; Supabase persistence handles those
  }
}

export async function getStoreConfig(supabase: SupabaseClient): Promise<{
  sections: StoreSection[];
  settings: StoreSettings;
  syncedWithDatabase: boolean;
}> {
  const local = await readLocalConfig();
  let sections: StoreSection[] =
    local.sections && local.sections.length > 0
      ? local.sections
      : DEFAULT_STORE_SECTIONS;
  let settings: StoreSettings = {
    ...DEFAULT_STORE_SETTINGS,
    ...(local.settings || {}),
  };
  let syncedWithDatabase = true;

  try {
    const [secRes, setRes] = await Promise.all([
      supabase
        .from("store_sections")
        .select("*")
        .order("sort_order", { ascending: true }),
      supabase.from("store_settings").select("*").eq("id", 1).maybeSingle(),
    ]);

    if (secRes.error) {
      syncedWithDatabase = false;
    } else if (Array.isArray(secRes.data) && secRes.data.length > 0) {
      sections = secRes.data as StoreSection[];
    }

    if (setRes.error) {
      syncedWithDatabase = false;
    } else if (setRes.data) {
      settings = {
        ...DEFAULT_STORE_SETTINGS,
        ...(setRes.data as Partial<StoreSettings>),
      };
    }
  } catch {
    syncedWithDatabase = false;
  }

  sections = [...sections].sort((a, b) => a.sort_order - b.sort_order);

  return { sections, settings, syncedWithDatabase };
}

export async function saveStoreConfig(
  supabase: SupabaseClient,
  payload: {
    sections?: StoreSection[];
    settings?: StoreSettings;
  }
): Promise<{
  sections: StoreSection[];
  settings: StoreSettings;
  syncedWithDatabase: boolean;
}> {
  const local = await readLocalConfig();
  const nextLocal: LocalStoreConfigFile = {
    ...local,
    ...(payload.sections ? { sections: payload.sections } : {}),
    ...(payload.settings ? { settings: payload.settings } : {}),
  };
  await writeLocalConfig(nextLocal);

  let syncedWithDatabase = true;

  if (payload.sections) {
    try {
      const normalized = payload.sections.map((s, idx) => ({
        slug: s.slug,
        label_en: s.label_en,
        label_ar: s.label_ar,
        sort_order: idx + 1,
        is_active: s.is_active,
        show_in_hero: s.show_in_hero,
      }));

      const { data: existing, error: readErr } = await supabase
        .from("store_sections")
        .select("slug");

      if (readErr) {
        syncedWithDatabase = false;
      } else {
        const keepSlugs = new Set(normalized.map((s) => s.slug));
        const toDelete = (existing || [])
          .map((r: { slug: string }) => r.slug)
          .filter((slug: string) => !keepSlugs.has(slug));

        if (toDelete.length > 0) {
          await supabase.from("store_sections").delete().in("slug", toDelete);
        }

        const { error: upsertErr } = await supabase
          .from("store_sections")
          .upsert(normalized, { onConflict: "slug" });

        if (upsertErr) syncedWithDatabase = false;
      }
    } catch {
      syncedWithDatabase = false;
    }
  }

  if (payload.settings) {
    try {
      const { error: upsertSettingsErr } = await supabase
        .from("store_settings")
        .upsert({ id: 1, ...payload.settings }, { onConflict: "id" });
      if (upsertSettingsErr) syncedWithDatabase = false;
    } catch {
      syncedWithDatabase = false;
    }
  }

  const fresh = await getStoreConfig(supabase);
  return {
    sections: fresh.sections,
    settings: fresh.settings,
    syncedWithDatabase,
  };
}

export async function saveProductOverrides(
  productId: string,
  overrides: {
    colors?: ProductColorVariant[];
    category?: string;
  }
): Promise<void> {
  const local = await readLocalConfig();
  const next: LocalStoreConfigFile = {
    ...local,
    productColors: {
      ...(local.productColors || {}),
      ...(overrides.colors !== undefined ? { [productId]: overrides.colors } : {}),
    },
    productSections: {
      ...(local.productSections || {}),
      ...(overrides.category !== undefined
        ? { [productId]: overrides.category }
        : {}),
    },
  };
  await writeLocalConfig(next);
}

export async function clearProductOverrides(productId: string): Promise<void> {
  const local = await readLocalConfig();
  if (local.productColors) delete local.productColors[productId];
  if (local.productSections) delete local.productSections[productId];
  await writeLocalConfig(local);
}

export async function enrichProductsWithOverrides(
  products: Product[]
): Promise<Product[]> {
  const local = await readLocalConfig();
  const colorMap = local.productColors || {};
  const sectionMap = local.productSections || {};

  return products.map((product) => {
    const dbColors = Array.isArray(product.colors) ? product.colors : [];
    const overrideColors = colorMap[product.id];
    const overrideCategory = sectionMap[product.id];

    return {
      ...product,
      category: overrideCategory || product.category,
      colors: dbColors.length > 0 ? dbColors : overrideColors || [],
    };
  });
}
