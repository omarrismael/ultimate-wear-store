"use client";

import React, { useEffect, useRef, useState } from "react";

export type CodeSlotsStatus = "idle" | "verifying" | "success" | "error";

export interface CodeSlotsProps {
  length?: number;
  value?: string;
  status?: CodeSlotsStatus;
  onChange?: (code: string) => void;
  onComplete?: (code: string) => void | Promise<void>;
  accentColor?: string;
  inkColor?: string;
  slotColor?: string;
  digitColor?: string;
  dangerColor?: string;
  slotSize?: number;
  gap?: number;
  radius?: number;
  bounce?: number;
  settle?: number;
  rise?: number;
  cascade?: number;
  mask?: boolean;
  caret?: boolean;
  outcome?: "accept" | "clear";
  disabled?: boolean;
}

export function CodeSlots({
  length = 6,
  value: controlledValue,
  status = "idle",
  onChange,
  onComplete,
  accentColor = "#f5f5f5",
  inkColor = "#f5f5f5",
  slotColor = "#27272a",
  digitColor = "#18181b",
  dangerColor = "#ff3b30",
  slotSize = 44,
  gap = 8,
  radius = 12,
  bounce = 0.2,
  settle = 0.3,
  rise = 8,
  cascade = 20,
  mask = false,
  caret = true,
  outcome = "accept",
  disabled = false,
}: CodeSlotsProps) {
  const [internalValue, setInternalValue] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastCompletedRef = useRef<string>("");

  const code = (controlledValue ?? internalValue).slice(0, length);

  useEffect(() => {
    if (status === "idle" && code.length < length) {
      lastCompletedRef.current = "";
    }
    if (status === "error" && outcome === "clear" && controlledValue === undefined) {
      const t = window.setTimeout(() => {
        setInternalValue("");
        lastCompletedRef.current = "";
        onChange?.("");
      }, 450);
      return () => window.clearTimeout(t);
    }
  }, [status, outcome, code.length, length, controlledValue, onChange]);

  const updateCode = (raw: string) => {
    if (disabled) return;
    const cleaned = raw.replace(/\D/g, "").slice(0, length);
    if (controlledValue === undefined) {
      setInternalValue(cleaned);
    }
    onChange?.(cleaned);
    if (cleaned.length === length && cleaned !== lastCompletedRef.current) {
      lastCompletedRef.current = cleaned;
      void onComplete?.(cleaned);
    }
  };

  const activeSlot = Math.min(code.length, length - 1);
  const settleMs = Math.round(settle * 1000);
  const timingFn = `cubic-bezier(0.34, ${(1 + bounce * 2.2).toFixed(2)}, 0.64, 1)`;

  return (
    <div
      dir="ltr"
      onClick={() => !disabled && inputRef.current?.focus()}
      className={`relative inline-flex max-w-full select-none items-center justify-center ${
        disabled ? "cursor-not-allowed opacity-55" : "cursor-text"
      } ${status === "error" ? "animate-slots-shake" : ""}`}
      style={{ gap: `clamp(4px, 1.5vw, ${gap}px)` }}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        disabled={disabled}
        value={code}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => updateCode(e.target.value)}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
          if (pasted) {
            e.preventDefault();
            updateCode(pasted);
          }
        }}
        aria-label={`${length}-digit verification code`}
        className="absolute inset-0 z-10 h-full w-full opacity-0"
      />

      {Array.from({ length }).map((_, idx) => {
        const char = code[idx] ?? "";
        const isCurrent = focused && idx === activeSlot && !disabled;
        const isFilled = char.length > 0;
        const isSuccess = status === "success";
        const isError = status === "error";

        const borderColor = isError
          ? dangerColor
          : isSuccess
            ? "#D4AF37"
            : isCurrent
              ? accentColor
              : isFilled
                ? accentColor
                : "rgba(161, 161, 170, 0.35)";

        const bg = isFilled ? digitColor : slotColor;
        const fg = isError ? dangerColor : isSuccess ? "#D4AF37" : inkColor;

        return (
          <div
            key={idx}
            className="relative flex items-center justify-center overflow-hidden font-mono text-base font-semibold transition-all sm:text-lg"
            style={{
              width: `clamp(34px, 11.5vw, ${slotSize}px)`,
              height: `clamp(38px, 12.5vw, ${slotSize + 4}px)`,
              borderRadius: `${radius}px`,
              backgroundColor: bg,
              color: fg,
              border: `1.5px solid ${borderColor}`,
              boxShadow: isCurrent
                ? `0 0 0 2px ${accentColor}33`
                : isError
                  ? `0 0 0 2px ${dangerColor}33`
                  : "none",
              transform: isSuccess
                ? "translate3d(0, -2px, 0) scale(1.04)"
                : "translate3d(0, 0, 0)",
              transitionDuration: `${settleMs}ms`,
              transitionTimingFunction: timingFn,
              transitionDelay: isSuccess ? `${idx * cascade}ms` : "0ms",
            }}
          >
            {isFilled ? (
              <span
                key={`${idx}-${char}`}
                className="inline-block will-change-transform"
                style={{
                  animation: `slotDigitRise ${settleMs}ms ${timingFn} forwards`,
                  ["--slot-rise" as string]: `${rise}px`,
                }}
              >
                {mask ? "•" : char}
              </span>
            ) : caret && isCurrent ? (
              <span
                aria-hidden="true"
                className="h-5 w-[1.5px] animate-pulse rounded-full"
                style={{ backgroundColor: accentColor }}
              />
            ) : null}
          </div>
        );
      })}

      <style jsx>{`
        @keyframes slotDigitRise {
          from {
            opacity: 0;
            transform: translate3d(0, var(--slot-rise, 8px), 0) scale(0.88);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        @keyframes slotsShake {
          0%, 100% { transform: translate3d(0, 0, 0); }
          20% { transform: translate3d(-6px, 0, 0); }
          40% { transform: translate3d(6px, 0, 0); }
          60% { transform: translate3d(-4px, 0, 0); }
          80% { transform: translate3d(4px, 0, 0); }
        }
        .animate-slots-shake {
          animation: slotsShake 340ms ease-in-out;
        }
      `}</style>
    </div>
  );
}

export default CodeSlots;
