"use client";

import React from "react";
import Image from "next/image";
import { useTheme } from "@/components/providers/ThemeProvider";

interface BrandLogoProps {
  height?: number;
  className?: string;
}

export function BrandLogo({ height = 28, className = "" }: BrandLogoProps) {
  const { theme } = useTheme();
  const src =
    theme === "dark"
      ? "/images/brand/ultimate-logo-white.png"
      : "/images/brand/ultimate-logo-dark.png";

  return (
    <Image
      src={src}
      alt="ULTIMATE"
      width={Math.round(height * 3.8)}
      height={height}
      priority
      className={`object-contain ${className}`}
      style={{ height, width: "auto" }}
    />
  );
}
