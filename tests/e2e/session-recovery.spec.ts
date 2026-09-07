/**
 * Domain: Session Recovery & Multi-Device Continuity
 *
 * Covers:
 *  - Personal recovery links, URL token scrubbing & duplicate callsign protection (was Slice 10)
 *  - Mid-game auto-resume via localStorage (mobile tab closure emulation)
 *  - Mid-game Recovery Portal for unauthenticated visitors during INFILTRATION
 */

import { test, expect } from "@playwright/test";
import path from "path";
import { SixPlayerHarness } from "../harness/multiplayer-harness";

const screenshotsDir = path.resolve(process.cwd(), "screenshots");

test.describe("Session Recovery — Personal Links, Auto-Resume & Recovery Portal", () => {
  test("verifies personal recovery link, url token scrubbing, duplicate callsign protection, mid-game auto-resume, and recovery portal", async ({
    browser,
    baseURL,
  }) => {
    const url = baseURL || "http://localhost:3000";

    // Grant clipboard permissions
    const p1Context = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const p1Page = await p1Context.newPage();
    await p1Page.setViewportSize({ width: 1280, height: 900 });

    // Step 1: P1 Establishes Operation
    await p1Page.goto(`${url}/`);
    await p1Page.fill("#callsign-input", "Commander-Alpha");
    await p1Page.click("#create-room-btn");
    await p1Page.waitForURL(/\/room\/[A-Z0-9]{6}/);

    const roomUrl = p1Page.url();
    const match = roomUrl.match(/\/room\/([A-Z0-9]{6})/);
    expect(match).toBeTruthy();
    const roomCode = match![1];

    // Step 2: Verify Lobby Invite Banner & Personal Recovery Link
    await expect(p1Page.locator("#room-invite-banner")).toBeVisible();
    const copyPersonalBtn = p1Page.locator("#copy-personal-link-btn");
    await expect(copyPersonalBtn).toBeVisible();

    // Click Personal Recovery Link to copy
    await copyPersonalBtn.click();
    await expect(copyPersonalBtn).toContainText("RECOVERY LINK COPIED!");

    // Read token from p1Page storage
    const p1Token = await p1Page.evaluate((code) => {
      return sessionStorage.getItem(`subterfuge_session_${code}`);
    }, roomCode);
    expect(p1Token).toBeTruthy();

    await p1Page.screenshot({ path: path.join(screenshotsDir, "17-lobby-personal-recovery-link.png") });

    // Step 3: P2 Joins
    const p2Context = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const p2Page = await p2Context.newPage();
    await p2Page.goto(`${url}/room/${roomCode}`);
    await expect(p2Page.locator("#join-operation-form")).toBeVisible();
    await p2Page.fill("#join-callsign-input", "Infiltrator-Bravo");
    await p2Page.click("#join-room-submit-btn");
    await expect(p2Page.locator("#player-roster > div")).toHaveCount(2, { timeout: 10000 });

    const p2Token = await p2Page.evaluate((code) => {
      return sessionStorage.getItem(`subterfuge_session_${code}`);
    }, roomCode);
    expect(p2Token).toBeTruthy();
    expect(p2Token).not.toEqual(p1Token);

    // Step 4: Callsign De-duplication in Lobby (Duplicate Name Rejection)
    const duplicateContext = await browser.newContext();
    const dupPage = await duplicateContext.newPage();
    await dupPage.goto(`${url}/room/${roomCode}`);
    await expect(dupPage.locator("#join-operation-form")).toBeVisible();
    await dupPage.fill("#join-callsign-input", "Commander-Alpha");
    await dupPage.click("#join-room-submit-btn");

    await expect(dupPage.locator("#join-error-banner")).toBeVisible({ timeout: 5000 });
    await expect(dupPage.locator("#join-error-banner")).toContainText("OPERATIVE_EXISTS");
    await duplicateContext.close();

    // Step 5: Cross-Browser Personal Recovery Link with URL Scrubbing
    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    await freshPage.goto(`${url}/room/${roomCode}?token=${p1Token}`);

    // Verify URL parameter was immediately scrubbed from the address bar
    await expect(async () => {
      const currentUrl = freshPage.url();
      expect(currentUrl).not.toContain("token=");
      expect(currentUrl).toContain(`/room/${roomCode}`);
    }).toPass({ timeout: 5000 });

    // Verify Commander-Alpha is restored as "YOU"
    await expect(freshPage.locator("#player-roster")).toBeVisible({ timeout: 10000 });
    const p1InRoster = freshPage.locator("#player-roster > div", { hasText: "Commander-Alpha" });
    await expect(p1InRoster.locator("text=YOU")).toBeVisible();
    await freshContext.close();

    // Step 6: Add 4 more players to meet 6-player requirement and start Infiltration
    const p3Context = await browser.newContext();
    const p3Page = await p3Context.newPage();
    await p3Page.goto(`${url}/room/${roomCode}`);
    await p3Page.fill("#join-callsign-input", "Agent-Charlie");
    await p3Page.click("#join-room-submit-btn");
    await expect(p3Page.locator("#toggle-ready-btn")).toBeVisible({ timeout: 10000 });

    const p4Context = await browser.newContext();
    const p4Page = await p4Context.newPage();
    await p4Page.goto(`${url}/room/${roomCode}`);
    await p4Page.fill("#join-callsign-input", "Agent-Delta");
    await p4Page.click("#join-room-submit-btn");
    await expect(p4Page.locator("#toggle-ready-btn")).toBeVisible({ timeout: 10000 });

    const p5Context = await browser.newContext();
    const p5Page = await p5Context.newPage();
    await p5Page.goto(`${url}/room/${roomCode}`);
    await p5Page.fill("#join-callsign-input", "Agent-Echo");
    await p5Page.click("#join-room-submit-btn");
    await expect(p5Page.locator("#toggle-ready-btn")).toBeVisible({ timeout: 10000 });

    const p6Context = await browser.newContext();
    const p6Page = await p6Context.newPage();
    await p6Page.goto(`${url}/room/${roomCode}`);
    await p6Page.fill("#join-callsign-input", "Agent-Foxtrot");
    await p6Page.click("#join-room-submit-btn");
    await expect(p6Page.locator("#toggle-ready-btn")).toBeVisible({ timeout: 10000 });

    // All declare ready
    await p1Page.click("#toggle-ready-btn");
    await expect(p1Page.locator("#toggle-ready-btn")).toContainText("CANCEL READY STATUS", { timeout: 10000 });
    await p2Page.click("#toggle-ready-btn");
    await expect(p2Page.locator("#toggle-ready-btn")).toContainText("CANCEL READY STATUS", { timeout: 10000 });
    await p3Page.click("#toggle-ready-btn");
    await expect(p3Page.locator("#toggle-ready-btn")).toContainText("CANCEL READY STATUS", { timeout: 10000 });
    await p4Page.click("#toggle-ready-btn");
    await expect(p4Page.locator("#toggle-ready-btn")).toContainText("CANCEL READY STATUS", { timeout: 10000 });
    await p5Page.click("#toggle-ready-btn");
    await expect(p5Page.locator("#toggle-ready-btn")).toContainText("CANCEL READY STATUS", { timeout: 10000 });
    await p6Page.click("#toggle-ready-btn");
    await expect(p6Page.locator("#toggle-ready-btn")).toContainText("CANCEL READY STATUS", { timeout: 10000 });

    // Host commences operations
    await expect(p1Page.locator("#start-operation-btn")).toBeEnabled({ timeout: 15000 });
    await p1Page.click("#start-operation-btn");

    // Verify all players transition into INFILTRATION
    await expect(p1Page.locator("#room-phase-badge")).toContainText("INFILTRATION", { timeout: 10000 });
    await expect(p2Page.locator("#room-phase-badge")).toContainText("INFILTRATION", { timeout: 10000 });

    // Step 7: Header Recovery Link in INFILTRATION
    const headerRecoveryBtn = p1Page.locator("#copy-personal-link-btn");
    await expect(headerRecoveryBtn).toBeVisible();

    // Step 8: Mid-Game Auto-Resume via localStorage (Mobile Tab Closure Emulation)
    // Clear sessionStorage in P1 page but keep localStorage
    await p1Page.evaluate((code) => {
      sessionStorage.removeItem(`subterfuge_session_${code}`);
    }, roomCode);

    // Reload the room page
    await p1Page.reload();

    // Should auto-resume into INFILTRATION station without prompts
    await expect(p1Page.locator("#room-phase-badge")).toContainText("INFILTRATION", { timeout: 10000 });
    await expect(p1Page.locator("#top-secret-dossier")).toBeVisible();
    await expect(p1Page.getByText("Commander-Alpha").first()).toBeVisible();

    await p1Page.screenshot({ path: path.join(screenshotsDir, "19-resumed-station-after-purge.png") });

    // Step 9: Mid-Game Recovery Portal (Clean Browser Context without storage)
    const unauthContext = await browser.newContext();
    const unauthPage = await unauthContext.newPage();
    await unauthPage.setViewportSize({ width: 1280, height: 900 });

    // Visiting active operation without session credentials displays Recovery Portal
    await unauthPage.goto(`${url}/room/${roomCode}`);
    await expect(unauthPage.locator("#reconnect-operation-card")).toBeVisible({ timeout: 10000 });
    await expect(unauthPage.locator("#recovery-token-input")).toBeVisible();
    await expect(unauthPage.locator("#resume-station-btn")).toBeVisible();

    await unauthPage.screenshot({ path: path.join(screenshotsDir, "18-mid-game-recovery-portal.png") });

    // Paste P2's personal link or token into the portal to reclaim station
    await unauthPage.fill("#recovery-token-input", `${url}/room/${roomCode}?token=${p2Token}`);
    await unauthPage.click("#resume-station-btn");

    // Verify P2 station is successfully restored
    await expect(unauthPage.locator("#room-phase-badge")).toContainText("INFILTRATION", { timeout: 10000 });
    await expect(unauthPage.locator("#top-secret-dossier")).toBeVisible();
    await expect(unauthPage.getByText("Infiltrator-Bravo").first()).toBeVisible();

    // Cleanup all contexts
    await p1Context.close();
    await p2Context.close();
    await p3Context.close();
    await p4Context.close();
    await p5Context.close();
    await p6Context.close();
    await unauthContext.close();
  });

  test("restores active deliberation slate and allows consensus confirmation after mid-game disconnect in VERDICT phase", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(180000);
    const url = baseURL || "http://localhost:3000";

    const harness = new SixPlayerHarness(browser);
    let recovContext: import("@playwright/test").BrowserContext | null = null;
    try {
      await harness.initSessions([
        "Alpha-Recov",
        "Bravo-Recov",
        "Charlie-Recov",
        "Delta-Recov",
        "Echo-Recov",
        "Foxtrot-Recov",
      ]);

      const roomCode = await harness.hostCreatesRoom(url);
      await harness.joinRemainingOperatives(url);
      await harness.setAllReady();
      await harness.hostStartsOperation();
      await harness.expectAllInInfiltrationPhase();

      // Collect dossier for Red team identification
      const dossiers = [];
      for (let i = 0; i < 6; i++) {
        dossiers.push({ idx: i, ...(await harness.getPlayerDossier(i)) });
      }
      const redOps = dossiers.filter((d) => d.apparentTeam === "RED");
      const red1 = redOps[0].idx;
      const red2 = redOps[1].idx;

      // Warp to VERDICT phase
      await harness.warpTime("VERDICT");
      await expect(harness.sessions[red1].page.locator("#room-phase-badge")).toContainText("VERDICT", { timeout: 15000 });
      await expect(harness.sessions[red2].page.locator("#room-phase-badge")).toContainText("VERDICT", { timeout: 15000 });

      // Red 1 fills 6 guesses and proposes verdict
      const guessWords = ["ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO", "FOXTROT"];
      for (const w of guessWords) {
        await harness.operativeAddVerdictGuess(red1, w);
      }
      await harness.operativeProposeVerdict(red1);

      // Verify pending proposal is visible to Red 2
      const red2Page = harness.sessions[red2].page;
      await expect(red2Page.locator("#pending-proposal-card")).toBeVisible({ timeout: 10000 });
      await expect(red2Page.locator("#pending-proposal-card")).toContainText("1/2 CONFIRMED");

      // Save Red 2's session token from storage
      const red2Token = await red2Page.evaluate((code) => {
        return sessionStorage.getItem(`subterfuge_session_${code}`);
      }, roomCode);
      expect(red2Token).toBeTruthy();

      // Simulate Red 2 disconnect (closing browser context)
      await harness.sessions[red2].context.close();

      // Red 2 reconnects in a fresh context using personal recovery link
      recovContext = await browser.newContext();
      const recovPage = await recovContext.newPage();
      await recovPage.goto(`${url}/room/${roomCode}?token=${red2Token}`);

      // Verify Red 2 station is restored in VERDICT phase
      await expect(recovPage.locator("#room-phase-badge")).toContainText("VERDICT", { timeout: 15000 });
      await expect(recovPage.getByText(harness.sessions[red2].callsign).first()).toBeVisible();

      // Crucial: Verify the pending 1/2 proposal card survived and is immediately visible to reconnected operative
      await expect(recovPage.locator("#pending-proposal-card")).toBeVisible({ timeout: 15000 });
      await expect(recovPage.locator("#pending-proposal-card")).toContainText("1/2 CONFIRMED");
      const confirmBtn = recovPage.locator("#confirm-verdict-btn");
      await expect(confirmBtn).toBeVisible();

      // Red 2 confirms the proposal from the recovered station
      await confirmBtn.click();

      // Verify verdict is now locked (2/2) for Red faction
      await expect(recovPage.locator("#verdict-locked-badge")).toBeVisible({ timeout: 15000 });
      await expect(recovPage.locator("#verdict-locked-badge")).toContainText("OFFICIAL ASSESSMENT LOCKED IN");
    } finally {
      if (recovContext) {
        await recovContext.close().catch(() => {});
      }
      await harness.teardown();
    }
  });
});
