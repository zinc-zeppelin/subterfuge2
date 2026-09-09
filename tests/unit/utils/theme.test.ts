import { describe, it, expect, beforeEach, vi } from "vitest";
import { getStoredTheme, applyTheme, toggleTheme, initTheme } from "@/lib/utils/theme";

describe("Visual Theme Manager Subsystem", () => {
  const store: Record<string, string> = {};
  const classListSet = new Set<string>();

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    classListSet.clear();
    classListSet.add("dark");

    const mockLocalStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = String(value);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {},
    };

    const mockDocument = {
      documentElement: {
        classList: {
          add: (cls: string) => classListSet.add(cls),
          remove: (cls: string) => classListSet.delete(cls),
          contains: (cls: string) => classListSet.has(cls),
        },
        className: "dark",
      },
    };

    vi.stubGlobal("window", { localStorage: mockLocalStorage });
    vi.stubGlobal("document", mockDocument);
    vi.stubGlobal("localStorage", mockLocalStorage);
  });

  it("defaults to dark theme when no preference stored", () => {
    expect(getStoredTheme()).toBe("dark");
  });

  it("applies manila light theme, updates DOM class list and persists to localStorage", () => {
    applyTheme("manila");

    expect(getStoredTheme()).toBe("manila");
    expect(store["subterfuge_theme"]).toBe("manila");
    expect(classListSet.has("theme-manila")).toBe(true);
    expect(classListSet.has("dark")).toBe(false);
  });

  it("applies dark theme, updates DOM class list and persists to localStorage", () => {
    applyTheme("manila");
    applyTheme("dark");

    expect(getStoredTheme()).toBe("dark");
    expect(store["subterfuge_theme"]).toBe("dark");
    expect(classListSet.has("dark")).toBe(true);
    expect(classListSet.has("theme-manila")).toBe(false);
  });

  it("toggles theme between dark and manila", () => {
    applyTheme("dark");

    const toggled = toggleTheme();
    expect(toggled).toBe("manila");
    expect(classListSet.has("theme-manila")).toBe(true);

    const toggledBack = toggleTheme();
    expect(toggledBack).toBe("dark");
    expect(classListSet.has("dark")).toBe(true);
  });

  it("initializes theme from storage", () => {
    store["subterfuge_theme"] = "manila";
    const theme = initTheme();
    expect(theme).toBe("manila");
    expect(classListSet.has("theme-manila")).toBe(true);
  });
});
