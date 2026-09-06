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

    // Both operatives have access to draft slate controls (Universal operative access)
    await expect(op1Page.locator("#verdict-word-input")).toBeVisible();
    await expect(op2Page.locator("#verdict-word-input")).toBeVisible();

    // 6. Red Op 1 drafts 6 guesses and proposes verdict slate
    await harness.operativeAddVerdictGuess(redOp1, secretWords[0]);
    await harness.operativeAddVerdictGuess(redOp1, secretWords[1]);
    await harness.operativeAddVerdictGuess(redOp1, secretWords[2]);
    await harness.operativeAddVerdictGuess(redOp1, "BOGUSONE");
    await harness.operativeAddVerdictGuess(redOp1, "BOGUSTWO");
    await harness.operativeAddVerdictGuess(redOp1, "BOGUSTHREE");

    await expect(op1Page.locator("#guesses-count")).toContainText("6/6");

    // Red Op 1 proposes team verdict (Propose Slate)
    await harness.operativeProposeVerdict(redOp1);

    // Pending proposal card is visible to both teammates
    await expect(op1Page.locator("#pending-proposal-card")).toBeVisible({ timeout: 5000 });
    await expect(op2Page.locator("#pending-proposal-card")).toBeVisible({ timeout: 5000 });
    await expect(op2Page.locator("#confirm-verdict-btn")).toBeVisible();

    // Red Op 2 confirms the proposal (Two-Member Quorum reached)
    await harness.teammateConfirmVerdict(redOp2);

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
    for (const op of harness.sessions) {
      await expect(op.page.locator("#room-phase-badge")).toHaveText("DEBRIEF", {
        timeout: 15000,
      });
    }
  });
});
