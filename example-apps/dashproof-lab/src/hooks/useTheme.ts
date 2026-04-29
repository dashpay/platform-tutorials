import { useCallback, useSyncExternalStore } from "react";

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

let current: Theme | null = null;
const listeners = new Set<() => void>();

function readCurrent(): Theme {
  if (current !== null) return current;
  if (typeof document !== "undefined") {
    const fromDom = document.documentElement.dataset.theme;
    if (fromDom === "light" || fromDom === "dark") {
      current = fromDom;
      return current;
    }
  }
  current = getInitialTheme();
  return current;
}

function setThemeStore(next: Theme): void {
  current = next;
  applyTheme(next);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, next);
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Test-only: clear the cached value so a fresh DOM/localStorage snapshot is read.
export function __resetThemeStoreForTests(): void {
  current = null;
  listeners.clear();
}

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    readCurrent,
    () => "dark",
  );

  const setTheme = useCallback((next: Theme) => {
    setThemeStore(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeStore(theme === "dark" ? "light" : "dark");
  }, [theme]);

  return { theme, setTheme, toggle };
}
