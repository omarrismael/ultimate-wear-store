import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getStoreConfig } from "@/lib/store-config";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const config = await getStoreConfig(supabase);
    return NextResponse.json({
      sections: config.sections,
      settings: config.settings,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load store sections." },
      { status: 500 }
    );
  }
}
