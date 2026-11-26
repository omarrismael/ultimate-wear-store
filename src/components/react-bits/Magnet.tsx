"use client";

import React, { useRef, useState } from "react";

interface MagnetProps {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}

export function Magnet({
  children,
  strength = 0.22,
  className = "",
}: MagnetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || !ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const rect = ref.current.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) * strength;
    const dy = (e.clientY - (rect.top + rect.height / 2)) * strength;
    setOffset({ x: dx, y: dy });
  };

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setOffset({ x: 0, y: 0 })}
      className={`inline-block transition-transform duration-200 ease-out will-change-transform ${className}`}
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
      }}
    >
      {children}
    </div>
  );
}
