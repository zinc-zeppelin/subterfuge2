/**
 * Domain: Communications & Mole Protocol
 *
 * Covers:
 *  - Public wire, team radio, 1-on-1 DMs & anti-forensic burn (was Slice 3)
 *  - Covert mole verification handshake, 3s self-destruct toast & cryptographic receipt (was Slice 4)
 */

import { test, expect } from "@playwright/test";
import { SixPlayerHarness } from "../harness/multiplayer-harness";

// ---------------------------------------------------------------------------
// 1. Communication channels & anti-forensic DM burn
// ---------------------------------------------------------------------------
test.describe("Comms — Channel Isolation & Anti-Forensic Burn", () => {
  let harness: SixPlayerHarness;

  test.beforeEach(async ({ browser }) => {
    harness = new SixPlayerHarness(browser);
  });

  test.afterEach(async () => {
    await harness.teardown();
  });

  test("enforces channel isolation between Public, Team Radio, and 1-on-1 DMs, and supports conversation burning", async ({ baseURL }) => {
    const url = baseURL || "http://localhost:3000";

    await harness.initSessions();
    await harness.hostCreatesRoom(url);
    await harness.joinRemainingOperatives(url);
    await harness.setAllReady();
    await harness.hostStartsOperation();
    await harness.expectAllInInfiltrationPhase();

    // Identify Red and Blue operatives
    const dossiers = [];
    for (let i = 0; i < 6; i++) {
      const d = await harness.getPlayerDossier(i);
      dossiers.push({ ...d, index: i });
    }
    const redOps = dossiers.filter((d) => d.apparentTeam === "RED");
    const blueOps = dossiers.filter((d) => d.apparentTeam === "BLUE");

    const redOp1 = redOps[0].index;
    const redOp2 = redOps[1].index;
    const blueOp1 = blueOps[0].index;

    // Public Wire: broadcast visible to all
    const publicMsg = "PUBLIC BROADCAST: Attention all field assets.";
    await harness.switchTab(redOp1, "PUBLIC");
    await harness.sendMessage(redOp1, publicMsg);
    await harness.expectMessageInFeed(redOp1, publicMsg);
    await harness.switchTab(redOp2, "PUBLIC");
    await harness.expectMessageInFeed(redOp2, publicMsg);
    await harness.switchTab(blueOp1, "PUBLIC");
    await harness.expectMessageInFeed(blueOp1, publicMsg);

    // Team Radio Isolation: Red Radio message only visible to apparent Red operatives
    const redRadioMsg = "RED TEAM TRANSMISSION: Meet at sector 7.";
    await harness.switchTab(redOp1, "TEAM");
    await harness.sendMessage(redOp1, redRadioMsg);
    await harness.expectMessageInFeed(redOp1, redRadioMsg);
    await harness.switchTab(redOp2, "TEAM");
    await harness.expectMessageInFeed(redOp2, redRadioMsg);

    // Blue Op 1 on Blue Radio does NOT see the Red message
    await harness.switchTab(blueOp1, "TEAM");
    await harness.expectMessageNotInFeed(blueOp1, redRadioMsg);

    // 1-on-1 Direct Messages
    const dmMsg = "COVERT PROPOSAL: I have intelligence on the codebook.";
    await harness.switchTab(redOp1, "DM");
    await harness.selectDMPeer(redOp1, blueOp1);
    await harness.sendMessage(redOp1, dmMsg);
    await harness.expectMessageInFeed(redOp1, dmMsg);

    // Blue Op 1 sees DM
    await harness.switchTab(blueOp1, "DM");
    await harness.selectDMPeer(blueOp1, redOp1);
    await harness.expectMessageInFeed(blueOp1, dmMsg);

    // Third-party Red Op 2 selects Blue Op 1 and asserts NO access to that DM
    await harness.switchTab(redOp2, "DM");
    await harness.selectDMPeer(redOp2, blueOp1);
    await harness.expectMessageNotInFeed(redOp2, dmMsg);

    // Unilateral Burn: Red Op 1 burns conversation with Blue Op 1
    await harness.switchTab(redOp1, "DM");
    await harness.selectDMPeer(redOp1, blueOp1);
    await harness.burnDM(redOp1);

    // Verify messages wiped for Red Op 1 (the burner), but retained for Blue Op 1 (the peer)
    await harness.expectMessageNotInFeed(redOp1, dmMsg);
    await harness.expectMessageInFeed(blueOp1, dmMsg);

    // Blue Op 1 burns from their station
    await harness.burnDM(blueOp1);
    await harness.expectMessageNotInFeed(blueOp1, dmMsg);
  });
});

// ---------------------------------------------------------------------------
// 2. Covert mole verification handshake
// ---------------------------------------------------------------------------
test.describe("Mole Protocol — Clearance Handshake & Screen-Share Safety", () => {
  let harness: SixPlayerHarness;

  test.beforeEach(async ({ browser }) => {
    harness = new SixPlayerHarness(browser);
  });

  test.afterEach(async () => {
    await harness.teardown();
  });

  test("executes screen-safe mole verification handshake, 3s self-destruct toast, and cryptographic asset receipt", async ({ baseURL }) => {
    const url = baseURL || "http://localhost:3000";

    await harness.initSessions([
      "Viper-01",
      "Shadow-02",
      "Hawk-03",
      "Ghost-04",
      "Specter-05",
      "Raven-06",
    ]);

    await harness.hostCreatesRoom(url);
    await harness.joinRemainingOperatives(url);
    await harness.setAllReady();
    await harness.hostStartsOperation();
    await harness.expectAllInInfiltrationPhase();

    // Identify roles
    let redMoleIdx = -1;
    let redAgentIdx = -1;
    let blueAgentIdx = -1;
    let otherBlueIdx = -1;

    for (let i = 0; i < 6; i++) {
      const dossier = await harness.getPlayerDossier(i);
      if (dossier.apparentTeam === "RED" && dossier.actualTeam === "BLUE") {
        redMoleIdx = i;
      } else if (dossier.apparentTeam === "RED" && dossier.actualTeam === "RED" && dossier.role === "AGENT") {
        redAgentIdx = i;
      } else if (dossier.apparentTeam === "BLUE" && dossier.actualTeam === "BLUE" && dossier.role === "AGENT") {
        blueAgentIdx = i;
      }
    }

    expect(redMoleIdx).toBeGreaterThanOrEqual(0);
    expect(redAgentIdx).toBeGreaterThanOrEqual(0);
    expect(blueAgentIdx).toBeGreaterThanOrEqual(0);

    // Find another operative on Blue apparent team
    for (let i = 0; i < 6; i++) {
      if (i !== blueAgentIdx) {
        const dossier = await harness.getPlayerDossier(i);
        if (dossier.apparentTeam === "BLUE") {
          otherBlueIdx = i;
          break;
        }
      }
    }
    expect(otherBlueIdx).toBeGreaterThanOrEqual(0);

    // SUCCESSFUL HANDSHAKE: Blue Operative challenges Red Mole on opposing cover
    await harness.switchTab(blueAgentIdx, "DM");
    await harness.selectDMPeer(blueAgentIdx, redMoleIdx);

    const requesterPage = harness.sessions[blueAgentIdx].page;
    await expect(requesterPage.locator("#verify-credentials-btn")).toBeVisible();

    await harness.initiateClearanceChallenge(blueAgentIdx);
    await expect(requesterPage.locator("#challenge-pending-badge")).toBeVisible({ timeout: 5000 });

    // Red Mole receives challenge modal
    const molePage = harness.sessions[redMoleIdx].page;
    await expect(molePage.locator("#clearance-challenge-modal")).toBeVisible({ timeout: 10000 });
    await expect(molePage.locator("#clearance-challenge-modal")).toContainText(
      harness.sessions[blueAgentIdx].callsign
    );

    // Red Mole submits counter-signature
    await harness.submitCounterSignature(redMoleIdx);

    // Red Mole sees 3-second self-destruct toast
    await harness.expectMoleSelfDestructToast(redMoleIdx);

    // After 3.5 seconds, toast MUST completely vanish (zero persistence)
    await molePage.waitForTimeout(3500);
    await harness.expectMoleToastDisappeared(redMoleIdx);

    // CRITICAL SECURITY: Mole's screen has NO persistent asset badges or receipts
    await expect(molePage.locator("#confirmed-asset-receipt")).not.toBeVisible();
    await expect(molePage.locator("#confirmed-asset-badge")).not.toBeVisible();

    // Requester has permanent cryptographic asset receipt
    await harness.expectConfirmedAssetReceipt(blueAgentIdx);
    await expect(requesterPage.locator("#confirmed-asset-badge")).toBeVisible();
    await expect(requesterPage.locator("#confirmed-asset-receipt")).toContainText(
      harness.sessions[redMoleIdx].callsign
    );

    // DENIED HANDSHAKE: Blue Operative challenges Loyal Red Agent
    await harness.selectDMPeer(blueAgentIdx, redAgentIdx);
    await expect(requesterPage.locator("#verify-credentials-btn")).toBeVisible();

    await harness.initiateClearanceChallenge(blueAgentIdx);

    const agentPage = harness.sessions[redAgentIdx].page;
    await expect(agentPage.locator("#clearance-challenge-modal")).toBeVisible({ timeout: 10000 });

    await harness.submitCounterSignature(redAgentIdx);
    await harness.expectDeniedToast(redAgentIdx);

    await expect(requesterPage.locator("#clearance-denied-badge")).toBeVisible({ timeout: 10000 });
    await expect(requesterPage.locator("#confirmed-asset-badge")).not.toBeVisible();

    // PROHIBITED HANDSHAKE: Same-team operatives cannot request mole verification
    await harness.selectDMPeer(blueAgentIdx, otherBlueIdx);
    await expect(requesterPage.locator("#verify-credentials-btn")).not.toBeVisible();
  });
});
