import { test, expect } from "@playwright/test";
import { SixPlayerHarness } from "../harness/multiplayer-harness";

test.describe("Slice 4: Covert Mole Protocol & Targeted Clearance Handshake", () => {
  let harness: SixPlayerHarness;

  test.beforeEach(async ({ browser }) => {
    harness = new SixPlayerHarness(browser);
  });

  test.afterEach(async () => {
    await harness.teardown();
  });

  test("executes screen-safe mole verification handshake, 3s self-destruct toast, and cryptographic asset receipt", async ({
    baseURL,
  }) => {
    const url = baseURL || "http://localhost:3000";

    // 1. Initialize 6 operatives & deploy into operation
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

    // 2. Identify roles across operatives
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

    // 3. SUCCESSFUL HANDSHAKE: Blue Operative challenges Red Mole on opposing cover
    // Blue operative switches to DM tab and selects Red Mole
    await harness.switchTab(blueAgentIdx, "DM");
    await harness.selectDMPeer(blueAgentIdx, redMoleIdx);

    // Initial state: Verify button is visible for operative
    const requesterPage = harness.sessions[blueAgentIdx].page;
    await expect(requesterPage.locator("#verify-credentials-btn")).toBeVisible();

    // Blue operative initiates clearance challenge
    await harness.initiateClearanceChallenge(blueAgentIdx);

    // Blue operative sees awaiting response
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

    // After 3.5 seconds, the self-destruct toast MUST completely vanish
    await molePage.waitForTimeout(3500);
    await harness.expectMoleToastDisappeared(redMoleIdx);

    // CRITICAL SECURITY PROPERTY: Red Mole's screen has NO persistent asset badges or receipts
    await expect(molePage.locator("#confirmed-asset-receipt")).not.toBeVisible();
    await expect(molePage.locator("#confirmed-asset-badge")).not.toBeVisible();

    // Requester screen now has permanent cryptographic asset receipt
    await harness.expectConfirmedAssetReceipt(blueAgentIdx);
    await expect(requesterPage.locator("#confirmed-asset-badge")).toBeVisible();
    await expect(requesterPage.locator("#confirmed-asset-receipt")).toContainText(
      harness.sessions[redMoleIdx].callsign
    );

    // 4. DENIED HANDSHAKE: Blue Operative challenges Loyal Red Agent on opposing cover
    await harness.selectDMPeer(blueAgentIdx, redAgentIdx);
    await expect(requesterPage.locator("#verify-credentials-btn")).toBeVisible();

    // Initiate challenge to loyal agent
    await harness.initiateClearanceChallenge(blueAgentIdx);

    // Red Agent receives challenge modal
    const agentPage = harness.sessions[redAgentIdx].page;
    await expect(agentPage.locator("#clearance-challenge-modal")).toBeVisible({ timeout: 10000 });

    // Red Agent submits counter-signature
    await harness.submitCounterSignature(redAgentIdx);

    // Red Agent sees denial toast
    await harness.expectDeniedToast(redAgentIdx);

    // Requester sees clearance denied badge
    await expect(requesterPage.locator("#clearance-denied-badge")).toBeVisible({ timeout: 10000 });
    await expect(requesterPage.locator("#confirmed-asset-badge")).not.toBeVisible();

    // 5. PROHIBITED HANDSHAKE: Same-team operatives cannot request mole verification
    await harness.selectDMPeer(blueAgentIdx, otherBlueIdx);
    await expect(requesterPage.locator("#verify-credentials-btn")).not.toBeVisible();
  });
});
