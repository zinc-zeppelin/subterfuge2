import { test, expect } from "@playwright/test";

test.describe("Slice 12: Mobile Browser Audit (iOS Safari & Android Chrome)", () => {
  test("verifies zero-zoom inputs, tap targets, touch gestures, and viewport constraints", async ({
    page,
    request,
    baseURL,
  }) => {
    const url = baseURL || "http://localhost:3000";

    // 1. Landing Page: Zero-Zoom Guarantee on Mobile Inputs
    await page.goto(`${url}/`);
    await expect(page.locator("#callsign-input")).toBeVisible();

    // Verify font-size >= 16px to prevent iOS Safari auto-zooming
    const callsignFontSize = await page.locator("#callsign-input").evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    });
    expect(callsignFontSize).toBeGreaterThanOrEqual(16);

    const roomCodeFontSize = await page.locator("#room-code-input").evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    });
    expect(roomCodeFontSize).toBeGreaterThanOrEqual(16);

    // Verify tap target heights (>= 44px for touch accessibility)
    const createRoomBtnBox = await page.locator("#create-room-btn").boundingBox();
    expect(createRoomBtnBox).not.toBeNull();
    expect(createRoomBtnBox!.height).toBeGreaterThanOrEqual(44);

    const joinRoomBtnBox = await page.locator("#join-room-btn").boundingBox();
    expect(joinRoomBtnBox).not.toBeNull();
    expect(joinRoomBtnBox!.height).toBeGreaterThanOrEqual(44);

    // Verify no horizontal overflow on mobile viewport
    const hasHorizontalOverflowLanding = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(hasHorizontalOverflowLanding).toBe(true);

    // 2. Create Operation via Mobile Browser
    await page.fill("#callsign-input", "Mobile-Host");
    await page.click("#create-room-btn");
    await page.waitForURL(/\/room\/[A-Z0-9]{6}/);

    const roomMatch = page.url().match(/\/room\/([A-Z0-9]{6})/);
    expect(roomMatch).not.toBeNull();
    const roomCode = roomMatch![1];

    // Verify Lobby Render & Tap Targets
    await expect(page.locator("#player-roster")).toBeVisible();
    await expect(page.locator("#toggle-ready-btn")).toBeVisible();

    const readyBtnBox = await page.locator("#toggle-ready-btn").boundingBox();
    expect(readyBtnBox).not.toBeNull();
    expect(readyBtnBox!.height).toBeGreaterThanOrEqual(44);

    // Check Lobby No-Horizontal-Overflow
    const hasHorizontalOverflowLobby = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(hasHorizontalOverflowLobby).toBe(true);

    // 3. Fast-join 5 other operatives via direct API so room meets minimum 6 operatives
    const extraCallsigns = ["Mobile-Bravo", "Mobile-Charlie", "Mobile-Delta", "Mobile-Echo", "Mobile-Foxtrot"];
    for (const callsign of extraCallsigns) {
      const joinRes = await request.post(`/api/rooms/${roomCode}/join`, {
        data: { playerName: callsign },
      });
      expect(joinRes.ok()).toBe(true);
      const joinData = await joinRes.json();
      const token = joinData.sessionToken;
      const playerId = joinData.playerId;

      // Declare ready
      const readyRes = await request.post(`/api/rooms/${roomCode}/ready`, {
        headers: { "x-session-token": token },
        data: { playerId },
      });
      expect(readyRes.ok()).toBe(true);
    }

    // 4. Mobile Host toggles ready
    await page.click("#toggle-ready-btn");
    await expect(page.locator("#toggle-ready-btn")).toContainText("CANCEL READY STATUS");

    // Wait for all 6 to be ready on host screen
    await expect(page.getByText("6/6 READY")).toBeVisible({ timeout: 15000 });
    const startBtn = page.locator("#start-operation-btn");
    await expect(startBtn).toBeEnabled({ timeout: 15000 });

    const startBtnBox = await startBtn.boundingBox();
    expect(startBtnBox).not.toBeNull();
    expect(startBtnBox!.height).toBeGreaterThanOrEqual(44);

    // Commence Operation
    await startBtn.click();
    await expect(page.locator("#room-phase-badge")).toContainText("INFILTRATION", { timeout: 15000 });

    // 5. Infiltration Phase: Touch Gesture Verification (Hold-to-Decrypt)
    await expect(page.locator("#decrypt-word-btn")).toBeVisible();
    await expect(page.locator("#self-word-redacted")).toBeVisible();

    // Verify touch action and callout prevention
    const decryptBtnStyles = await page.locator("#decrypt-word-btn").evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        touchAction: s.touchAction,
        userSelect: s.userSelect,
        webkitUserSelect: (s as any).webkitUserSelect,
      };
    });
    expect(decryptBtnStyles.touchAction).toBe("manipulation");

    // Simulate touchstart: reveals the word
    await page.locator("#decrypt-word-btn").dispatchEvent("touchstart");
    await expect(page.locator("#self-assigned-word")).toBeVisible();

    // Simulate touchend: re-conceals the word
    await page.locator("#decrypt-word-btn").dispatchEvent("touchend");
    await expect(page.locator("#self-word-redacted")).toBeVisible();

    // 6. Mobile Comms Bar: Input Height and >= 16px Font Size
    await expect(page.locator("#message-input")).toBeVisible();
    const msgInputFontSize = await page.locator("#message-input").evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    });
    expect(msgInputFontSize).toBeGreaterThanOrEqual(16);

    const msgInputBox = await page.locator("#message-input").boundingBox();
    expect(msgInputBox).not.toBeNull();
    expect(msgInputBox!.height).toBeGreaterThanOrEqual(44);

    const sendBtnBox = await page.locator("#send-message-btn").boundingBox();
    expect(sendBtnBox).not.toBeNull();
    expect(sendBtnBox!.height).toBeGreaterThanOrEqual(44);

    // Verify message list has inertia scrolling (.touch-scroll)
    const hasTouchScroll = await page.locator("#message-list").evaluate((el) => {
      return el.classList.contains("touch-scroll");
    });
    expect(hasTouchScroll).toBe(true);

    // 7. Field Manual Modal on Mobile
    await page.click("#field-manual-btn");
    await expect(page.locator("#field-manual-modal")).toBeVisible();

    // Verify close button tap target
    const closeBtnBox = await page.locator("#close-field-manual-btn").boundingBox();
    expect(closeBtnBox).not.toBeNull();

    await page.click("#close-field-manual-btn");
    await expect(page.locator("#field-manual-modal")).not.toBeVisible();

    // Verify no horizontal overflow in INFILTRATION
    const hasHorizontalOverflowInfiltration = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(hasHorizontalOverflowInfiltration).toBe(true);

    // Capture visual screenshot
    await page.screenshot({
      path: `screenshots/mobile-${test.info().project.name}-infiltration.png`,
      fullPage: false,
    });
  });
});
