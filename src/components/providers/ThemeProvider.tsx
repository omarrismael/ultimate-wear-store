"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { THEME_COOKIE_NAME } from "@/lib/constants";

export type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({
  initialTheme = "light",
  children,
}: {
  initialTheme?: ThemeMode;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme);

  const applyTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", next);
      document.documentElement.style.colorScheme = next;
      document.cookie = `${THEME_COOKIE_NAME}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_COOKIE_NAME, next);
    }
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_COOKIE_NAME);
    if (saved === "dark" || saved === "light") {
      if (saved !== theme) {
        applyTheme(saved);
      } else {
        document.documentElement.setAttribute("data-theme", saved);
        document.documentElement.style.colorScheme = saved;
      }
    } else {
      document.documentElement.setAttribute("data-theme", initialTheme);
      document.documentElement.style.colorScheme = initialTheme;
    }
  }, [applyTheme, initialTheme, theme]);

  const toggleTheme = useCallback(() => {
    applyTheme(theme === "light" ? "dark" : "light");
  }, [applyTheme, theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: applyTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
