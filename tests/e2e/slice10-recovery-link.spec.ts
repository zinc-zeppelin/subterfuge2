import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Slice 10: Jackbox-Style Personal Recovery Links, Device Auto-Resume & Mid-Game Recovery Portal", () => {
  const screenshotsDir = path.resolve(process.cwd(), "screenshots");

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

    // Capture Screenshot of Lobby with Personal Recovery Link
    await p1Page.screenshot({
      path: path.join(screenshotsDir, "17-lobby-personal-recovery-link.png"),
    });

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
    // In a completely fresh browser context, open personal recovery link: /room/[code]?token=[p1Token]
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

    // Step 6: Add 2 more players (P3, P4) to meet 4-player requirement and start Infiltration
    const p3Context = await browser.newContext();
    const p3Page = await p3Context.newPage();
    await p3Page.goto(`${url}/room/${roomCode}`);
    await p3Page.fill("#join-callsign-input", "Agent-Charlie");
    await p3Page.click("#join-room-submit-btn");

    const p4Context = await browser.newContext();
    const p4Page = await p4Context.newPage();
    await p4Page.goto(`${url}/room/${roomCode}`);
    await p4Page.fill("#join-callsign-input", "Agent-Delta");
    await p4Page.click("#join-room-submit-btn");

    // All declare ready
    await p1Page.click("#toggle-ready-btn");
    await p2Page.click("#toggle-ready-btn");
    await p3Page.click("#toggle-ready-btn");
    await p4Page.click("#toggle-ready-btn");

    // Host commences operations
    await expect(p1Page.locator("#start-operation-btn")).toBeEnabled({ timeout: 10000 });
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

    // Capture Screenshot of resumed station
    await p1Page.screenshot({
      path: path.join(screenshotsDir, "19-resumed-station-after-purge.png"),
    });

    // Step 9: Mid-Game Recovery Portal (Clean Browser Context without storage)
    const unauthContext = await browser.newContext();
    const unauthPage = await unauthContext.newPage();
    await unauthPage.setViewportSize({ width: 1280, height: 900 });

    // Visiting active operation without session credentials displays Recovery Portal
    await unauthPage.goto(`${url}/room/${roomCode}`);
    await expect(unauthPage.locator("#reconnect-operation-card")).toBeVisible({ timeout: 10000 });
    await expect(unauthPage.locator("#recovery-token-input")).toBeVisible();
    await expect(unauthPage.locator("#resume-station-btn")).toBeVisible();

    // Capture Screenshot of Mid-Game Recovery Portal
    await unauthPage.screenshot({
      path: path.join(screenshotsDir, "18-mid-game-recovery-portal.png"),
    });

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
    await unauthContext.close();
  });
});
