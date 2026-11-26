"use client";

import React, { useEffect, useState } from "react";

const GLYPHS = "ULTIMATE0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

interface DecryptedTextProps {
  text: string;
  className?: string;
  speedMs?: number;
}

export function DecryptedText({
  text,
  className = "",
  speedMs = 28,
}: DecryptedTextProps) {
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(text);
      return;
    }

    let iteration = 0;
    const interval = window.setInterval(() => {
      setDisplay(
        text
          .split("")
          .map((char, index) => {
            if (char === " " || /[\u0600-\u06FF]/.test(char)) return char;
            if (index < iteration) return text[index];
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join("")
      );
      iteration += 0.6;
      if (iteration >= text.length) {
        setDisplay(text);
        window.clearInterval(interval);
      }
    }, speedMs);

    return () => window.clearInterval(interval);
  }, [text, speedMs]);

  return <span className={className}>{display}</span>;
}
