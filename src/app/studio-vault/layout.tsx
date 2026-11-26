import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { checkIsAdminUser } from "@/lib/security/admin-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function StudioVaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin } = await checkIsAdminUser();

  // Conceal the portal behind a 404 for anyone other than a verified admin
  if (!isAdmin) {
    notFound();
  }

  return <>{children}</>;
}
