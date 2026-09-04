import { test, expect } from "@playwright/test";
import { SixPlayerHarness } from "../harness/multiplayer-harness";

test.describe("Slice 6: Collaborative Verdict Board, Spymaster Lock-In & Scoring (+1 / 0)", () => {
  let harness: SixPlayerHarness;

  test.beforeEach(async ({ browser }) => {
    harness = new SixPlayerHarness(browser);
  });

  test.afterEach(async () => {
    await harness.teardown();
  });

  test("supports collaborative word proposals, enforces spymaster-only lock-in, scores +1 for correct and 0 for wrong, and transitions to DEBRIEF when both verdicts are locked", async ({
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

    // 3. Identify roles
    let redSpymasterIdx = -1;
    let redAgentIdx = -1;
    let blueSpymasterIdx = -1;

    for (let i = 0; i < 6; i++) {
      const dossier = await harness.getPlayerDossier(i);
      if (dossier.apparentTeam === "RED" && dossier.role === "SPYMASTER") {
        redSpymasterIdx = i;
      } else if (dossier.apparentTeam === "RED" && dossier.role === "AGENT") {
        redAgentIdx = i;
      } else if (dossier.apparentTeam === "BLUE" && dossier.role === "SPYMASTER") {
        blueSpymasterIdx = i;
      }
    }

    expect(redSpymasterIdx).toBeGreaterThanOrEqual(0);
    expect(redAgentIdx).toBeGreaterThanOrEqual(0);
    expect(blueSpymasterIdx).toBeGreaterThanOrEqual(0);

    // 4. Warp time to VERDICT phase
    await harness.warpTime("VERDICT");

    for (const op of harness.sessions) {
      await expect(op.page.locator("#room-phase-badge")).toHaveText("VERDICT", {
        timeout: 15000,
      });
      await expect(op.page.locator("#verdict-board")).toBeVisible({ timeout: 15000 });
    }

    // 5. Check Non-Spymaster vs Spymaster Permissions:
    // Red Agent: CAN propose words, CANNOT lock in verdict
    const agentPage = harness.sessions[redAgentIdx].page;
    await expect(agentPage.locator("#awaiting-spymaster-notice")).toBeVisible();
    await expect(agentPage.locator("#lock-in-verdict-btn")).not.toBeVisible();

    // Red Agent proposes a word
    await harness.proposeWord(redAgentIdx, "CANDIDATEWORD");
    await expect(agentPage.locator("#suggestions-list")).toContainText("CANDIDATEWORD");

    // Red Spymaster sees the proposal and has lock-in authority
    const redSpyPage = harness.sessions[redSpymasterIdx].page;
    await expect(redSpyPage.locator("#suggestions-list")).toContainText("CANDIDATEWORD");
    await expect(redSpyPage.locator("#lock-in-verdict-btn")).toBeVisible();

    // 6. Red Spymaster populates 6 guesses (3 correct, 3 wrong)
    // Add 3 correct words
    await harness.spymasterAddGuess(redSpymasterIdx, secretWords[0]);
    await harness.spymasterAddGuess(redSpymasterIdx, secretWords[1]);
    await harness.spymasterAddGuess(redSpymasterIdx, secretWords[2]);
    // Add 3 wrong words
    await harness.spymasterAddGuess(redSpymasterIdx, "BOGUSONE");
    await harness.spymasterAddGuess(redSpymasterIdx, "BOGUSTWO");
    await harness.spymasterAddGuess(redSpymasterIdx, "BOGUSTHREE");

    await expect(redSpyPage.locator("#guesses-count")).toContainText("6/6");

    // Red Spymaster locks in verdict
    await harness.spymasterSubmitVerdict(redSpymasterIdx);
    await harness.expectVerdictLocked(redSpymasterIdx);
    // Red Agent also sees the verdict is locked in
    await harness.expectVerdictLocked(redAgentIdx);

    // 7. Blue Spymaster populates 6 guesses (5 correct, 1 wrong)
    const blueSpyPage = harness.sessions[blueSpymasterIdx].page;
    await expect(blueSpyPage.locator("#lock-in-verdict-btn")).toBeVisible();

    await harness.spymasterAddGuess(blueSpymasterIdx, secretWords[0]);
    await harness.spymasterAddGuess(blueSpymasterIdx, secretWords[1]);
    await harness.spymasterAddGuess(blueSpymasterIdx, secretWords[2]);
    await harness.spymasterAddGuess(blueSpymasterIdx, secretWords[3]);
    await harness.spymasterAddGuess(blueSpymasterIdx, secretWords[4]);
    await harness.spymasterAddGuess(blueSpymasterIdx, "WRONGBLUE");

    // Blue Spymaster locks in verdict
    await harness.spymasterSubmitVerdict(blueSpymasterIdx);

    // 8. Both verdicts are in -> Automatic transition to DEBRIEF phase
    for (const op of harness.sessions) {
      await expect(op.page.locator("#room-phase-badge")).toHaveText("DEBRIEF", {
        timeout: 15000,
      });
    }
  });
});
