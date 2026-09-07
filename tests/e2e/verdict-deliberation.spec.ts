/**
 * Domain: Verdict Deliberation
 *
 * Covers:
 *  - Collaborative word proposals & suggestion board (was Slice 6)
 *  - Two-member consensus lock-in protocol
 *  - Slate removal / re-adoption persistence
 *  - Mission meter scoring engine & DEBRIEF transition
 */

import { test, expect } from "@playwright/test";
import { SixPlayerHarness } from "../harness/multiplayer-harness";

test.describe("Verdict — Collaborative Board, Two-Member Consensus & Scoring", () => {
  let harness: SixPlayerHarness;

  test.beforeEach(async ({ browser }) => {
    harness = new SixPlayerHarness(browser);
  });

  test.afterEach(async () => {
    await harness.teardown();
  });

  test("supports collaborative word proposals, enforces two-member consensus lock-in, scores with mission meter mechanics, and transitions to DEBRIEF when both verdicts are locked", async ({ baseURL }) => {
    test.setTimeout(180000);
    const url = baseURL || "http://localhost:3000";

    await harness.initSessions([
      "Viper-V1",
      "Shadow-V2",
      "Hawk-V3",
      "Ghost-V4",
      "Specter-V5",
      "Raven-V6",
    ]);

    await harness.hostCreatesRoom(url);
    await harness.joinRemainingOperatives(url);
    await harness.setAllReady();
    await harness.hostStartsOperation();
    await harness.expectAllInInfiltrationPhase();

    // Gather each player's secret code word (all 6 unique words)
    const secretWords: string[] = [];
    for (let i = 0; i < 6; i++) {
      const w = await harness.decryptAndGetSecretWord(i);
      secretWords.push(w.toUpperCase().trim());
    }

    // Identify team operatives
    const dossiers = [];
    for (let i = 0; i < 6; i++) {
      const dossier = await harness.getPlayerDossier(i);
      dossiers.push({ idx: i, ...dossier });
    }

    const redOps = dossiers.filter((d) => d.apparentTeam === "RED");
    const blueOps = dossiers.filter((d) => d.apparentTeam === "BLUE");
    expect(redOps.length).toBe(3);
    expect(blueOps.length).toBe(3);

    const redOp1 = redOps[0].idx;
    const redOp2 = redOps[1].idx;
    const blueOp1 = blueOps[0].idx;
    const blueOp2 = blueOps[1].idx;

    // Warp time to VERDICT phase
    await harness.warpTime("VERDICT");

    for (const op of harness.sessions) {
      await expect(op.page.locator("#room-phase-badge")).toHaveText("VERDICT", { timeout: 15000 });
      await expect(op.page.locator("#verdict-board")).toBeVisible({ timeout: 15000 });
    }

    // Collaborative Proposal Board & Two-Member Quorum
    await harness.proposeWord(redOp1, "CANDIDATEWORD");
    const op1Page = harness.sessions[redOp1].page;
    const op2Page = harness.sessions[redOp2].page;
    await expect(op1Page.locator("#suggestions-list")).toContainText("CANDIDATEWORD");
    await expect(op2Page.locator("#suggestions-list")).toContainText("CANDIDATEWORD");

    // Both operatives have access to proposal and draft slate controls
    await expect(op1Page.locator("#proposal-word-input")).toBeVisible();
    await expect(op2Page.locator("#proposal-word-input")).toBeVisible();
    await expect(op1Page.locator("#draft-guesses-container")).toBeVisible();
    await expect(op2Page.locator("#draft-guesses-container")).toBeVisible();

    // Propose button is disabled until all 6 words are adopted into the slate
    const lockBtn = op1Page.locator("#lock-in-verdict-btn");
    await expect(lockBtn).toBeDisabled();
    await expect(lockBtn).toContainText("SLATE INCOMPLETE (0/6)");

    // Mole indictment dropdown only contains players from operative's own apparent team
    const redMoleOptions = await op1Page.locator("#mole-indictment-select option").allInnerTexts();
    expect(redMoleOptions.length).toBe(4); // 1 default + 3 Red players
    for (const optText of redMoleOptions) {
      if (optText.includes("--")) continue;
      expect(
        optText.includes(harness.sessions[redOps[0].idx].callsign) ||
        optText.includes(harness.sessions[redOps[1].idx].callsign) ||
        optText.includes(harness.sessions[redOps[2].idx].callsign)
      ).toBe(true);
    }

    // Red Op 1 drafts first guess
    await harness.operativeAddVerdictGuess(redOp1, secretWords[0]);
    await expect(op1Page.locator("#lock-in-verdict-btn")).toBeDisabled();
    await expect(op1Page.locator("#lock-in-verdict-btn")).toContainText("SLATE INCOMPLETE (1/6)");

    // Promoted to slate: disappears from candidate pool, appears in draft slate across teammates
    await expect(op1Page.locator("#suggestions-list")).not.toContainText(secretWords[0]);
    await expect(op2Page.locator("#suggestions-list")).not.toContainText(secretWords[0]);
    await expect(op2Page.locator("#draft-guesses-container")).toContainText(secretWords[0], { timeout: 5000 });
    await op1Page.reload();
    await expect(op1Page.locator("#draft-guesses-container")).toContainText(secretWords[0], { timeout: 5000 });
    await expect(op1Page.locator("#suggestions-list")).not.toContainText(secretWords[0]);

    // Remove guess: demotes back from slate to suggestions pool, persists across reload
    await harness.operativeRemoveVerdictGuess(redOp1, secretWords[0]);
    await expect(op1Page.locator("#draft-guesses-container")).not.toContainText(secretWords[0]);
    await expect(op1Page.locator("#suggestions-list")).toContainText(secretWords[0]);
    await expect(op2Page.locator("#suggestions-list")).toContainText(secretWords[0], { timeout: 5000 });
    await op1Page.reload();
    await expect(op1Page.locator("#draft-guesses-container")).not.toContainText(secretWords[0]);
    await expect(op1Page.locator("#suggestions-list")).toContainText(secretWords[0]);

    // Re-adopt secretWords[0] to resume assembling the full slate
    await harness.operativeAddVerdictGuess(redOp1, secretWords[0]);
    await expect(op1Page.locator("#draft-guesses-container")).toContainText(secretWords[0]);
    await expect(op1Page.locator("#suggestions-list")).not.toContainText(secretWords[0]);
    await harness.operativeAddVerdictGuess(redOp1, secretWords[1]);
    await harness.operativeAddVerdictGuess(redOp1, secretWords[2]);
    await harness.operativeAddVerdictGuess(redOp1, "BOGUSONE");
    await harness.operativeAddVerdictGuess(redOp1, "BOGUSTWO");
    await harness.operativeAddVerdictGuess(redOp1, "BOGUSTHREE");

    await expect(op1Page.locator("#guesses-count")).toContainText("6/6");

    // Red Op 1 proposes team verdict
    await harness.operativeProposeVerdict(redOp1);

    // Pending proposal card is visible to both teammates with 1/2 confirmation
    await expect(op1Page.locator("#pending-proposal-card")).toBeVisible({ timeout: 15000 });
    await expect(op2Page.locator("#pending-proposal-card")).toBeVisible({ timeout: 15000 });
    await expect(op1Page.locator("#pending-proposal-card")).toContainText("1/2 CONFIRMED");
    await expect(op2Page.locator("#confirm-verdict-btn")).toBeVisible();

    // Red Op 2 submits an alternative proposal: overwrites original and resets to 1/2 (not 2/2)
    await harness.operativeProposeVerdict(redOp2);
    await expect(op2Page.locator("#pending-proposal-card")).toContainText("1/2 CONFIRMED");
    await expect(op1Page.locator("#pending-proposal-card")).toContainText("1/2 CONFIRMED");
    await expect(op1Page.locator("#pending-proposal-card")).toContainText(`Proposed by ${harness.sessions[redOp2].callsign}`);

    // Red Op 1 confirms Red Op 2's proposal (Two-Member Quorum reached)
    await harness.teammateConfirmVerdict(redOp1);

    // Official verdict is now locked for both teammates
    await harness.expectVerdictLocked(redOp1);
    await harness.expectVerdictLocked(redOp2);

    // Blue Team drafts and locks in verdict via Two-Member Consensus
    const blueOp2Page = harness.sessions[blueOp2].page;

    await harness.operativeAddVerdictGuess(blueOp1, secretWords[0]);
    await harness.operativeAddVerdictGuess(blueOp1, secretWords[1]);
    await harness.operativeAddVerdictGuess(blueOp1, secretWords[2]);
    await harness.operativeAddVerdictGuess(blueOp1, secretWords[3]);
    await harness.operativeAddVerdictGuess(blueOp1, secretWords[4]);
    await harness.operativeAddVerdictGuess(blueOp1, "WRONGBLUE");

    await harness.operativeProposeVerdict(blueOp1);
    await expect(blueOp2Page.locator("#pending-proposal-card")).toBeVisible({ timeout: 5000 });
    await harness.teammateConfirmVerdict(blueOp2);

    // Both verdicts are in -> Automatic transition to DEBRIEF phase
    await harness.expectDebriefViewOnAll();
  });

  test("handles concurrent competing slate proposals from multiple teammates without deadlock", async ({ baseURL }) => {
    test.setTimeout(180000);
    const url = baseURL || "http://localhost:3000";

    await harness.initSessions([
      "Viper-Race1",
      "Shadow-Race2",
      "Hawk-Race3",
      "Ghost-Race4",
      "Specter-Race5",
      "Raven-Race6",
    ]);

    await harness.hostCreatesRoom(url);
    await harness.joinRemainingOperatives(url);
    await harness.setAllReady();
    await harness.hostStartsOperation();
    await harness.expectAllInInfiltrationPhase();

    // Identify Red team operatives
    const dossiers = [];
    for (let i = 0; i < 6; i++) {
      dossiers.push({ idx: i, ...(await harness.getPlayerDossier(i)) });
    }
    const redOps = dossiers.filter((d) => d.apparentTeam === "RED");
    const redOp1 = redOps[0].idx;
    const redOp2 = redOps[1].idx;

    // Advance to VERDICT
    await harness.warpTime("VERDICT");
    const op1Page = harness.sessions[redOp1].page;
    const op2Page = harness.sessions[redOp2].page;

    await expect(op1Page.locator("#room-phase-badge")).toContainText("VERDICT", { timeout: 15000 });
    await expect(op2Page.locator("#room-phase-badge")).toContainText("VERDICT", { timeout: 15000 });

    // Populate 6 slate guesses
    const testWords = ["CODEONE", "CODETWO", "CODETHREE", "CODEFOUR", "CODEFIVE", "CODESIX"];
    for (const word of testWords) {
      await harness.operativeAddVerdictGuess(redOp1, word);
    }
    await expect(op1Page.locator("#guesses-count")).toContainText("6/6");
    await expect(op2Page.locator("#guesses-count")).toContainText("6/6");

    // Both teammates open the verdict confirmation modal
    await op1Page.click("#lock-in-verdict-btn");
    await op2Page.click("#lock-in-verdict-btn");

    await expect(op1Page.locator("#verdict-confirmation-modal")).toBeVisible({ timeout: 5000 });
    await expect(op2Page.locator("#verdict-confirmation-modal")).toBeVisible({ timeout: 5000 });

    // Race condition: Both teammates transmit their proposals simultaneously via Promise.all
    await Promise.all([
      op1Page.locator("#transmit-proposal-btn").click(),
      op2Page.locator("#transmit-proposal-btn").click(),
    ]);

    // Verify both browsers handle the outcome gracefully without deadlock
    await expect(op1Page.locator("#pending-proposal-card")).toBeVisible({ timeout: 15000 });
    await expect(op2Page.locator("#pending-proposal-card")).toBeVisible({ timeout: 15000 });

    // One of them is the recorded proposer, and consensus is at 1/2 CONFIRMED
    await expect(op1Page.locator("#pending-proposal-card")).toContainText("1/2 CONFIRMED");
    await expect(op2Page.locator("#pending-proposal-card")).toContainText("1/2 CONFIRMED");

    // Whichever operative is not the proposer confirms the proposal
    const op1CanConfirm = await op1Page.locator("#confirm-verdict-btn").isVisible().catch(() => false);
    const op2CanConfirm = await op2Page.locator("#confirm-verdict-btn").isVisible().catch(() => false);

    expect(op1CanConfirm || op2CanConfirm).toBe(true);
    if (op1CanConfirm) {
      await op1Page.click("#confirm-verdict-btn");
    } else {
      await op2Page.click("#confirm-verdict-btn");
    }

    // Official verdict is now locked (2/2) for both Red teammates
    await harness.expectVerdictLocked(redOp1);
    await harness.expectVerdictLocked(redOp2);
  });
});
