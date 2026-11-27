import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PRIMARY_ADMIN_EMAIL } from "@/lib/constants";

export async function checkIsAdminUser(): Promise<{
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  isAdmin: boolean;
  userId: string | null;
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, isAdmin: false, userId: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  const isPrimaryOwner =
    Boolean(user.email_confirmed_at) &&
    user.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL;

  return {
    supabase,
    isAdmin: Boolean(profile?.is_admin || isPrimaryOwner),
    userId: user.id,
  };
}

export async function requireAdminApi() {
  const { supabase, isAdmin, userId } = await checkIsAdminUser();
  if (!userId) {
    return {
      supabase,
      userId: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!isAdmin) {
    return {
      supabase,
      userId,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { supabase, userId, error: null };
}
