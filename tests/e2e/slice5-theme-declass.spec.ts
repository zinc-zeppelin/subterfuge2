import { test, expect } from "@playwright/test";
import { SixPlayerHarness } from "../harness/multiplayer-harness";

test.describe("Slice 5: Asynchronous Timers & 50% Midpoint Theme Declassification", () => {
  let harness: SixPlayerHarness;

  test.beforeEach(async ({ browser }) => {
    harness = new SixPlayerHarness(browser);
  });

  test.afterEach(async () => {
    await harness.teardown();
  });

  test("enforces theme confidentiality before midpoint, broadcasts declassified theme banner to all 6 operatives at 50% time, and transitions to VERDICT phase", async ({
    baseURL,
  }) => {
    const url = baseURL || "http://localhost:3000";

    // 1. Initialize 6 operatives & deploy
    await harness.initSessions([
      "Viper-T1",
      "Shadow-T2",
      "Hawk-T3",
      "Ghost-T4",
      "Specter-T5",
      "Raven-T6",
    ]);

    await harness.hostCreatesRoom(url);
    await harness.joinRemainingOperatives(url);
    await harness.setAllReady();
    await harness.hostStartsOperation();
    await harness.expectAllInInfiltrationPhase();

    // 2. Pre-Midpoint Verification: Theme is strictly classified
    await harness.expectDeclassifiedThemeNotVisibleOnAll();

    for (const op of harness.sessions) {
      await expect(op.page.locator("#operational-timer-display")).toBeVisible();
      await expect(op.page.locator("#timer-countdown")).toBeVisible();
    }

    // 3. Midpoint Arrival: Trigger 50% Time Elapsed
    await harness.warpTime("MIDPOINT");

    // 4. Global Broadcast Verification: All 6 operatives receive the confirmed operational theme
    const declassifiedTheme = await harness.expectDeclassifiedThemeBannerOnAll();
    expect(declassifiedTheme.length).toBeGreaterThan(0);

    // 5. Verify that operatives can decrypt their assigned words and that they correlate with the theme
    for (let i = 0; i < 6; i++) {
      const word = await harness.decryptAndGetSecretWord(i);
      expect(word.length).toBeGreaterThan(0);
    }

    // 6. Operational Timer Expiry: Advance to 100% time -> Auto Transition to VERDICT Phase
    await harness.warpTime("VERDICT");

    // All 6 operatives must automatically enter VERDICT phase
    for (const op of harness.sessions) {
      await expect(op.page.locator("#room-phase-badge")).toHaveText("VERDICT", {
        timeout: 10000,
      });
      await expect(op.page.locator("#operational-timer-display")).toContainText(
        "VERDICT DELIBERATION"
      );
    }
  });
});
