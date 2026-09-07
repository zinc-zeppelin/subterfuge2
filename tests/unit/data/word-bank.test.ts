import { describe, it, expect } from "vitest";
import {
  AVAILABLE_THEMES,
  WORD_BANK,
  getRandomTheme,
  drawWordsForTheme,
  ThemeType,
} from "@/lib/data/word-bank";

describe("Word Bank & Theme Vocabulary Capacity", () => {
  it("defines exactly 10 distinct operational themes", () => {
    expect(AVAILABLE_THEMES.length).toBe(10);
    const uniqueThemes = new Set(AVAILABLE_THEMES);
    expect(uniqueThemes.size).toBe(10);
  });

  it("ensures EVERY theme contains at least 12 unique words for max player count", () => {
    for (const theme of AVAILABLE_THEMES) {
      const wordsForTheme = WORD_BANK.filter((entry) =>
        entry.themes.map((t) => t.toUpperCase()).includes(theme.toUpperCase())
      );
      const uniqueWords = new Set(wordsForTheme.map((w) => w.word.trim().toUpperCase()));

      expect(
        uniqueWords.size,
        `Theme '${theme}' must have at least 12 words for 12-player operations, but only has ${uniqueWords.size}`
      ).toBeGreaterThanOrEqual(12);
    }
  });

  it("draws the exact requested word count without duplicates", () => {
    for (const theme of AVAILABLE_THEMES) {
      for (const count of [1, 4, 6, 8, 12]) {
        const drawn = drawWordsForTheme(theme, count);
        expect(drawn.length).toBe(count);

        const uniqueDrawn = new Set(drawn.map((w) => w.toUpperCase()));
        expect(uniqueDrawn.size).toBe(count);
      }
    }
  });

  it("draws words that authentically belong to the requested theme", () => {
    const danceWords = drawWordsForTheme("DANCE", 6);
    for (const word of danceWords) {
      const entry = WORD_BANK.find((e) => e.word.toUpperCase() === word.toUpperCase());
      expect(entry).toBeDefined();
      expect(entry?.themes.map((t) => t.toUpperCase())).toContain("DANCE");
    }
  });

  it("handles case-insensitivity in theme name", () => {
    const drawnLower = drawWordsForTheme("dance", 4);
    expect(drawnLower.length).toBe(4);
    const drawnMixed = drawWordsForTheme("DaNcE", 4);
    expect(drawnMixed.length).toBe(4);
  });

  it("throws descriptive error if requested word count exceeds theme vocabulary", () => {
    expect(() => drawWordsForTheme("DANCE", 9999)).toThrowError(
      /Insufficient words for theme 'DANCE'/
    );
  });

  it("throws descriptive error for invalid or unknown themes", () => {
    expect(() => drawWordsForTheme("INVALID_NONEXISTENT_THEME", 1)).toThrowError(
      /Insufficient words for theme 'INVALID_NONEXISTENT_THEME'/
    );
  });

  it("getRandomTheme returns a valid theme from AVAILABLE_THEMES", () => {
    for (let i = 0; i < 20; i++) {
      const theme = getRandomTheme();
      expect(AVAILABLE_THEMES).toContain(theme);
    }
  });
});
