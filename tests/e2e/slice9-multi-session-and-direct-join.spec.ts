import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Slice 9: Multi-Session Tab Isolation, Shareable Room Link & In-Page Direct Join", () => {
  const screenshotsDir = path.resolve(process.cwd(), "screenshots");

  test("verifies shared-cookie browsers join as distinct players, lobby displays invite link, and direct room URL prompts for operative callsign", async ({
    browser,
    baseURL,
  }) => {
    const url = baseURL || "http://localhost:3000";

    // Scenario A: Two pages in the SAME BrowserContext (simulating two incognito windows in Chrome sharing cookies)
    const sharedContext = await browser.newContext();
    const p1Page = await sharedContext.newPage();
    await p1Page.setViewportSize({ width: 1280, height: 900 });

    // P1 establishes room as Host
    await p1Page.goto(`${url}/`);
    await p1Page.fill("#callsign-input", "Commander-P1");
    await p1Page.click("#create-room-btn");
    await p1Page.waitForURL(/\/room\/[A-Z0-9]{6}/);

    const roomUrl = p1Page.url();
    const match = roomUrl.match(/\/room\/([A-Z0-9]{6})/);
    expect(match).toBeTruthy();
    const roomCode = match![1];

    // Verify Lobby Invite Link Banner is visible
    await expect(p1Page.locator("#room-invite-banner")).toBeVisible();
    await expect(p1Page.locator("#room-invite-url")).toContainText(`/room/${roomCode}`);
    await expect(p1Page.locator("#copy-invite-link-btn")).toBeVisible();
    await expect(p1Page.locator("#copy-room-code-btn")).toBeVisible();

    // Verify roster has 1 player initially
    await expect(p1Page.locator("#player-roster > div")).toHaveCount(1);
    await expect(p1Page.locator("#player-roster")).toContainText("Commander-P1");

    // Capture Screenshot of Lobby with Invite Banner
    await p1Page.screenshot({
      path: path.join(screenshotsDir, "14-lobby-invite-link.png"),
    });

    // P2 opens the same room URL in the second page of the SAME context (shared cookies!)
    const p2Page = await sharedContext.newPage();
    await p2Page.setViewportSize({ width: 1280, height: 900 });
    await p2Page.goto(`${url}/room/${roomCode}`);

    // Because P2 is a distinct tab without P1's tab session, P2 should be prompted to choose a call-sign!
    await expect(p2Page.locator("#join-operation-form")).toBeVisible({ timeout: 10000 });
    await expect(p2Page.locator("#join-callsign-input")).toBeVisible();
    await expect(p2Page.locator("#join-room-submit-btn")).toBeVisible();

    // Capture Screenshot of in-page operative onboarding
    await p2Page.screenshot({
      path: path.join(screenshotsDir, "15-direct-room-onboarding.png"),
    });

    // P2 identifies as "Infiltrator-P2" and joins
    await p2Page.fill("#join-callsign-input", "Infiltrator-P2");
    await p2Page.click("#join-room-submit-btn");

    // Both pages should now show 2 distinct players in the lobby roster!
    await expect(p2Page.locator("#player-roster > div")).toHaveCount(2, { timeout: 10000 });
    await expect(p2Page.locator("#player-roster")).toContainText("Commander-P1");
    await expect(p2Page.locator("#player-roster")).toContainText("Infiltrator-P2");

    // P1 page should also update to reflect 2 players
    await expect(p1Page.locator("#player-roster > div")).toHaveCount(2, { timeout: 10000 });
    await expect(p1Page.locator("#player-roster")).toContainText("Infiltrator-P2");

    // Verify player identity isolation:
    // P1 sees "YOU" on Commander-P1
    const p1You = p1Page.locator("#player-roster > div", { hasText: "Commander-P1" });
    await expect(p1You.locator("text=YOU")).toBeVisible();

    // P2 sees "YOU" on Infiltrator-P2
    const p2You = p2Page.locator("#player-roster > div", { hasText: "Infiltrator-P2" });
    await expect(p2You.locator("text=YOU")).toBeVisible();

    // Capture Screenshot of both operatives in the lobby
    await p2Page.screenshot({
      path: path.join(screenshotsDir, "16-two-players-same-browser-lobby.png"),
    });

    // Scenario B: A completely fresh, unauthenticated browser context visits the room directly
    const separateContext = await browser.newContext();
    const p3Page = await separateContext.newPage();
    await p3Page.setViewportSize({ width: 1280, height: 900 });

    await p3Page.goto(`${url}/room/${roomCode}`);
    await expect(p3Page.locator("#join-operation-form")).toBeVisible();
    await p3Page.fill("#join-callsign-input", "Specter-P3");
    await p3Page.click("#join-room-submit-btn");

    await expect(p3Page.locator("#player-roster > div")).toHaveCount(3, { timeout: 10000 });
    await expect(p1Page.locator("#player-roster > div")).toHaveCount(3, { timeout: 10000 });
    await expect(p2Page.locator("#player-roster > div")).toHaveCount(3, { timeout: 10000 });

    await sharedContext.close();
    await separateContext.close();
  });
});
