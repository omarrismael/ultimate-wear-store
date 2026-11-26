"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

export interface HoldButtonProps {
  children: React.ReactNode;
  doneLabel?: string;
  backgroundColor?: string;
  fillColor?: string;
  textColor?: string;
  fillTextColor?: string;
  size?: "sm" | "md" | "lg";
  radius?: number;
  fillDirection?: "left" | "right";
  holdTime?: number;
  releaseTime?: number;
  pressScale?: number;
  wave?: boolean;
  waveAmplitude?: number;
  glow?: boolean;
  resetAfter?: number;
  disabled?: boolean;
  className?: string;
  onBeforeHold?: () => boolean;
  onHold?: () => void | Promise<void>;
}

const SIZE_CLASSES = {
  sm: "px-4 py-2.5 text-[11px]",
  md: "px-6 py-4 text-xs",
  lg: "px-7 py-4 text-sm",
} as const;

export function HoldButton({
  children,
  doneLabel = "Confirmed",
  backgroundColor = "#27272a",
  fillColor = "#D4AF37",
  textColor = "#f5f5f5",
  fillTextColor = "#09090B",
  size = "md",
  radius = 14,
  fillDirection = "right",
  holdTime = 2000,
  releaseTime = 200,
  pressScale = 0.97,
  wave = true,
  waveAmplitude = 6,
  glow = true,
  resetAfter = 1200,
  disabled = false,
  className = "",
  onBeforeHold,
  onHold,
}: HoldButtonProps) {
  const [progress, setProgress] = useState(0); // 0..1
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);

  const progressRef = useRef(0);
  const holdingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const triggeredRef = useRef(false);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastFrameRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopRaf();
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, [stopRaf]);

  const runLoop = useCallback(() => {
    stopRaf();
    const tick = (now: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = now;
      }
      const dt = Math.min(50, now - lastFrameRef.current);
      lastFrameRef.current = now;

      if (holdingRef.current) {
        const next = Math.min(1, progressRef.current + dt / Math.max(200, holdTime));
        progressRef.current = next;
        setProgress(next);

        if (next >= 1 && !triggeredRef.current) {
          triggeredRef.current = true;
          holdingRef.current = false;
          setHolding(false);
          setDone(true);
          stopRaf();
          void onHold?.();

          if (resetAfter > 0) {
            resetTimerRef.current = window.setTimeout(() => {
              progressRef.current = 0;
              setProgress(0);
              setDone(false);
              triggeredRef.current = false;
            }, resetAfter);
          }
          return;
        }
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        const next = Math.max(0, progressRef.current - dt / Math.max(50, releaseTime));
        progressRef.current = next;
        setProgress(next);
        if (next <= 0) {
          stopRaf();
          return;
        }
        rafRef.current = window.requestAnimationFrame(tick);
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);
  }, [holdTime, releaseTime, onHold, resetAfter, stopRaf]);

  const startHold = () => {
    if (disabled || done) return;
    if (onBeforeHold && !onBeforeHold()) {
      return;
    }
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    triggeredRef.current = false;
    holdingRef.current = true;
    setHolding(true);
    runLoop();
  };

  const cancelHold = () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHolding(false);
    runLoop();
  };

  const pct = Math.round(progress * 1000) / 10;
  const fromLeft = fillDirection === "left";
  // If fillDirection="right", fill sweeps from right edge leftward (or toward right).
  // Specifically: clipPath inset ensures exact matching fill/text sweep!
  const clipInset = fromLeft
    ? `inset(0 ${100 - pct}% 0 0)`
    : `inset(0 0 0 ${100 - pct}%)`;

  const displayContent = done ? doneLabel : children;

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        startHold();
      }}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          startHold();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          cancelHold();
        }
      }}
      className={`relative flex w-full select-none items-center justify-center overflow-hidden font-semibold uppercase tracking-[0.18em] transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-50 ${SIZE_CLASSES[size]} ${className}`}
      style={{
        backgroundColor,
        color: textColor,
        borderRadius: `${radius}px`,
        transform: holding ? `scale(${pressScale})` : "scale(1)",
        boxShadow:
          glow && (holding || done)
            ? `0 0 26px ${fillColor}66, 0 8px 24px rgba(0,0,0,0.28)`
            : "0 4px 14px rgba(0,0,0,0.18)",
        touchAction: "none",
      }}
      aria-live="polite"
    >
      {/* Base Idle Text Layer */}
      <span className="relative z-10 pointer-events-none">{displayContent}</span>

      {/* Animated Fill Bar + Optional Liquid Wave Edge */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 z-10 overflow-visible"
        style={{
          backgroundColor: fillColor,
          width: `${pct}%`,
          left: fromLeft ? 0 : "auto",
          right: fromLeft ? "auto" : 0,
        }}
      >
        {wave && progress > 0.01 && progress < 0.995 && (
          <svg
            viewBox="0 0 24 100"
            preserveAspectRatio="none"
            className="absolute top-0 h-full w-4"
            style={{
              left: fromLeft ? "100%" : "auto",
              right: fromLeft ? "auto" : "100%",
              transform: fromLeft
                ? `translateX(-1px) scaleX(${waveAmplitude / 6})`
                : `translateX(1px) scaleX(${-(waveAmplitude / 6)})`,
            }}
          >
            <path
              d="M0 0 C8 18, 2 35, 10 50 C18 65, 4 82, 0 100 Z"
              fill={fillColor}
            />
          </svg>
        )}
      </span>

      {/* Clipped High-Contrast Text Layer Above Fill */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
        style={{
          color: fillTextColor,
          clipPath: clipInset,
        }}
      >
        {displayContent}
      </span>
    </button>
  );
}

export default HoldButton;
