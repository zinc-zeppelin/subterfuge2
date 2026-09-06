import { test, expect } from "@playwright/test";
import { SixPlayerHarness } from "../harness/multiplayer-harness";

test.describe("Slice 13: Playtesting Enhancements & Dev Mode Controls", () => {
  let harness: SixPlayerHarness;

  test.beforeEach(async ({ browser }) => {
    harness = new SixPlayerHarness(browser);
  });

  test.afterEach(async () => {
    await harness.teardown();
  });

  test("verifies real hold-and-release, mole screen disguise, unread badges, DM alerts, and dev mode HUD", async ({
    baseURL,
  }) => {
    test.setTimeout(120000);
    const url = baseURL || "http://localhost:3000";

    // 1. Initialize sessions
    await harness.initSessions([
      "Operative-1",
      "Operative-2",
      "Operative-3",
      "Operative-4",
      "Operative-5",
      "Operative-6",
    ]);

    const roomCode = await harness.hostCreatesRoom(url);
    await harness.joinRemainingOperatives(url);

    const op1 = harness.sessions[0];

    // Open Host session with ?dev=true to activate dev mode
    await op1.page.goto(`${url}/room/${roomCode}?dev=true`);

    // Verify Dev HUD is visible when ?dev=true
    await expect(op1.page.locator("#dev-controls-hud")).toBeVisible();
    await expect(op1.page.locator("#dev-fill-bots-btn")).toBeVisible();

    // Verify Header Operatives count format: OPERATIVES: 6 (not 6/12)
    const operativesDisplay = op1.page.locator("#operatives-count-display");
    await expect(operativesDisplay).toContainText("OPERATIVES: 6");
    await expect(operativesDisplay).not.toContainText("OPERATIVES: 6/12");

    // Start operation
    await harness.setAllReady();
    await harness.hostStartsOperation();
    await harness.expectAllInInfiltrationPhase();

    // 2. Identify Mole, Field Agent, and opposing operative
    let moleIdx = -1;
    let agentIdx = -1;

    for (let i = 0; i < 6; i++) {
      const dossier = await harness.getPlayerDossier(i);
      if (dossier.role === "MOLE" && moleIdx === -1) {
        moleIdx = i;
      } else if (dossier.role === "AGENT" && agentIdx === -1) {
        agentIdx = i;
      }
    }

    expect(moleIdx).toBeGreaterThanOrEqual(0);
    expect(agentIdx).toBeGreaterThanOrEqual(0);

    const molePage = harness.sessions[moleIdx].page;
    const moleDossier = await harness.getPlayerDossier(moleIdx);

    // 3. Test Mole Cover Identity Masking (Anti-Shoulder-Surfing)
    // Idle/Resting State: Mole screen displays cover identity matching innocent teammates!
    await expect(molePage.locator("#self-role")).toHaveText("AGENT");
    await expect(molePage.locator("#self-actual-team")).toContainText(
      `LOYAL TO ${moleDossier.apparentTeam} TEAM`
    );
    await expect(molePage.locator("#self-word-redacted")).toBeVisible();

    // Press and Hold Decrypt: Reveals true Mole identity and secret code word!
    await molePage.dispatchEvent("#decrypt-word-btn", "mousedown");
    await expect(molePage.locator("#self-role")).toHaveText("MOLE");
    await expect(molePage.locator("#self-actual-team")).toContainText(
      `LOYAL TO ${moleDossier.actualTeam} TEAM`
    );
    await expect(molePage.locator("#self-assigned-word")).toBeVisible();

    // Release: Immediately re-masks to innocent Agent cover!
    await molePage.dispatchEvent("#decrypt-word-btn", "mouseup");
    await expect(molePage.locator("#self-role")).toHaveText("AGENT");
    await expect(molePage.locator("#self-actual-team")).toContainText(
      `LOYAL TO ${moleDossier.apparentTeam} TEAM`
    );
    await expect(molePage.locator("#self-word-redacted")).toBeVisible();

    // 4. Test Channel Unread Badges & Incoming DM Alert Toast
    const op1Dossier = await harness.getPlayerDossier(0);
    let opposingOpIdx = -1;
    for (let i = 1; i < 6; i++) {
      const d = await harness.getPlayerDossier(i);
      if (d.apparentTeam !== op1Dossier.apparentTeam) {
        opposingOpIdx = i;
        break;
      }
    }
    expect(opposingOpIdx).toBeGreaterThanOrEqual(1);
    const opposingPage = harness.sessions[opposingOpIdx].page;

    // Op 1 switches to Public Wire
    await harness.switchTab(0, "PUBLIC");

    // Opposing operative sends a DM to Op 1
    await harness.switchTab(opposingOpIdx, "DM");
    await harness.selectDMPeer(opposingOpIdx, 0);
    await harness.sendMessage(opposingOpIdx, "AGENT_CONTACT_SIGMA");

    // Op 1 (who is currently on PUBLIC wire) should see unread badge on Direct Line tab
    await expect(op1.page.locator("#unread-badge-dm")).toBeVisible({ timeout: 10000 });

    // And clickable incoming transmission toast alert
    await expect(op1.page.locator("#incoming-dm-toast")).toBeVisible({ timeout: 10000 });
    await expect(op1.page.locator("#incoming-dm-toast")).toContainText("AGENT_CONTACT_SIGMA");

    // Click the DM toast: jumps directly to DM channel with sender and clears unread badge!
    await op1.page.click("#incoming-dm-toast");
    await expect(op1.page.locator("#tab-dm")).toHaveClass(/bg-classified-amber/);
    await expect(op1.page.locator("#unread-badge-dm")).toBeHidden();

    // 5. Test Differentiated Clearance Decline
    await harness.selectDMPeer(0, opposingOpIdx);
    await op1.page.click("#verify-credentials-btn");
    await expect(opposingPage.locator("#clearance-challenge-modal")).toBeVisible({ timeout: 10000 });

    // Opposing operative declines the challenge
    await opposingPage.click("#decline-challenge-btn");

    // Opposing operative sees "Clearance Declined: You have declined"
    await expect(opposingPage.getByText("Clearance Declined: You have declined")).toBeVisible({
      timeout: 10000,
    });

    // Op 1 sees "#clearance-declined-badge"
    await expect(op1.page.locator("#clearance-declined-badge")).toBeVisible({ timeout: 10000 });
    await expect(op1.page.locator("#clearance-denied-badge")).toBeHidden();

    // 6. Test Dev Mode Phase Warps
    // Warp to Midpoint
    await op1.page.click("#dev-warp-midpoint-btn");
    await expect(op1.page.locator("#declassified-theme-banner")).toBeVisible({ timeout: 10000 });

    // Warp to Verdict
    await op1.page.click("#dev-warp-verdict-btn");
    await expect(op1.page.locator("#verdict-board")).toBeVisible({ timeout: 10000 });

    // Fast-Forward to Debrief
    await op1.page.click("#dev-warp-debrief-btn");
    await expect(op1.page.locator("#debrief-winner-banner")).toBeVisible({ timeout: 10000 });
  });
});
