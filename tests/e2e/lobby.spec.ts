/**
 * Domain: Lobby & Room Management
 *
 * Covers:
 *  - Multi-context test harness & 6-player roster readiness (was Slice 1)
 *  - Tab isolation, shareable room links & in-page direct join (was Slice 9)
 *  - Host kick, voluntary leave, callsign validation & input bounds (was Slice 11)
 */

import { test, expect } from "@playwright/test";
import { SixPlayerHarness } from "../harness/multiplayer-harness";
import path from "path";

const screenshotsDir = path.resolve(process.cwd(), "screenshots");

// ---------------------------------------------------------------------------
// 1. Six-player harness & roster readiness
// ---------------------------------------------------------------------------
test.describe("Lobby — Harness & Roster Readiness", () => {
  let harness: SixPlayerHarness;

  test.beforeEach(async ({ browser }) => {
    harness = new SixPlayerHarness(browser);
  });

  test.afterEach(async () => {
    await harness.teardown();
  });

  test("orchestrates 6 independent players joining and toggling readiness", async ({ baseURL }) => {
    const url = baseURL || "http://localhost:3000";

    await harness.initSessions();
    expect(harness.sessions.length).toBe(6);

    const roomCode = await harness.hostCreatesRoom(url);
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);

    await harness.joinRemainingOperatives(url);
    await harness.verifyRosterCountOnAll(6);

    await harness.toggleReady(0);
    await expect(harness.sessions[0].page.locator("#player-roster")).toContainText("READY");

    for (let i = 1; i < 6; i++) {
      await harness.toggleReady(i);
    }

    const hostPage = harness.sessions[0].page;
    await expect(hostPage.getByText("6/6 READY")).toBeVisible({ timeout: 10000 });
    await expect(hostPage.getByText("(ODD OR EVEN)").first()).toBeVisible();

    const startBtn = hostPage.locator("#start-operation-btn");
    await expect(startBtn).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// 2. Tab isolation, shareable link & in-page direct join
// ---------------------------------------------------------------------------
test.describe("Lobby — Tab Isolation & Direct Join", () => {
  test("verifies shared-cookie browsers join as distinct players, displays invite link, and direct room URL prompts for callsign", async ({
    browser,
    baseURL,
  }) => {
    const url = baseURL || "http://localhost:3000";

    // Scenario A: Two pages in the SAME BrowserContext (shared cookies)
    const sharedContext = await browser.newContext();
    const p1Page = await sharedContext.newPage();
    await p1Page.setViewportSize({ width: 1280, height: 900 });

    await p1Page.goto(`${url}/`);
    await p1Page.fill("#callsign-input", "Commander-P1");
    await p1Page.click("#create-room-btn");
    await p1Page.waitForURL(/\/room\/[A-Z0-9]{6}/);

    const roomUrl = p1Page.url();
    const match = roomUrl.match(/\/room\/([A-Z0-9]{6})/);
    expect(match).toBeTruthy();
    const roomCode = match![1];

    // Verify Lobby Invite Link Banner
    await expect(p1Page.locator("#room-invite-banner")).toBeVisible();
    await expect(p1Page.locator("#room-invite-url")).toContainText(`/room/${roomCode}`);
    await expect(p1Page.locator("#copy-invite-link-btn")).toBeVisible();
    await expect(p1Page.locator("#copy-room-code-btn")).toBeVisible();

    await expect(p1Page.locator("#player-roster > div")).toHaveCount(1);
    await expect(p1Page.locator("#player-roster")).toContainText("Commander-P1");

    await p1Page.screenshot({ path: path.join(screenshotsDir, "14-lobby-invite-link.png") });

    // P2 opens the same room URL in a second page of the SAME context (shared cookies!)
    const p2Page = await sharedContext.newPage();
    await p2Page.setViewportSize({ width: 1280, height: 900 });
    await p2Page.goto(`${url}/room/${roomCode}`);

    // P2 should be prompted for a callsign (tab isolation via sessionStorage)
    await expect(p2Page.locator("#join-operation-form")).toBeVisible({ timeout: 10000 });
    await expect(p2Page.locator("#join-callsign-input")).toBeVisible();
    await expect(p2Page.locator("#join-room-submit-btn")).toBeVisible();

    await p2Page.screenshot({ path: path.join(screenshotsDir, "15-direct-room-onboarding.png") });

    await p2Page.fill("#join-callsign-input", "Infiltrator-P2");
    await p2Page.click("#join-room-submit-btn");

    await expect(p2Page.locator("#player-roster > div")).toHaveCount(2, { timeout: 10000 });
    await expect(p2Page.locator("#player-roster")).toContainText("Commander-P1");
    await expect(p2Page.locator("#player-roster")).toContainText("Infiltrator-P2");
    await expect(p1Page.locator("#player-roster > div")).toHaveCount(2, { timeout: 10000 });
    await expect(p1Page.locator("#player-roster")).toContainText("Infiltrator-P2");

    // Verify identity isolation (YOU badge)
    const p1You = p1Page.locator("#player-roster > div", { hasText: "Commander-P1" });
    await expect(p1You.locator("text=YOU")).toBeVisible();

    const p2You = p2Page.locator("#player-roster > div", { hasText: "Infiltrator-P2" });
    await expect(p2You.locator("text=YOU")).toBeVisible();

    await p2Page.screenshot({ path: path.join(screenshotsDir, "16-two-players-same-browser-lobby.png") });

    // Scenario B: Completely fresh unauthenticated context visits directly
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

// ---------------------------------------------------------------------------
// 3. Host kick, voluntary leave, callsign validation & input bounds
// ---------------------------------------------------------------------------
test.describe("Lobby — Management, Validation & Security Bounds", () => {
  test("enforces callsign bounds, Jackbox room codes, host kick and voluntary leave", async ({
    browser,
    baseURL,
  }) => {
    const url = baseURL || "http://localhost:3000";

    // Verify callsign length limit (server-side)
    const longCallsignRes = await fetch(`${url}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostName: "CallSignWayTooLongExceedingTwentyChars" }),
    });
    expect(longCallsignRes.status).toBe(400);
    const longErr = await longCallsignRes.json();
    expect(longErr.error).toContain("cannot exceed 20 characters");

    // Host creates room
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await hostPage.goto(`${url}/`);
    await hostPage.fill("#callsign-input", "Alpha-Host");
    await hostPage.click("#create-room-btn");
    await hostPage.waitForURL(/\/room\/[A-Z0-9]{6}/);

    const roomCode = hostPage.url().match(/\/room\/([A-Z0-9]{6})/)?.[1]!;
    expect(roomCode).toBeTruthy();

    // Jackbox-style room code: exactly 6 consonants/numbers (no vowels A,E,I,O,U; no 0,1,L)
    expect(roomCode).toMatch(/^[BCDFGHJKMNPQRSTVWXYZ23456789]{6}$/);

    // P2 joins
    const p2Context = await browser.newContext();
    const p2Page = await p2Context.newPage();
    await p2Page.goto(`${url}/room/${roomCode}`);
    await expect(p2Page.locator("#join-operation-form")).toBeVisible();
    await p2Page.fill("#join-callsign-input", "Bravo-Operative");
    await p2Page.click("#join-room-submit-btn");

    await expect(hostPage.locator("#player-roster > div")).toHaveCount(2, { timeout: 10000 });
    await expect(p2Page.locator("#player-roster > div")).toHaveCount(2, { timeout: 10000 });

    // Host kicks P2
    const kickP2Btn = hostPage.locator("button[id^='kick-player-']");
    await expect(kickP2Btn).toBeVisible();
    await kickP2Btn.click();

    await expect(hostPage.locator("#player-roster > div")).toHaveCount(1, { timeout: 10000 });
    await expect(p2Page.locator("#join-operation-form")).toBeVisible({ timeout: 10000 });

    // P2 rejoins to test voluntary leave
    await p2Page.fill("#join-callsign-input", "Bravo-Return");
    await p2Page.click("#join-room-submit-btn");
    await expect(p2Page.locator("#player-roster > div")).toHaveCount(2, { timeout: 10000 });
    await expect(hostPage.locator("#player-roster > div")).toHaveCount(2, { timeout: 10000 });

    const leaveBtn = p2Page.locator("#leave-operation-btn");
    await expect(leaveBtn).toBeVisible();
    await leaveBtn.click();

    await expect(p2Page.locator("#join-operation-form")).toBeVisible({ timeout: 10000 });
    await expect(hostPage.locator("#player-roster > div")).toHaveCount(1, { timeout: 10000 });

    // Message payload length cap (> 500 characters rejected)
    const longMsgRes = await fetch(`${url}/api/rooms/${roomCode}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "M".repeat(501), channelType: "PUBLIC" }),
    });
    expect([400, 401]).toContain(longMsgRes.status);

    await hostContext.close();
    await p2Context.close();
  });

  test("orchestrates 7 operatives joining with odd player count and commencement readiness", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(90000);
    const url = baseURL || "http://localhost:3000";

    const contexts = [];
    const pages = [];
    const callsigns = [
      "Commander-01",
      "Operative-02",
      "Operative-03",
      "Operative-04",
      "Operative-05",
      "Operative-06",
      "Operative-07",
    ];

    for (let i = 0; i < 7; i++) {
      const ctx = await browser.newContext();
      contexts.push(ctx);
      const pg = await ctx.newPage();
      pages.push(pg);
    }

    try {
      const hostPage = pages[0];
      await hostPage.goto(`${url}/`);
      await hostPage.fill("#callsign-input", callsigns[0]);
      await hostPage.click("#create-room-btn");
      await hostPage.waitForURL(/\/room\/[A-Z0-9]{6}/);

      const roomCode = hostPage.url().match(/\/room\/([A-Z0-9]{6})/)?.[1];
      expect(roomCode).toBeTruthy();

      // Join remaining 6 operatives
      for (let i = 1; i < 7; i++) {
        const pg = pages[i];
        await pg.goto(`${url}/room/${roomCode}`);
        await expect(pg.locator("#join-operation-form")).toBeVisible({ timeout: 10000 });
        await pg.fill("#join-callsign-input", callsigns[i]);
        await pg.click("#join-room-submit-btn");
        await expect(pg.locator("#player-roster > div")).toHaveCount(i + 1, { timeout: 10000 });
      }

      // Toggle ready for all 7
      for (let i = 0; i < 7; i++) {
        await pages[i].click("#toggle-ready-btn");
        await expect(pages[i].locator("#toggle-ready-btn")).toContainText("CANCEL READY STATUS", { timeout: 15000 });
      }

      // Host sees 7/7 READY (ODD OR EVEN)
      await expect(hostPage.getByText("7/7 READY")).toBeVisible({ timeout: 15000 });
      await expect(hostPage.locator("#start-operation-btn")).toBeEnabled({ timeout: 15000 });

      // Host commences operation
      await hostPage.click("#start-operation-btn");

      // All 7 players transition to INFILTRATION
      for (let i = 0; i < 7; i++) {
        await expect(pages[i].locator("text=PHASE: INFILTRATION")).toBeVisible({ timeout: 15000 });
      }
    } finally {
      for (const ctx of contexts) {
        await ctx.close().catch(() => {});
      }
    }
  });

  test("allows host to configure game duration in lobby, syncing to operatives in real time", async ({
    browser,
    baseURL,
  }) => {
    const url = baseURL || "http://localhost:3000";
    const hostContext = await browser.newContext();
    const opContext = await browser.newContext();

    try {
      const hostPage = await hostContext.newPage();
      const opPage = await opContext.newPage();

      // Host creates room (default 12 hours)
      await hostPage.goto(`${url}/`);
      await hostPage.fill("#callsign-input", "Commander-Duration");
      await expect(hostPage.locator("#create-duration-display")).toContainText("12 HOURS");
      await hostPage.click("#create-room-btn");
      await hostPage.waitForURL(/\/room\/[A-Z0-9]{6}/);

      const roomCode = hostPage.url().match(/\/room\/([A-Z0-9]{6})/)?.[1];
      expect(roomCode).toBeTruthy();

      // Verify host sees default 12H in lobby header and config card
      await expect(hostPage.locator("#lobby-header-duration")).toContainText("12H");
      await expect(hostPage.locator("#lobby-duration-display")).toContainText("12 HOURS");

      // Peer operative joins
      await opPage.goto(`${url}/room/${roomCode}`);
      await opPage.fill("#join-callsign-input", "Operative-Observer");
      await opPage.click("#join-room-submit-btn");

      // Peer operative sees 12H in header and display card
      await expect(opPage.locator("#lobby-header-duration")).toContainText("12H");
      await expect(opPage.locator("#operative-duration-value")).toContainText("12 HOURS");

      // Host clicks preset 6H
      await hostPage.click("#lobby-duration-preset-6h");
      await expect(hostPage.locator("#lobby-duration-display")).toContainText("6 HOURS");
      await expect(hostPage.locator("#lobby-header-duration")).toContainText("6H");

      // Peer operative observes updated 6H via state sync
      await expect(opPage.locator("#lobby-header-duration")).toContainText("6H", { timeout: 10000 });
      await expect(opPage.locator("#operative-duration-value")).toContainText("6 HOURS", { timeout: 10000 });
    } finally {
      await hostContext.close().catch(() => {});
      await opContext.close().catch(() => {});
    }
  });
});
