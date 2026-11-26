import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/security/admin-auth";
import { getStoreConfig, saveStoreConfig } from "@/lib/store-config";
import { storeConfigUpdateSchema } from "@/lib/security/validation";

export async function GET() {
  const { supabase, error } = await requireAdminApi();
  if (error) return error;

  const config = await getStoreConfig(supabase);
  return NextResponse.json(config);
}

export async function PUT(request: NextRequest) {
  const { supabase, error } = await requireAdminApi();
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = storeConfigUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "Invalid sections or settings payload.",
        },
        { status: 400 }
      );
    }

    const saved = await saveStoreConfig(supabase, parsed.data);
    return NextResponse.json(saved);
  } catch {
    return NextResponse.json(
      { error: "Failed to save store sections." },
      { status: 500 }
    );
  }
}
