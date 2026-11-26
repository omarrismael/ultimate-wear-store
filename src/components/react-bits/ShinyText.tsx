"use client";

import React from "react";

export function ShinyText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block bg-[linear-gradient(110deg,#D4AF37,40%,#FFFFFF,50%,#D4AF37)] bg-[length:200%_100%] bg-clip-text text-transparent animate-pulse ${className}`}
    >
      {text}
    </span>
  );
}
