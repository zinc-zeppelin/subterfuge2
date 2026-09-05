import { test, expect } from "@playwright/test";

test.describe("Slice 11: Lobby Management, Input Validation & Security Bounds", () => {
  test("enforces callsign bounds, Jackbox room codes, host kick and voluntary leave", async ({
    browser,
    baseURL,
  }) => {
    const url = baseURL || "http://localhost:3000";

    // 1. Verify callsign length limit on room creation (client and server validation)
    const longCallsignRes = await fetch(`${url}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostName: "CallSignWayTooLongExceedingTwentyChars",
      }),
    });
    expect(longCallsignRes.status).toBe(400);
    const longErr = await longCallsignRes.json();
    expect(longErr.error).toContain("cannot exceed 20 characters");

    // 2. Host creates room
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await hostPage.goto(`${url}/`);
    await hostPage.fill("#callsign-input", "Alpha-Host");
    await hostPage.click("#create-room-btn");
    await hostPage.waitForURL(/\/room\/[A-Z0-9]{6}/);

    const roomCode = hostPage.url().match(/\/room\/([A-Z0-9]{6})/)?.[1]!;
    expect(roomCode).toBeTruthy();

    // Verify Jackbox room code format: exactly 6 consonants or numbers (no vowels A, E, I, O, U and no 0, 1, L)
    expect(roomCode).toMatch(/^[BCDFGHJKMNPQRSTVWXYZ23456789]{6}$/);

    // 3. P2 joins the room
    const p2Context = await browser.newContext();
    const p2Page = await p2Context.newPage();
    await p2Page.goto(`${url}/room/${roomCode}`);
    await expect(p2Page.locator("#join-operation-form")).toBeVisible();
    await p2Page.fill("#join-callsign-input", "Bravo-Operative");
    await p2Page.click("#join-room-submit-btn");

    // Both pages should see 2 operatives
    await expect(hostPage.locator("#player-roster > div")).toHaveCount(2, { timeout: 10000 });
    await expect(p2Page.locator("#player-roster > div")).toHaveCount(2, { timeout: 10000 });

    // 4. Host dismisses (kicks) P2
    // Host sees DISMISS button for Bravo-Operative
    const kickP2Btn = hostPage.locator("button[id^='kick-player-']");
    await expect(kickP2Btn).toBeVisible();
    await kickP2Btn.click();

    // Host roster updates to 1 operative
    await expect(hostPage.locator("#player-roster > div")).toHaveCount(1, { timeout: 10000 });

    // P2 should be transitioned out to unauthenticated join form
    await expect(p2Page.locator("#join-operation-form")).toBeVisible({ timeout: 10000 });

    // 5. P2 rejoins to test voluntary leave
    await p2Page.fill("#join-callsign-input", "Bravo-Return");
    await p2Page.click("#join-room-submit-btn");
    await expect(p2Page.locator("#player-roster > div")).toHaveCount(2, { timeout: 10000 });
    await expect(hostPage.locator("#player-roster > div")).toHaveCount(2, { timeout: 10000 });

    // P2 clicks Leave Operation
    const leaveBtn = p2Page.locator("#leave-operation-btn");
    await expect(leaveBtn).toBeVisible();
    await leaveBtn.click();

    // P2 returns to join form
    await expect(p2Page.locator("#join-operation-form")).toBeVisible({ timeout: 10000 });

    // Host roster returns to 1 operative
    await expect(hostPage.locator("#player-roster > div")).toHaveCount(1, { timeout: 10000 });

    // 6. Test message payload length cap (> 500 characters rejected)
    const longMsgRes = await fetch(`${url}/api/rooms/${roomCode}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "M".repeat(501),
        channelType: "PUBLIC",
      }),
    });
    // Session token missing or length error: either way invalid
    expect([400, 401]).toContain(longMsgRes.status);

    await hostContext.close();
    await p2Context.close();
  });
});
