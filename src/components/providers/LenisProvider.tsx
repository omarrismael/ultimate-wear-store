"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { ADMIN_PORTAL_PATH } from "@/lib/constants";

type ScrollListener = (scrollY: number) => void;

interface LenisContextValue {
  scrollTo: (target: string | number | HTMLElement, offset?: number) => void;
  stopScroll: () => void;
  startScroll: () => void;
  subscribeScroll: (listener: ScrollListener) => () => void;
}

const LenisContext = createContext<LenisContextValue>({
  scrollTo: () => {},
  stopScroll: () => {},
  startScroll: () => {},
  subscribeScroll: () => () => {},
});

export function LenisProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lenisRef = useRef<Lenis | null>(null);
  const listenersRef = useRef<Set<ScrollListener>>(new Set());

  const isAdminRoute =
    pathname?.startsWith(ADMIN_PORTAL_PATH) || pathname?.startsWith("/admin");

  useEffect(() => {
    if (isAdminRoute) {
      lenisRef.current?.destroy();
      lenisRef.current = null;
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isCoarseMobile =
      window.matchMedia("(pointer: coarse)").matches &&
      window.innerWidth < 768;

    if (prefersReducedMotion || isCoarseMobile) {
      const onNativeScroll = () => {
        const y = window.scrollY;
        listenersRef.current.forEach((cb) => cb(y));
      };
      window.addEventListener("scroll", onNativeScroll, { passive: true });
      return () => window.removeEventListener("scroll", onNativeScroll);
    }

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4,
    });

    lenisRef.current = lenis;

    lenis.on("scroll", ({ scroll }) => {
      listenersRef.current.forEach((cb) => cb(scroll));
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = window.requestAnimationFrame(raf);
    };
    rafId = window.requestAnimationFrame(raf);

    return () => {
      window.cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [isAdminRoute]);

  useEffect(() => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  const scrollTo = useCallback(
    (target: string | number | HTMLElement, offset = -72) => {
      if (lenisRef.current) {
        lenisRef.current.scrollTo(target, { offset, duration: 1.1 });
        return;
      }
      if (typeof target === "string") {
        const el = document.querySelector(target);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      } else if (typeof target === "number") {
        window.scrollTo({ top: target, behavior: "smooth" });
      } else {
        target.scrollIntoView({ behavior: "smooth" });
      }
    },
    []
  );

  const stopScroll = useCallback(() => {
    lenisRef.current?.stop();
  }, []);

  const startScroll = useCallback(() => {
    lenisRef.current?.start();
  }, []);

  const subscribeScroll = useCallback((listener: ScrollListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  return (
    <LenisContext.Provider
      value={{ scrollTo, stopScroll, startScroll, subscribeScroll }}
    >
      {children}
    </LenisContext.Provider>
  );
}

export function useLenis() {
  return useContext(LenisContext);
}
