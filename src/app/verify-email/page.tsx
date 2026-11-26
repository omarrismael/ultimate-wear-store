import React, { Suspense } from "react";
import { VerifyEmailClient } from "@/components/auth/VerifyEmailClient";
import { ElectricLoader } from "@/components/brand/ElectricLoader";

export const dynamic = "force-dynamic";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<ElectricLoader fullScreen label="ULTIMATE // VERIFYING" />}>
      <VerifyEmailClient />
    </Suspense>
  );
}
