"use client";

import React, { useEffect, useState } from "react";
import ElectricLogo from "../react-bits/ElectricLogo";

export interface BrandLoaderProps {
  label?: string;
  overlay?: boolean;
  fullScreen?: boolean;
  visible?: boolean;
  className?: string;
}

export function ElectricLoader({
  label,
  overlay = false,
  fullScreen = false,
  visible = true,
  className = "",
}: BrandLoaderProps) {
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setRendered(false);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!rendered) return null;

  const wrapperClass = overlay
    ? "fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#09090B]/92 backdrop-blur-md transition-opacity duration-500 ease-out"
    : fullScreen
      ? "flex min-h-screen w-full flex-col items-center justify-center overflow-x-clip bg-[var(--bg-page)] px-4 transition-opacity duration-500 ease-out"
      : "flex w-full flex-col items-center justify-center overflow-x-clip px-4 py-6 transition-opacity duration-500 ease-out";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={visible}
      className={`${wrapperClass} ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      } ${className}`}
    >
      <div
        style={{
          width: "100%",
          height: "480px",
          maxHeight: "68dvh",
          maxWidth: "100%",
          position: "relative",
        }}
      >
        <ElectricLogo
          arcs={1}
          bend={0.6}
          color="#ecc7ff"
          crackle={1.5}
          cursorIntensity={0.75}
          cursorRadius={100}
          fill={0}
          flicker={0.6}
          glow={1}
          glowColor="#ad6dff"
          intensity={1}
          interactive
          scale={0.7}
          speed={2.5}
          src="/logo.svg"
          strands={4}
          thickness={1.5}
        />
      </div>
      {label && (
        <p className="-mt-10 font-mono text-[11px] font-semibold uppercase tracking-[0.26em] text-[#ecc7ff]/80">
          {label}
        </p>
      )}
    </div>
  );
}

export const BrandLoader = ElectricLoader;
export default BrandLoader;
