/**
 * Domain: Full Mission Loop
 *
 * Covers:
 *  - End-to-end 6-player operational loop from Lobby → Infiltration → Comms → Mole
 *    Protocol → Midpoint Intercept → Verdict Deliberation → Debrief → Host Rematch
 *  - Codebook reveal, winner banner, mole outcome, debrief screenshots (was Slice 7)
 */

import { test, expect } from "@playwright/test";
import { SixPlayerHarness } from "../harness/multiplayer-harness";
import path from "path";

const screenshotsDir = path.resolve(process.cwd(), "screenshots");

test.describe("Full Mission Loop — End-to-End 6-Player Operational Loop", () => {
  let harness: SixPlayerHarness;

  test.beforeEach(async ({ browser }) => {
    harness = new SixPlayerHarness(browser);
  });

  test.afterEach(async () => {
    await harness.teardown();
  });

  test("runs full 6-player operational loop through Lobby, Infiltration, Comms, Mole Protocol, Midpoint Intercept, Verdict Deliberation, Debrief & Codebook Reveal, and Host Rematch", async ({ baseURL }) => {
    test.setTimeout(180000);
    const url = baseURL || "http://localhost:3000";

    // 1. Lobby Phase
    await harness.initSessions([
      "Viper-Commander",
      "Shadow-Asset",
      "Hawk-Operative",
      "Ghost-Infiltrator",
      "Specter-Agent",
      "Raven-Specialist",
    ]);

    for (const op of harness.sessions) {
      await op.page.setViewportSize({ width: 1280, height: 900 });
    }

    const roomCode = await harness.hostCreatesRoom(url);
    await harness.joinRemainingOperatives(url);
    await harness.setAllReady();

    await harness.sessions[0].page.screenshot({ path: path.join(screenshotsDir, "01-lobby.png") });

    await harness.hostStartsOperation();
    await harness.expectAllInInfiltrationPhase();

    // 2. Infiltration Phase: Decrypt secret words & inspect dossiers
    const secretWords: string[] = [];
    for (let i = 0; i < 6; i++) {
      const w = await harness.decryptAndGetSecretWord(i);
      secretWords.push(w.toUpperCase().trim());
    }
    expect(secretWords.length).toBe(6);
    expect(new Set(secretWords).size).toBe(6); // All 6 words are distinct

    let redAgent1Idx = -1;
    let redAgent2Idx = -1;
    let blueAgent1Idx = -1;
    let blueAgent2Idx = -1;
    let redCoverBlueMoleIdx = -1; // Apparent RED, Actual BLUE (the traitor inside Red)
    let blueCoverRedMoleIdx = -1; // Apparent BLUE, Actual RED (the traitor inside Blue)

    for (let i = 0; i < 6; i++) {
      const dossier = await harness.getPlayerDossier(i);
      if (dossier.role === "MOLE") {
        if (dossier.apparentTeam === "RED") redCoverBlueMoleIdx = i;
        else blueCoverRedMoleIdx = i;
      } else if (dossier.role === "AGENT") {
        if (dossier.apparentTeam === "RED") {
          if (redAgent1Idx === -1) redAgent1Idx = i;
          else redAgent2Idx = i;
        } else {
          if (blueAgent1Idx === -1) blueAgent1Idx = i;
          else blueAgent2Idx = i;
        }
      }
    }

    expect(redAgent1Idx).toBeGreaterThanOrEqual(0);
    expect(redAgent2Idx).toBeGreaterThanOrEqual(0);
    expect(blueAgent1Idx).toBeGreaterThanOrEqual(0);
    expect(blueAgent2Idx).toBeGreaterThanOrEqual(0);
    expect(redCoverBlueMoleIdx).toBeGreaterThanOrEqual(0);
    expect(blueCoverRedMoleIdx).toBeGreaterThanOrEqual(0);

    await harness.sessions[redCoverBlueMoleIdx].page.screenshot({ path: path.join(screenshotsDir, "02-dossier-decrypted.png") });

    // 3. Comms Suite: Public wire transmission
    await harness.switchTab(0, "PUBLIC");
    await harness.sendMessage(0, "HQ BROADCAST // MAINTAIN STRICT RADIO SILENCE");
    await harness.expectMessageInFeed(0, "HQ BROADCAST // MAINTAIN STRICT RADIO SILENCE");
    await harness.switchTab(1, "PUBLIC");
    await harness.expectMessageInFeed(1, "HQ BROADCAST // MAINTAIN STRICT RADIO SILENCE");

    await harness.sessions[0].page.screenshot({ path: path.join(screenshotsDir, "03-comms-suite.png") });

    // 4. Covert Mole Verification Handshake:
    // Blue Operative challenges Red-cover Blue Mole (Blue's covert asset inside Red)
    await harness.switchTab(blueAgent1Idx, "DM");
    await harness.selectDMPeer(blueAgent1Idx, redCoverBlueMoleIdx);
    await harness.initiateClearanceChallenge(blueAgent1Idx);

    // Mole responds with counter-signature
    await harness.switchTab(redCoverBlueMoleIdx, "DM");
    await harness.selectDMPeer(redCoverBlueMoleIdx, blueAgent1Idx);
    await expect(harness.sessions[redCoverBlueMoleIdx].page.locator("#clearance-challenge-modal")).toBeVisible();

    await harness.sessions[redCoverBlueMoleIdx].page.screenshot({ path: path.join(screenshotsDir, "04-mole-challenge-modal.png") });

    await harness.submitCounterSignature(redCoverBlueMoleIdx);
    await harness.expectMoleSelfDestructToast(redCoverBlueMoleIdx);

    await harness.sessions[redCoverBlueMoleIdx].page.screenshot({ path: path.join(screenshotsDir, "05-mole-self-destruct-toast.png") });

    // Blue Operative receives permanent asset receipt
    await harness.expectConfirmedAssetReceipt(blueAgent1Idx);
    await harness.sessions[blueAgent1Idx].page.screenshot({ path: path.join(screenshotsDir, "06-handler-confirmed-receipt.png") });

    // 5. Midpoint Intelligence Declassification
    await harness.warpTime("MIDPOINT");
    const themeName = await harness.expectDeclassifiedThemeBannerOnAll();
    expect(themeName.length).toBeGreaterThan(0);

    await harness.sessions[0].page.screenshot({ path: path.join(screenshotsDir, "07-midpoint-theme-intercept.png") });

    // 6. Verdict Phase Deliberation & Scoring
    await harness.warpTime("VERDICT");
    for (const op of harness.sessions) {
      await expect(op.page.locator("#room-phase-badge")).toHaveText("VERDICT", { timeout: 15000 });
      await expect(op.page.locator("#verdict-board")).toBeVisible({ timeout: 15000 });
    }

    // Collaborative suggestion: Red Agent proposes a word
    await harness.proposeWord(redAgent1Idx, secretWords[blueAgent1Idx]);
    await expect(harness.sessions[redAgent2Idx].page.locator("#suggestions-list")).toContainText(secretWords[blueAgent1Idx]);

    // Blue Operative adds guesses: 3 own words + 2 enemy words + 1 wrong word
    await harness.operativeAddVerdictGuess(blueAgent1Idx, secretWords[blueAgent1Idx]);
    await harness.operativeAddVerdictGuess(blueAgent1Idx, secretWords[blueAgent2Idx]);
    await harness.operativeAddVerdictGuess(blueAgent1Idx, secretWords[blueCoverRedMoleIdx]);
    await harness.operativeAddVerdictGuess(blueAgent1Idx, secretWords[redAgent1Idx]);
    await harness.operativeAddVerdictGuess(blueAgent1Idx, secretWords[redAgent2Idx]);
    await harness.operativeAddVerdictGuess(blueAgent1Idx, "WRONGBLUE1");

    await harness.operativeProposeVerdict(blueAgent1Idx);
    await harness.teammateConfirmVerdict(blueAgent2Idx);
    await harness.expectVerdictLocked(blueAgent1Idx);

    // Red Operative adds guesses: 3 own words + 2 enemy words + 1 wrong word
    await harness.operativeAddVerdictGuess(redAgent1Idx, secretWords[redAgent1Idx]);
    await harness.operativeAddVerdictGuess(redAgent1Idx, secretWords[redAgent2Idx]);
    await harness.operativeAddVerdictGuess(redAgent1Idx, secretWords[redCoverBlueMoleIdx]);
    await harness.operativeAddVerdictGuess(redAgent1Idx, secretWords[blueAgent1Idx]);
    await harness.operativeAddVerdictGuess(redAgent1Idx, secretWords[blueAgent2Idx]);
    await harness.operativeAddVerdictGuess(redAgent1Idx, "WRONGRED1");

    await harness.sessions[redAgent1Idx].page.screenshot({ path: path.join(screenshotsDir, "08-verdict-deliberation-board.png") });

    // Red Operative indicts the traitor inside Red (redCoverBlueMoleIdx)
    const redOpPage = harness.sessions[redAgent1Idx].page;
    const moleCallsign = harness.sessions[redCoverBlueMoleIdx].callsign;
    const moleOptionVal = await redOpPage
      .locator("#mole-indictment-select option", { hasText: moleCallsign })
      .getAttribute("value");
    expect(moleOptionVal).toBeTruthy();

    await harness.operativeSelectMoleIndictment(redAgent1Idx, moleOptionVal!);
    await harness.operativeProposeVerdict(redAgent1Idx);

    // Red Teammate confirms -> locks official Red verdict, transitions to DEBRIEF
    await harness.teammateConfirmVerdict(redAgent2Idx);

    // 7. DEBRIEF Phase Verification
    await harness.expectDebriefViewOnAll();

    // Verify Victory Banner: Crimson Pact (Red) Victory due to 67% + 20% = 87% vs 67%
    for (const op of harness.sessions) {
      const banner = op.page.locator("#debrief-winner-banner");
      await expect(banner).toBeVisible();
      await expect(banner).toContainText("CRIMSON PACT VICTORY");

      await expect(op.page.locator("#tiebreaker-notice")).toBeVisible();
      await expect(op.page.locator("#tiebreaker-notice")).toContainText("TIEBREAKER RESOLVED");

      await expect(op.page.locator("#red-final-score")).toContainText("87%");
      await expect(op.page.locator("#blue-final-score")).toContainText("67%");

      // Master Codebook Declassification Matrix contains all 6 secret words
      const codebook = op.page.locator("#debrief-codebook");
      await expect(codebook).toBeVisible();
      for (const word of secretWords) {
        await expect(codebook).toContainText(new RegExp(word, "i"));
      }

      // Counter-Intelligence Roster unmasks the moles
      const roster = op.page.locator("#debrief-roster");
      await expect(roster).toBeVisible();

      // Exactly 2 moles unmasked with traitor stamps
      await expect(op.page.locator(`[id^="mole-reveal-"]`)).toHaveCount(2);
    }

    await harness.sessions[0].page.screenshot({ path: path.join(screenshotsDir, "09-debrief-victory-and-scores.png") });
    await harness.sessions[0].page.screenshot({ path: path.join(screenshotsDir, "10-debrief-full-page.png"), fullPage: true });

    // Verify Core Rule: Moles win strictly if their ACTUAL team wins!
    // Red won: blueCoverRedMoleIdx (apparent BLUE, actual RED) -> VICTORY
    const redMoleCallsign = harness.sessions[blueCoverRedMoleIdx].callsign;
    const redMoleCard = harness.sessions[0].page.locator(`[id^="operative-dossier-"]`, { hasText: redMoleCallsign });
    await expect(redMoleCard).toContainText("VICTORY");

    // redCoverBlueMoleIdx (actual BLUE) -> DEFEAT
    const blueMoleCallsign = harness.sessions[redCoverBlueMoleIdx].callsign;
    const blueMoleCard = harness.sessions[0].page.locator(`[id^="operative-dossier-"]`, { hasText: blueMoleCallsign });
    await expect(blueMoleCard).toContainText("DEFEAT");

    // 8. Rematch Controls & Return to Lobby
    const nonHostPage = harness.sessions[1].page;
    await expect(nonHostPage.locator("#rematch-standby-notice")).toBeVisible();
    await expect(nonHostPage.locator("#rematch-btn")).not.toBeVisible();

    await harness.hostRematchAndExpectLobby();

    await harness.sessions[0].page.screenshot({ path: path.join(screenshotsDir, "11-rematch-lobby-restored.png") });

    for (const op of harness.sessions) {
      await expect(op.page.locator("#room-phase-badge")).toHaveText("LOBBY");
      await expect(op.page.locator("#player-roster")).toBeVisible();
      await expect(op.page.locator("#toggle-ready-btn")).toBeVisible();
    }
  });
});
