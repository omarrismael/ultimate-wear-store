"use client";

import React, { useEffect, useRef } from "react";

type NumericProp = number | string;

export interface ElectricLogoProps {
  src?: string;
  arcs?: NumericProp;
  bend?: NumericProp;
  color?: string;
  crackle?: NumericProp;
  cursorIntensity?: NumericProp;
  cursorRadius?: NumericProp;
  fill?: NumericProp;
  flicker?: NumericProp;
  glow?: NumericProp;
  glowColor?: string;
  intensity?: NumericProp;
  interactive?: boolean;
  scale?: NumericProp;
  speed?: NumericProp;
  strands?: NumericProp;
  thickness?: NumericProp;
  className?: string;
}

interface EdgePoint {
  x: number;
  y: number;
}

function parseNumeric(value: NumericProp | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[{}\s]/g, "");
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function pseudoNoise(seed: number): number {
  const s = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export function ElectricLogo({
  src = "/logo.svg",
  arcs = 1,
  bend = 0.6,
  color = "#ecc7ff",
  crackle = 1.5,
  cursorIntensity = 0.75,
  cursorRadius = 100,
  fill = 0,
  flicker = 0.6,
  glow = 1,
  glowColor = "#ad6dff",
  intensity = 1,
  interactive = true,
  scale = 0.7,
  speed = 2.5,
  strands = 4,
  thickness = 1.5,
  className = "",
}: ElectricLogoProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const cfg = {
    arcs: Math.max(1, Math.round(parseNumeric(arcs, 1))),
    bend: clamp(parseNumeric(bend, 0.6), 0, 2.5),
    crackle: clamp(parseNumeric(crackle, 1.5), 0, 4),
    cursorIntensity: clamp(parseNumeric(cursorIntensity, 0.75), 0, 2),
    cursorRadius: Math.max(20, parseNumeric(cursorRadius, 100)),
    fill: clamp(parseNumeric(fill, 0), 0, 1),
    flicker: clamp(parseNumeric(flicker, 0.6), 0, 1),
    glow: clamp(parseNumeric(glow, 1), 0, 2.5),
    intensity: clamp(parseNumeric(intensity, 1), 0.1, 2.5),
    scale: clamp(parseNumeric(scale, 0.7), 0.2, 1.25),
    speed: clamp(parseNumeric(speed, 2.5), 0.1, 8),
    strands: Math.max(1, Math.round(parseNumeric(strands, 4))),
    thickness: clamp(parseNumeric(thickness, 1.5), 0.5, 5),
  };

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    let rafId = 0;
    let width = Math.max(200, container.clientWidth);
    let height = Math.max(180, container.clientHeight);
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const pointer = {
      x: width / 2,
      y: height / 2,
      active: false,
    };

    const img = new Image();
    img.crossOrigin = "anonymous";
    let imageLoaded = false;
    let edgePoints: EdgePoint[] = [];
    let drawRect = { x: 0, y: 0, w: 0, h: 0 };

    const sampleLogoContours = () => {
      if (!imageLoaded || img.width === 0 || img.height === 0) return;

      const maxDrawW = width * cfg.scale;
      const maxDrawH = height * cfg.scale * 0.72;
      const aspect = img.width / img.height;

      let drawW = maxDrawW;
      let drawH = drawW / aspect;
      if (drawH > maxDrawH) {
        drawH = maxDrawH;
        drawW = drawH * aspect;
      }

      const drawX = (width - drawW) / 2;
      const drawY = (height - drawH) / 2;
      drawRect = { x: drawX, y: drawY, w: drawW, h: drawH };

      const sampleW = Math.max(64, Math.min(260, Math.round(drawW)));
      const sampleH = Math.max(32, Math.min(140, Math.round(drawH)));
      const offscreen = document.createElement("canvas");
      offscreen.width = sampleW;
      offscreen.height = sampleH;
      const octx = offscreen.getContext("2d");
      if (!octx) return;

      octx.clearRect(0, 0, sampleW, sampleH);
      octx.drawImage(img, 0, 0, sampleW, sampleH);
      const pixels = octx.getImageData(0, 0, sampleW, sampleH).data;

      const points: EdgePoint[] = [];
      for (let y = 1; y < sampleH - 1; y += 2) {
        for (let x = 1; x < sampleW - 1; x += 2) {
          const alpha = pixels[(y * sampleW + x) * 4 + 3];
          if (alpha < 90) continue;
          const up = pixels[((y - 1) * sampleW + x) * 4 + 3];
          const down = pixels[((y + 1) * sampleW + x) * 4 + 3];
          const left = pixels[(y * sampleW + (x - 1)) * 4 + 3];
          const right = pixels[(y * sampleW + (x + 1)) * 4 + 3];
          if (up < 80 || down < 80 || left < 80 || right < 80) {
            points.push({
              x: drawX + (x / sampleW) * drawW,
              y: drawY + (y / sampleH) * drawH,
            });
          }
        }
      }

      edgePoints = points;
    };

    const resize = () => {
      if (!container || !canvas) return;
      width = Math.max(200, container.clientWidth);
      height = Math.max(180, container.clientHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sampleLogoContours();
    };

    const drawLightningBolt = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      seed: number,
      alpha: number,
      lineWidth: number
    ) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) return;

      const nx = -dy / dist;
      const ny = dx / dist;
      const segments = clamp(Math.round(dist / 12), 5, 16);

      ctx.beginPath();
      ctx.moveTo(x1, y1);

      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const envelope = Math.sin(t * Math.PI);
        const arcOffset =
          Math.sin(t * Math.PI) *
          cfg.bend *
          14 *
          (pseudoNoise(seed * 3.1) - 0.5);
        const jitter =
          (pseudoNoise(seed + i * 7.13) - 0.5) *
          2 *
          cfg.crackle *
          9 *
          envelope;

        let px = x1 + dx * t + nx * (jitter + arcOffset);
        let py = y1 + dy * t + ny * (jitter + arcOffset);

        if (interactive && pointer.active) {
          const pdx = px - pointer.x;
          const pdy = py - pointer.y;
          const pdist = Math.hypot(pdx, pdy);
          if (pdist < cfg.cursorRadius && pdist > 0.5) {
            const force =
              (1 - pdist / cfg.cursorRadius) * cfg.cursorIntensity * 22;
            px -= (pdx / pdist) * force;
            py -= (pdy / pdist) * force;
          }
        }

        ctx.lineTo(px, py);
      }

      ctx.lineTo(x2, y2);
      ctx.strokeStyle = color;
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    };

    const startTime = performance.now();

    const renderFrame = (now: number) => {
      if (disposed) return;

      const elapsed = ((now - startTime) / 1000) * cfg.speed;
      ctx.clearRect(0, 0, width, height);

      if (imageLoaded && drawRect.w > 0) {
        // Optional subtle silhouette fill + ambient plasma glow behind logo
        if (cfg.fill > 0) {
          ctx.save();
          ctx.globalAlpha = cfg.fill;
          ctx.drawImage(img, drawRect.x, drawRect.y, drawRect.w, drawRect.h);
          ctx.restore();
        }

        // Faint core watermark silhouette so the wordmark stays legible even with fill={0}
        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 18 * cfg.glow;
        ctx.drawImage(img, drawRect.x, drawRect.y, drawRect.w, drawRect.h);
        ctx.restore();
      }

      if (edgePoints.length > 6) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalCompositeOperation = "screen";
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 16 * cfg.glow;

        const flickerMod =
          1 -
          cfg.flicker *
            0.42 *
            (0.5 + 0.5 * Math.sin(elapsed * 19 + pseudoNoise(Math.floor(elapsed * 8))));

        // 1. Electric contour strands hugging the SVG outline
        const stride = Math.max(2, Math.floor(edgePoints.length / (32 * cfg.arcs)));
        for (let s = 0; s < cfg.strands; s++) {
          const offset = Math.floor(elapsed * (3 + s * 1.4)) % edgePoints.length;
          for (let i = 0; i < edgePoints.length - stride; i += stride * 2) {
            const idxA = (i + offset) % edgePoints.length;
            const idxB = (idxA + stride) % edgePoints.length;
            const p1 = edgePoints[idxA];
            const p2 = edgePoints[idxB];
            const gap = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (gap > drawRect.w * 0.28 || gap < 3) continue;

            drawLightningBolt(
              p1.x,
              p1.y,
              p2.x,
              p2.y,
              elapsed * 4.5 + i + s * 31,
              0.55 * cfg.intensity * flickerMod,
              cfg.thickness * (s === 0 ? 1.15 : 0.75)
            );
          }
        }

        // 2. High-energy perimeter arcs bridging distant edge points
        const arcCount = cfg.strands * cfg.arcs * 2;
        for (let a = 0; a < arcCount; a++) {
          const bucket = Math.floor(elapsed * 6 + a * 1.7);
          const idx1 =
            Math.floor(pseudoNoise(bucket * 3.7 + a) * edgePoints.length) %
            edgePoints.length;
          const jump = Math.max(
            6,
            Math.min(
              edgePoints.length - 1,
              Math.round(edgePoints.length * (0.04 + 0.1 * pseudoNoise(bucket + a * 9)))
            )
          );
          const idx2 = (idx1 + jump) % edgePoints.length;
          const p1 = edgePoints[idx1];
          const p2 = edgePoints[idx2];
          if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > drawRect.w * 0.48) continue;

          drawLightningBolt(
            p1.x,
            p1.y,
            p2.x,
            p2.y,
            bucket + a * 17.3,
            0.85 * cfg.intensity * flickerMod,
            cfg.thickness
          );
        }

        // 3. Interactive cursor arcs attracted to pointer inside cursorRadius
        if (interactive && pointer.active) {
          const nearby: EdgePoint[] = [];
          for (let i = 0; i < edgePoints.length; i += 3) {
            const pt = edgePoints[i];
            if (Math.hypot(pt.x - pointer.x, pt.y - pointer.y) <= cfg.cursorRadius * 1.35) {
              nearby.push(pt);
            }
          }
          const strikes = Math.min(4, nearby.length);
          for (let k = 0; k < strikes; k++) {
            const pick =
              nearby[
                Math.floor(pseudoNoise(elapsed * 12 + k * 7) * nearby.length) %
                  nearby.length
              ];
            drawLightningBolt(
              pick.x,
              pick.y,
              pointer.x,
              pointer.y,
              elapsed * 9 + k * 19,
              clamp(0.8 * cfg.cursorIntensity * cfg.intensity, 0.1, 1),
              cfg.thickness * 1.1
            );
          }
        }

        ctx.restore();
      }

      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };

    const handlePointerLeave = () => {
      pointer.active = false;
    };

    img.onload = () => {
      if (disposed) return;
      imageLoaded = true;
      sampleLogoContours();
      if (reducedMotion) {
        renderFrame(performance.now());
      }
    };
    img.src = src;

    resize();
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(container);

    if (interactive) {
      canvas.addEventListener("pointermove", handlePointerMove);
      canvas.addEventListener("pointerleave", handlePointerLeave);
    }

    if (!reducedMotion) {
      rafId = window.requestAnimationFrame(renderFrame);
    }

    return () => {
      disposed = true;
      img.onload = null;
      img.onerror = null;
      window.cancelAnimationFrame(rafId);
      ro?.disconnect();
      if (interactive) {
        canvas.removeEventListener("pointermove", handlePointerMove);
        canvas.removeEventListener("pointerleave", handlePointerLeave);
      }
    };
  }, [
    src,
    color,
    glowColor,
    interactive,
    cfg.arcs,
    cfg.bend,
    cfg.crackle,
    cfg.cursorIntensity,
    cfg.cursorRadius,
    cfg.fill,
    cfg.flicker,
    cfg.glow,
    cfg.intensity,
    cfg.scale,
    cfg.speed,
    cfg.strands,
    cfg.thickness,
  ]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

export default ElectricLogo;
