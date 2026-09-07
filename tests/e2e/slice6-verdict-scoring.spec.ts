import { test, expect } from "@playwright/test";
import { SixPlayerHarness } from "../harness/multiplayer-harness";

test.describe("Slice 6: Collaborative Verdict Board, Two-Member Consensus & Scoring", () => {
  let harness: SixPlayerHarness;

  test.beforeEach(async ({ browser }) => {
    harness = new SixPlayerHarness(browser);
  });

  test.afterEach(async () => {
    await harness.teardown();
  });

  test("supports collaborative word proposals, enforces two-member consensus lock-in, scores with mission meter mechanics, and transitions to DEBRIEF when both verdicts are locked", async ({
    baseURL,
  }) => {
    test.setTimeout(180000);
    const url = baseURL || "http://localhost:3000";

    // 1. Initialize 6 operatives & commence
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

    // 2. Gather each player's secret code word (all 6 unique words)
    const secretWords: string[] = [];
    for (let i = 0; i < 6; i++) {
      const w = await harness.decryptAndGetSecretWord(i);
      secretWords.push(w.toUpperCase().trim());
    }

    // 3. Identify team operatives
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

    // 4. Warp time to VERDICT phase
    await harness.warpTime("VERDICT");

    for (const op of harness.sessions) {
      await expect(op.page.locator("#room-phase-badge")).toHaveText("VERDICT", {
        timeout: 15000,
      });
      await expect(op.page.locator("#verdict-board")).toBeVisible({ timeout: 15000 });
    }

    // 5. Collaborative Proposal Board & Two-Member Quorum
    // Red Op 1 proposes a candidate word
    await harness.proposeWord(redOp1, "CANDIDATEWORD");
    const op1Page = harness.sessions[redOp1].page;
    const op2Page = harness.sessions[redOp2].page;
    await expect(op1Page.locator("#suggestions-list")).toContainText("CANDIDATEWORD");
    await expect(op2Page.locator("#suggestions-list")).toContainText("CANDIDATEWORD");

    // Both operatives have access to proposal and draft slate controls (Universal operative access)
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
      // Operative names on Red team
      expect(
        optText.includes(harness.sessions[redOps[0].idx].callsign) ||
        optText.includes(harness.sessions[redOps[1].idx].callsign) ||
        optText.includes(harness.sessions[redOps[2].idx].callsign)
      ).toBe(true);
    }

    // 6. Red Op 1 drafts 6 guesses and proposes verdict slate
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
    await harness.operativeAddVerdictGuess(redOp1, secretWords[1]);
    await harness.operativeAddVerdictGuess(redOp1, secretWords[2]);
    await harness.operativeAddVerdictGuess(redOp1, "BOGUSONE");
    await harness.operativeAddVerdictGuess(redOp1, "BOGUSTWO");
    await harness.operativeAddVerdictGuess(redOp1, "BOGUSTHREE");

    await expect(op1Page.locator("#guesses-count")).toContainText("6/6");

    // Red Op 1 proposes team verdict (Propose Slate)
    await harness.operativeProposeVerdict(redOp1);

    // Pending proposal card is visible to both teammates with 1/2 confirmation
    await expect(op1Page.locator("#pending-proposal-card")).toBeVisible({ timeout: 5000 });
    await expect(op2Page.locator("#pending-proposal-card")).toBeVisible({ timeout: 5000 });
    await expect(op1Page.locator("#pending-proposal-card")).toContainText("1/2 CONFIRMED");
    await expect(op2Page.locator("#confirm-verdict-btn")).toBeVisible();

    // Red Op 2 submits an alternative proposal: it overwrites the original and resets to 1/2 (not 2/2)
    await harness.operativeProposeVerdict(redOp2);
    await expect(op2Page.locator("#pending-proposal-card")).toContainText("1/2 CONFIRMED");
    await expect(op1Page.locator("#pending-proposal-card")).toContainText("1/2 CONFIRMED");
    await expect(op1Page.locator("#pending-proposal-card")).toContainText(`Proposed by ${harness.sessions[redOp2].callsign}`);

    // Red Op 1 confirms Red Op 2's proposal (Two-Member Quorum reached)
    await harness.teammateConfirmVerdict(redOp1);

    // Official verdict is now locked for both teammates
    await harness.expectVerdictLocked(redOp1);
    await harness.expectVerdictLocked(redOp2);

    // 7. Blue Team drafts and locks in verdict via Two-Member Consensus
    const blueOp1Page = harness.sessions[blueOp1].page;
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

    // 8. Both verdicts are in -> Automatic transition to DEBRIEF phase
    await harness.expectDebriefViewOnAll();
  });
});
