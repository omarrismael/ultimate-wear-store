"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";

export interface CircularCarouselItem {
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
}

export interface CircularCarouselProps {
  items: CircularCarouselItem[];
  preset?: "cylinder" | "carousel";
  intro?: "rise" | "none";
  cardWidth?: number;
  aspectRatio?: number;
  speed?: number;
  captions?: boolean;
  gap?: number;
  tilt?: number;
  curve?: number;
  perspective?: number;
  autoplay?: "drift" | "step" | "none";
  interval?: number;
  direction?: "left" | "right";
  momentum?: number;
  snap?: boolean;
  pauseOnHover?: boolean;
  focusOnClick?: boolean;
  draggable?: boolean;
  parallax?: number;
  stretch?: number;
  fadeColor?: string;
  depthFade?: number;
  innerShade?: number;
  cornerRadius?: number;
  onActiveChange?: (index: number) => void;
}

export function CircularCarousel({
  items,
  preset = "cylinder",
  intro = "rise",
  cardWidth = 220,
  aspectRatio = 1,
  speed = 14,
  captions = false,
  gap = 25,
  tilt = -5,
  curve = 1,
  perspective = 2500,
  autoplay = "drift",
  interval = 3,
  direction = "left",
  momentum = 0.6,
  snap = true,
  pauseOnHover = true,
  focusOnClick = true,
  draggable = true,
  parallax = 0.3,
  stretch = 0.5,
  fadeColor = "#18181D",
  depthFade = 0.55,
  innerShade = 0.6,
  cornerRadius = 14,
  onActiveChange,
}: CircularCarouselProps) {
  const count = Math.max(1, items.length);
  const stepDeg = 360 / count;
  const radius = Math.max(
    190,
    Math.round(
      ((cardWidth + gap) / (2 * Math.tan(Math.PI / Math.max(count, 4)))) *
        (0.9 + stretch * 0.28)
    )
  );

  const stageRef = useRef<HTMLDivElement | null>(null);
  const cylinderWrapRef = useRef<HTMLDivElement | null>(null);
  const cardEls = useRef<(HTMLDivElement | null)[]>([]);
  const imgEls = useRef<(HTMLDivElement | null)[]>([]);
  const shadeEls = useRef<(HTMLDivElement | null)[]>([]);

  const angleRef = useRef(0);
  const targetAngleRef = useRef<number | null>(null);
  const velocityRef = useRef(0);
  const hoverTiltTargetRef = useRef({ rx: 0, ry: 0 });
  const hoverTiltCurrentRef = useRef({ rx: 0, ry: 0 });

  const isDraggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const dragStartXRef = useRef(0);
  const lastDragXRef = useRef(0);
  const isHoveredRef = useRef(false);
  const lastReportedActiveRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);

  const [mounted, setMounted] = useState(intro !== "rise");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (intro === "rise") {
      const id = window.requestAnimationFrame(() => setMounted(true));
      return () => window.cancelAnimationFrame(id);
    }
  }, [intro]);

  useEffect(() => {
    if (autoplay !== "step" || count <= 1) return;
    const dirSign = direction === "left" ? -1 : 1;
    const timer = window.setInterval(() => {
      if (pauseOnHover && isHoveredRef.current) return;
      if (isDraggingRef.current) return;
      const base = targetAngleRef.current ?? angleRef.current;
      targetAngleRef.current = base + dirSign * stepDeg;
    }, Math.max(1, interval) * 1000);
    return () => window.clearInterval(timer);
  }, [autoplay, interval, direction, stepDeg, count, pauseOnHover]);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const dirSign = direction === "left" ? -1 : 1;

    let rafId = 0;
    const animate = (now: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
      }
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      // Smooth subtle pointer tilt for true 3D spatial depth
      hoverTiltCurrentRef.current.rx +=
        (hoverTiltTargetRef.current.rx - hoverTiltCurrentRef.current.rx) * 0.1;
      hoverTiltCurrentRef.current.ry +=
        (hoverTiltTargetRef.current.ry - hoverTiltCurrentRef.current.ry) * 0.1;

      if (cylinderWrapRef.current) {
        const finalRx = tilt + hoverTiltCurrentRef.current.rx;
        const finalRy = hoverTiltCurrentRef.current.ry;
        cylinderWrapRef.current.style.transform = `rotateX(${finalRx.toFixed(
          2
        )}deg) rotateY(${finalRy.toFixed(2)}deg)`;
      }

      if (!isDraggingRef.current) {
        if (targetAngleRef.current !== null) {
          const diff = targetAngleRef.current - angleRef.current;
          // Silky critically-damped ease
          angleRef.current += diff * Math.min(1, dt * 6.5);
          if (Math.abs(diff) < 0.05) {
            angleRef.current = targetAngleRef.current;
            targetAngleRef.current = null;
          }
        } else if (Math.abs(velocityRef.current) > 0.03) {
          angleRef.current += velocityRef.current;
          const friction = Math.max(
            0.86,
            Math.min(0.96, 0.88 + momentum * 0.11)
          );
          velocityRef.current *= friction;
          if (snap && Math.abs(velocityRef.current) < 0.28) {
            velocityRef.current = 0;
            const nearest = Math.round(angleRef.current / stepDeg) * stepDeg;
            targetAngleRef.current = nearest;
          }
        } else if (
          autoplay === "drift" &&
          !prefersReduced &&
          !(pauseOnHover && isHoveredRef.current)
        ) {
          angleRef.current += dirSign * speed * dt;
        }
      }

      const rawIdx = Math.round(-angleRef.current / stepDeg);
      const normIdx = ((rawIdx % count) + count) % count;
      if (normIdx !== lastReportedActiveRef.current) {
        lastReportedActiveRef.current = normIdx;
        setActiveIndex(normIdx);
        onActiveChange?.(normIdx);
      }

      cardEls.current.forEach((el, idx) => {
        if (!el) return;
        const itemAngle = idx * stepDeg + angleRef.current;
        const rad = (itemAngle * Math.PI) / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);

        const frontFactor = (cosA + 1) / 2;
        const opacity = 1 - depthFade * (1 - frontFactor);
        const curveScale =
          preset === "cylinder" ? 0.8 + 0.22 * frontFactor * curve : 1;
        const zOffset = radius * (cosA - 1);
        const xOffset = radius * sinA * (0.9 + stretch * 0.25);

        el.style.transform = `translate3d(${xOffset.toFixed(
          2
        )}px, 0px, ${zOffset.toFixed(2)}px) rotateY(${(
          itemAngle * curve
        ).toFixed(2)}deg) scale(${curveScale.toFixed(3)})`;
        el.style.opacity = opacity.toFixed(3);
        el.style.zIndex = String(Math.round(frontFactor * 100));

        const imgWrap = imgEls.current[idx];
        if (imgWrap) {
          const pxShift = sinA * parallax * 28;
          imgWrap.style.transform = `translate3d(${pxShift.toFixed(
            2
          )}px, 0, 0) scale(1.08)`;
        }

        const shade = shadeEls.current[idx];
        if (shade) {
          const shadeOpacity = Math.max(0, (1 - frontFactor) * innerShade);
          shade.style.opacity = shadeOpacity.toFixed(3);
        }
      });

      rafId = window.requestAnimationFrame(animate);
    };

    rafId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    autoplay,
    count,
    curve,
    depthFade,
    direction,
    innerShade,
    momentum,
    onActiveChange,
    parallax,
    pauseOnHover,
    preset,
    radius,
    snap,
    speed,
    stepDeg,
    stretch,
    tilt,
  ]);

  const focusIndex = (idx: number) => {
    const currentNorm = -angleRef.current;
    const targetBase = idx * stepDeg;
    let delta = (((targetBase - currentNorm) % 360) + 540) % 360 - 180;
    if (Math.abs(delta) < 0.5) delta = 0;
    velocityRef.current = 0;
    targetAngleRef.current = angleRef.current - delta;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable) return;
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    dragStartXRef.current = e.clientX;
    lastDragXRef.current = e.clientX;
    targetAngleRef.current = null;
    velocityRef.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stageRef.current && e.pointerType !== "touch") {
      const rect = stageRef.current.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      hoverTiltTargetRef.current = { rx: -ny * 4.5, ry: nx * 5.5 };
    }

    if (!isDraggingRef.current || !draggable) return;
    const dx = e.clientX - lastDragXRef.current;
    if (Math.abs(e.clientX - dragStartXRef.current) > 6) {
      dragMovedRef.current = true;
    }
    lastDragXRef.current = e.clientX;
    const deltaAngle = dx * 0.42;
    angleRef.current += deltaAngle;
    velocityRef.current = deltaAngle * (0.45 + momentum * 0.45);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore release errors
    }
    if (snap && Math.abs(velocityRef.current) < 0.8) {
      targetAngleRef.current = Math.round(angleRef.current / stepDeg) * stepDeg;
    }
  };

  const cardHeight = Math.round(cardWidth / aspectRatio);

  return (
    <div
      ref={stageRef}
      onMouseEnter={() => {
        isHoveredRef.current = true;
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
        hoverTiltTargetRef.current = { rx: 0, ry: 0 };
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative flex h-full w-full select-none flex-col items-center justify-center overflow-hidden ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
      style={{
        perspective: `${perspective}px`,
        touchAction: "pan-y",
      }}
    >
      {/* Side fade edges */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 start-0 z-20 w-8 sm:w-14"
        style={{
          background: `linear-gradient(to right, ${fadeColor}, transparent)`,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 end-0 z-20 w-8 sm:w-14"
        style={{
          background: `linear-gradient(to left, ${fadeColor}, transparent)`,
        }}
      />

      {/* Ambient 3D Studio Floor Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-12 left-1/2 h-16 w-72 -translate-x-1/2 rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(ellipse, rgba(212,175,55,0.22) 0%, transparent 72%)",
        }}
      />

      {/* 3D Cylinder Stage */}
      <div
        ref={cylinderWrapRef}
        className={`relative flex items-center justify-center transition-opacity duration-700 will-change-transform ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
        style={{
          width: `${cardWidth}px`,
          height: `${cardHeight}px`,
          transformStyle: "preserve-3d",
        }}
      >
        {items.map((item, idx) => (
          <div
            key={`${item.src}-${idx}`}
            ref={(el) => {
              cardEls.current[idx] = el;
            }}
            onClick={() => {
              if (!dragMovedRef.current && focusOnClick) {
                focusIndex(idx);
              }
            }}
            className="group absolute inset-0 overflow-hidden border border-[#D4AF37]/35 bg-[#18181D] shadow-[0_26px_54px_rgba(0,0,0,0.42)] will-change-transform"
            style={{
              borderRadius: `${cornerRadius}px`,
              backfaceVisibility: "hidden",
            }}
          >
            <div
              ref={(el) => {
                imgEls.current[idx] = el;
              }}
              className="relative h-full w-full will-change-transform"
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                draggable={false}
                sizes={`${cardWidth}px`}
                className="object-cover"
              />
            </div>

            <div
              ref={(el) => {
                shadeEls.current[idx] = el;
              }}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[#09090B] transition-opacity duration-100"
              style={{ opacity: 0 }}
            />

            {captions && (item.title || item.subtitle) && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3">
                {item.title && (
                  <p className="text-xs font-semibold text-[#FFFFFF]">
                    {item.title}
                  </p>
                )}
                {item.subtitle && (
                  <p className="text-[10px] uppercase tracking-widest text-[#D4AF37]">
                    {item.subtitle}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Smooth Interactive Angle Pills (Front / Side / Back / Detail) */}
      {count > 1 && (
        <div className="absolute bottom-2.5 left-1/2 z-30 flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-glass)] p-1 backdrop-blur-md sm:bottom-3">
          {items.map((item, idx) => (
            <button
              key={`angle-${idx}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                focusIndex(idx);
              }}
              className={`rounded-full px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider transition-all duration-200 sm:px-3 sm:py-1 sm:text-[10px] ${
                activeIndex === idx
                  ? "bg-[#D4AF37] text-[#09090B] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {item.title || `${idx + 1}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default CircularCarousel;
