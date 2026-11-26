"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types";
import { createClient } from "@/lib/supabase/client";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  refreshProfile: () => Promise<Profile | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mergeUserMetadataProfile(
  currentUser: User,
  dbProfile: Profile | null
): Profile | null {
  const meta = (currentUser.user_metadata || {}) as Record<string, unknown>;
  const metaName =
    (typeof meta.full_name === "string" && meta.full_name.trim()
      ? meta.full_name.trim()
      : null) ||
    (typeof meta.name === "string" && meta.name.trim()
      ? meta.name.trim()
      : null);
  const metaPhone =
    typeof meta.phone === "string" && meta.phone.trim()
      ? meta.phone.trim()
      : null;

  if (!dbProfile) {
    if (!metaPhone && !metaName) return null;
    return {
      id: currentUser.id,
      email: currentUser.email || "",
      full_name: metaName,
      phone: metaPhone,
      is_admin: false,
      created_at: currentUser.created_at || new Date().toISOString(),
      updated_at: currentUser.updated_at || new Date().toISOString(),
    };
  }

  return {
    ...dbProfile,
    full_name: dbProfile.full_name || metaName,
    phone: dbProfile.phone || metaPhone,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const syncedMetaUsersRef = useRef<Set<string>>(new Set());

  const fetchProfile = useCallback(
    async (
      currentUser: User
    ): Promise<{ profile: Profile | null; hasError: boolean }> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      const rawProfile = error ? null : ((data as Profile | null) ?? null);
      const merged = mergeUserMetadataProfile(currentUser, rawProfile);
      setProfile(merged);

      // Smart silent sync: if auth user_metadata already holds phone/name from registration
      // but DB row missed it, backfill silently in the background without ever prompting again.
      if (
        !error &&
        currentUser.email_confirmed_at &&
        merged?.phone &&
        !rawProfile?.phone &&
        !syncedMetaUsersRef.current.has(currentUser.id)
      ) {
        syncedMetaUsersRef.current.add(currentUser.id);
        fetch("/api/profile/phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: merged.phone,
            fullName: merged.full_name || undefined,
          }),
        }).catch(() => null);
      }

      return { profile: merged, hasError: Boolean(error) };
    },
    [supabase]
  );

  const refreshProfile = useCallback(async () => {
    await supabase.auth.getSession();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    setUser(currentUser);
    if (!currentUser) {
      setProfile(null);
      return null;
    }
    const { profile: resolved } = await fetchProfile(currentUser);
    return resolved;
  }, [supabase, fetchProfile]);

  useEffect(() => {
    let active = true;

    async function init() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!active) return;
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser);
      }
      if (active) setLoading(false);
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        await fetchProfile(nextUser);
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
