import React, { Suspense } from "react";
import { CompleteProfileClient } from "@/components/auth/CompleteProfileClient";
import { BrandLoader } from "@/components/brand/BrandLoader";

export const dynamic = "force-dynamic";

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={<BrandLoader fullScreen label="ULTIMATE // ONBOARDING" />}>
      <CompleteProfileClient />
    </Suspense>
  );
}
