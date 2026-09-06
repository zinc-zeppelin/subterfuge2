import { test, expect } from "@playwright/test";
import { SixPlayerHarness } from "../harness/multiplayer-harness";

test.describe("Slice 1: Six-Player Multi-Context Test Harness", () => {
  let harness: SixPlayerHarness;

  test.beforeEach(async ({ browser }) => {
    harness = new SixPlayerHarness(browser);
  });

  test.afterEach(async () => {
    await harness.teardown();
  });

  test("should orchestrate 6 independent players joining and toggling readiness", async ({ baseURL }) => {
    const url = baseURL || "http://localhost:3000";

    // 1. Initialize 6 isolated sessions
    await harness.initSessions();
    expect(harness.sessions.length).toBe(6);

    // 2. Operative 0 establishes the room
    const roomCode = await harness.hostCreatesRoom(url);
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);

    // 3. Operatives 1 through 5 join
    await harness.joinRemainingOperatives(url);

    // 4. Verify all 6 players see all 6 operatives on their screens
    await harness.verifyRosterCountOnAll(6);

    // 5. Host toggles ready
    await harness.toggleReady(0);
    await expect(harness.sessions[0].page.locator("#player-roster")).toContainText("READY");

    // 6. Remaining 5 operatives toggle ready
    for (let i = 1; i < 6; i++) {
      await harness.toggleReady(i);
    }

    // 7. Verify on host's screen that all 6 are ready
    const hostPage = harness.sessions[0].page;
    await expect(hostPage.getByText("6/6 READY")).toBeVisible({ timeout: 10000 });
    await expect(hostPage.getByText("(ODD OR EVEN)").first()).toBeVisible();

    // Verify deployment authorization button is enabled for the host
    const startBtn = hostPage.locator("#start-operation-btn");
    await expect(startBtn).toBeEnabled();
  });
});
