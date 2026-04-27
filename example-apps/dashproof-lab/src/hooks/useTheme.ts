import { useCallback, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "dashproof-lab.theme";

export function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  if (window.matchMedia?.("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof document !== "undefined") {
      const current = document.documentElement.dataset.theme;
      if (current === "light" || current === "dark") return current;
    }
    return getInitialTheme();
  });

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}
