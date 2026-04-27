// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyTheme,
  getInitialTheme,
  useTheme,
} from "../src/hooks/useTheme";

const STORAGE_KEY = "dashproof-lab.theme";

function setMatchMediaLight(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-color-scheme: light)" ? matches : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  setMatchMediaLight(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getInitialTheme", () => {
  it("returns stored value from localStorage when set to light", () => {
    window.localStorage.setItem(STORAGE_KEY, "light");
    expect(getInitialTheme()).toBe("light");
  });

  it("returns stored value from localStorage when set to dark", () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");
    expect(getInitialTheme()).toBe("dark");
  });

  it("ignores invalid stored values and falls back", () => {
    window.localStorage.setItem(STORAGE_KEY, "garbage");
    setMatchMediaLight(true);
    expect(getInitialTheme()).toBe("light");
  });

  it("falls back to prefers-color-scheme: light when no stored value", () => {
    setMatchMediaLight(true);
    expect(getInitialTheme()).toBe("light");
  });

  it("defaults to dark when nothing matches", () => {
    setMatchMediaLight(false);
    expect(getInitialTheme()).toBe("dark");
  });
});

describe("applyTheme", () => {
  it("sets the data-theme attribute on <html>", () => {
    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

describe("useTheme", () => {
  it("seeds state from existing data-theme on <html>", () => {
    document.documentElement.dataset.theme = "light";
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
  });

  it("seeds from getInitialTheme when no data-theme is set", () => {
    setMatchMediaLight(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
  });

  it("toggle flips theme, updates DOM, and persists to localStorage", () => {
    document.documentElement.dataset.theme = "dark";
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggle();
    });

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("light");

    act(() => {
      result.current.toggle();
    });

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("setTheme writes the requested value", () => {
    document.documentElement.dataset.theme = "dark";
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme("light");
    });

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("light");
  });
});
