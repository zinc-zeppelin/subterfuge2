/**
 * Visual Theme Manager for Project Subterfuge.
 * 
 * Supports:
 * - "dark": Cold War CRT Green/Amber Terminal aesthetic (Default)
 * - "manila": Classified Government Intelligence Manila Paper / Typewriter Ink aesthetic
 */

export type ThemeMode = "dark" | "manila";

const THEME_STORAGE_KEY = "subterfuge_theme";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "manila" ? "manila" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (mode === "manila") {
    root.classList.remove("dark");
    root.classList.add("theme-manila");
  } else {
    root.classList.remove("theme-manila");
    root.classList.add("dark");
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // storage fallback
  }
}

export function toggleTheme(): ThemeMode {
  const current = getStoredTheme();
  const next: ThemeMode = current === "dark" ? "manila" : "dark";
  applyTheme(next);
  return next;
}

export function initTheme(): ThemeMode {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}
