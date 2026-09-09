/**
 * Domain: Playtest Ergonomics & Dev Controls
 *
 * Covers:
 *  - Real hold-and-release, mole screen identity masking & camouflage word spoofing
 *  - Channel unread badges & incoming DM alert toasts
 *  - Differentiated clearance decline behaviour
 *  - Dev mode HUD with phase warp controls (was Slice 13)
 */

import { test, expect } from "@playwright/test";
import { SixPlayerHarness } from "../harness/multiplayer-harness";

test.describe("Ergonomics — Playtest Polish, Anti-Shoulder-Surfing & Dev HUD", () => {
  let harness: SixPlayerHarness;

  test.beforeEach(async ({ browser }) => {
    harness = new SixPlayerHarness(browser);
  });

  test.afterEach(async () => {
    await harness.teardown();
  });

  test("verifies real hold-and-release, mole screen disguise, unread badges, DM alerts, and dev mode HUD", async ({ baseURL }) => {
    test.setTimeout(120000);
    const url = baseURL || "http://localhost:3000";

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

    // Identify Mole and Field Agent
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

    // Test Mole Cover Identity Masking & Camouflage Word Spoofing
    // Mole screen displays symmetrical cover identity matching innocent teammates (AGENT)!
    await expect(molePage.locator("#self-role")).toHaveText("AGENT");
    await expect(molePage.locator("#self-word-redacted")).toBeVisible();
    // Verify no decoy tells exist on screen
    await expect(molePage.getByText("DECOY WORD:")).not.toBeVisible();
    await expect(molePage.getByText("SET CAMOUFLAGE")).not.toBeVisible();

    // Press and Hold Decrypt: Reveals assigned word, but role remains AGENT (zero mole tell!)
    await molePage.dispatchEvent("#decrypt-word-btn", "mousedown");
    await expect(molePage.locator("#self-role")).toHaveText("AGENT");
    await expect(molePage.locator("#self-assigned-word")).toBeVisible();
    const authenticWord = (await molePage.locator("#self-assigned-word").innerText()).trim();

    // Release button
    await molePage.dispatchEvent("#decrypt-word-btn", "mouseup");
    await expect(molePage.locator("#self-word-redacted")).toBeVisible();

    // Test Camouflage Word Spoofing: Operative configures decoy word
    await molePage.click("#configure-spoof-word-btn");
    await expect(molePage.locator("#spoof-word-modal")).toBeVisible();
    await molePage.fill("#spoof-word-input", "DECOYWORD");
    await molePage.click("#save-spoof-word-btn");
    await expect(molePage.locator("#spoof-word-modal")).not.toBeVisible();

    // STRICT ANTI-TELL CHECK: Resting screen must be 100% IDENTICAL before and after decoy applied!
    await expect(molePage.locator("#self-role")).toHaveText("AGENT");
    await expect(molePage.locator("#self-word-redacted")).toBeVisible();
    await expect(molePage.getByText("DECOY WORD:")).not.toBeVisible();
    await expect(molePage.getByText("DECOY:")).not.toBeVisible();
    await expect(molePage.getByText("SET CAMOUFLAGE")).not.toBeVisible();
    await expect(molePage.locator("#configure-spoof-word-btn")).toContainText("CONFIGURE DECOY WORD");

    // Press and Hold Decrypt: Now reveals DECOYWORD with zero visual tell!
    await molePage.dispatchEvent("#decrypt-word-btn", "mousedown");
    await expect(molePage.locator("#self-assigned-word")).toHaveText("DECOYWORD");
    await expect(molePage.locator("#self-role")).toHaveText("AGENT");
    await molePage.dispatchEvent("#decrypt-word-btn", "mouseup");

    // Set word back to authentic word manually
    await molePage.click("#configure-spoof-word-btn");
    await expect(molePage.locator("#spoof-word-modal")).toBeVisible();
    await molePage.fill("#spoof-word-input", authenticWord);
    await molePage.click("#save-spoof-word-btn");
    await expect(molePage.locator("#spoof-word-modal")).not.toBeVisible();

    await molePage.dispatchEvent("#decrypt-word-btn", "mousedown");
    await expect(molePage.locator("#self-assigned-word")).toHaveText(authenticWord);
    await molePage.dispatchEvent("#decrypt-word-btn", "mouseup");

    // Test Channel Unread Badges & Incoming DM Alert Toast
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

    // Op 1 (on PUBLIC wire) should see unread badge on Direct Line tab
    await expect(op1.page.locator("#unread-badge-dm")).toBeVisible({ timeout: 10000 });

    // And clickable incoming transmission toast alert
    await expect(op1.page.locator("#incoming-dm-toast")).toBeVisible({ timeout: 10000 });
    await expect(op1.page.locator("#incoming-dm-toast")).toContainText("AGENT_CONTACT_SIGMA");

    // Click the DM toast: jumps directly to DM channel with sender and clears unread badge!
    await op1.page.click("#incoming-dm-toast");
    await expect(op1.page.locator("#tab-dm")).toHaveClass(/bg-classified-amber/);
    await expect(op1.page.locator("#unread-badge-dm")).toBeHidden();

    // Test Differentiated Clearance Decline
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

    // Test Dev Mode Phase Warps
    await op1.page.click("#dev-warp-midpoint-btn");
    await expect(op1.page.locator("#declassified-theme-banner")).toBeVisible({ timeout: 10000 });

    await op1.page.click("#dev-warp-verdict-btn");
    await expect(op1.page.locator("#verdict-board")).toBeVisible({ timeout: 10000 });

    await op1.page.click("#dev-warp-debrief-btn");
    await expect(op1.page.locator("#debrief-winner-banner")).toBeVisible({ timeout: 10000 });
  });

  test("supports keyboard ergonomics with Escape key dismissal across tactical modals", async ({ baseURL }) => {
    test.setTimeout(120000);
    const url = baseURL || "http://localhost:3000";

    await harness.initSessions();
    await harness.hostCreatesRoom(url);
    await harness.joinRemainingOperatives(url);
    await harness.setAllReady();
    await harness.hostStartsOperation();
    await harness.expectAllInInfiltrationPhase();

    // Identify Mole operative for decoy modal verification
    let moleIdx = -1;
    for (let i = 0; i < 6; i++) {
      const dossier = await harness.getPlayerDossier(i);
      if (dossier.role === "MOLE") {
        moleIdx = i;
        break;
      }
    }
    expect(moleIdx).toBeGreaterThanOrEqual(0);

    const molePage = harness.sessions[moleIdx].page;

    // 1. Field Manual Escape dismissal
    await molePage.click("#field-manual-btn");
    await expect(molePage.locator("#field-manual-modal")).toBeVisible({ timeout: 5000 });
    await molePage.keyboard.press("Escape");
    await expect(molePage.locator("#field-manual-modal")).toBeHidden({ timeout: 5000 });

    // 2. Tactical Decoy Word modal Escape dismissal
    await molePage.click("#configure-spoof-word-btn");
    await expect(molePage.locator("#spoof-word-modal")).toBeVisible({ timeout: 5000 });
    await molePage.keyboard.press("Escape");
    await expect(molePage.locator("#spoof-word-modal")).toBeHidden({ timeout: 5000 });
  });

  test("verifies settings menu with audio soundscape toggle, preview sounds, manila light theme, and escape dismissal", async ({ browser, baseURL }) => {
    test.setTimeout(60000);
    const url = baseURL || "http://localhost:3000";
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(url);

      // 1. Open Settings modal from Home Page header
      const settingsBtn = page.locator("#settings-toggle-btn");
      await expect(settingsBtn).toBeVisible({ timeout: 5000 });
      await settingsBtn.click();

      const modal = page.locator("#settings-modal-card");
      await expect(modal).toBeVisible({ timeout: 5000 });

      // 2. Test Audio Soundscape toggle
      const audioStatusBadge = page.locator("#audio-status-badge");
      await expect(audioStatusBadge).toContainText("AUDIO ACTIVE");

      const toggleAudioBtn = page.locator("#toggle-audio-btn");
      await toggleAudioBtn.click();
      await expect(audioStatusBadge).toContainText("MUTED");

      await toggleAudioBtn.click();
      await expect(audioStatusBadge).toContainText("AUDIO ACTIVE");

      // Verify sound preview buttons are visible
      await expect(page.locator("#preview-teletype-btn")).toBeVisible();
      await expect(page.locator("#preview-radio-btn")).toBeVisible();
      await page.click("#preview-teletype-btn");
      await page.click("#preview-radio-btn");

      // 3. Test Visual Theme Toggle (Manila Light vs CRT Dark)
      const themeManilaBtn = page.locator("#theme-manila-btn");
      await themeManilaBtn.click();

      // Verify html tag receives theme-manila class
      await expect(page.locator("html")).toHaveClass(/theme-manila/);
      await expect(page.locator("#theme-status-badge")).toContainText("MANILA PAPER");

      // Switch back to CRT Dark
      const themeDarkBtn = page.locator("#theme-dark-btn");
      await themeDarkBtn.click();
      await expect(page.locator("html")).toHaveClass(/dark/);
      await expect(page.locator("#theme-status-badge")).toContainText("CRT TERMINAL");

      // 4. Test Escape key dismissal
      await page.keyboard.press("Escape");
      await expect(modal).toBeHidden({ timeout: 5000 });
    } finally {
      await context.close();
    }
  });
});

