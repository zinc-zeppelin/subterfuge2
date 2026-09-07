import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createIsolatedGameStore, cleanupIsolatedStore } from "../helpers/test-store";
import { GameStore } from "@/lib/store/game-store";

describe("Verdict Deliberation & Two-Member Consensus Protocol (Unit)", () => {
  let store: GameStore;
  let testDir: string;

  beforeEach(() => {
    const isolated = createIsolatedGameStore();
    store = isolated.store;
    testDir = isolated.testDir;
  });

  afterEach(() => {
    cleanupIsolatedStore(testDir);
  });

  async function setupVerdictPhase() {
    const { room, host } = await store.createRoom({
      hostName: "Commander",
      sessionToken: "host-tok",
    });

    const playerTokens: Record<string, string> = {
      [host.id]: "host-tok",
    };

    for (let i = 1; i < 6; i++) {
      const res = await store.joinRoom({
        code: room.code,
        playerName: `Op${i}`,
        sessionToken: `tok-${i}`,
      });
      playerTokens[res.player.id] = `tok-${i}`;
    }

    const unstarted = await store.getRoom(room.code);
    for (const p of unstarted!.players) {
      await store.toggleReady(room.code, p.id, playerTokens[p.id]);
    }

    await store.startOperation(room.code, host.sessionToken);
    await store.warpTimer({ code: room.code, target: "VERDICT" });

    const state = await store.getClientGameState(room.code, host.sessionToken);
    const redOps = state.players.filter((p) => p.apparentTeam === "RED");
    const blueOps = state.players.filter((p) => p.apparentTeam === "BLUE");

    return {
      code: room.code,
      host,
      playerTokens,
      redOps,
      blueOps,
    };
  }

  it("allows teammates to propose candidate words and upvote suggestions", async () => {
    const { code, redOps, playerTokens } = await setupVerdictPhase();
    const op1 = redOps[0];
    const op2 = redOps[1];

    const suggestion = await store.addWordSuggestion({
      code,
      sessionToken: playerTokens[op1.id],
      word: "BALLET",
    });

    expect(suggestion.word).toBe("BALLET");
    expect(suggestion.votes.length).toBe(1);

    // Teammate upvotes
    const voted = await store.voteWordSuggestion({
      code,
      sessionToken: playerTokens[op2.id],
      suggestionId: suggestion.id,
    });

    expect(voted.votes.length).toBe(2);
  });

  it("allows adopting words onto the draft slate up to N words", async () => {
    const { code, redOps, playerTokens } = await setupVerdictPhase();
    const op1 = redOps[0];
    const token = playerTokens[op1.id];

    await store.adoptSlateWord({ code, sessionToken: token, word: "WORD1" });
    await store.adoptSlateWord({ code, sessionToken: token, word: "WORD2" });
    await store.adoptSlateWord({ code, sessionToken: token, word: "WORD3" });
    await store.adoptSlateWord({ code, sessionToken: token, word: "WORD4" });
    await store.adoptSlateWord({ code, sessionToken: token, word: "WORD5" });
    const slate = await store.adoptSlateWord({ code, sessionToken: token, word: "WORD6" });

    expect(slate.words).toEqual(["WORD1", "WORD2", "WORD3", "WORD4", "WORD5", "WORD6"]);

    // Exceeding 6 words throws SLATE_FULL
    await expect(
      store.adoptSlateWord({ code, sessionToken: token, word: "WORD7" })
    ).rejects.toThrow(/SLATE_FULL/);
  });

  it("allows removing words from the draft slate", async () => {
    const { code, redOps, playerTokens } = await setupVerdictPhase();
    const op1 = redOps[0];
    const token = playerTokens[op1.id];

    await store.adoptSlateWord({ code, sessionToken: token, word: "ALPHA" });
    await store.adoptSlateWord({ code, sessionToken: token, word: "BRAVO" });

    const slate = await store.removeSlateWord({ code, sessionToken: token, word: "ALPHA" });
    expect(slate.words).toEqual(["BRAVO"]);
  });

  it("enforces Two-Member Consensus for verdict lock-in", async () => {
    const { code, redOps, playerTokens } = await setupVerdictPhase();
    const op1 = redOps[0];
    const op2 = redOps[1];
    const op1Token = playerTokens[op1.id];
    const op2Token = playerTokens[op2.id];

    const sixWords = ["W1", "W2", "W3", "W4", "W5", "W6"];

    // Op 1 proposes verdict
    const firstProposal = await store.submitTeamVerdict({
      code,
      sessionToken: op1Token,
      guesses: sixWords,
      moleIndictmentId: op1.id,
    });

    expect(firstProposal.locked).toBe(false);
    expect(firstProposal.proposedVerdict).toBeDefined();
    expect(firstProposal.proposedVerdict?.confirmedBy).toHaveLength(1);
    expect(firstProposal.proposedVerdict?.confirmedBy).toContain(op1.id);

    // Op 2 confirms proposed verdict -> locks in!
    const secondConfirmation = await store.submitTeamVerdict({
      code,
      sessionToken: op2Token,
      confirmOnly: true,
    });

    expect(secondConfirmation.locked).toBe(true);
    expect(secondConfirmation.verdict).toBeDefined();
    expect(secondConfirmation.verdict?.guesses).toEqual(sixWords);
  });

  it("resets consensus to 1 vote if a teammate proposes a different alternative verdict", async () => {
    const { code, redOps, playerTokens } = await setupVerdictPhase();
    const op1 = redOps[0];
    const op2 = redOps[1];
    const op1Token = playerTokens[op1.id];
    const op2Token = playerTokens[op2.id];

    // Op 1 proposes verdict A
    await store.submitTeamVerdict({
      code,
      sessionToken: op1Token,
      guesses: ["W1", "W2", "W3", "W4", "W5", "W6"],
      moleIndictmentId: op1.id,
    });

    // Op 2 proposes competing verdict B (different words)
    const alternativeProposal = await store.submitTeamVerdict({
      code,
      sessionToken: op2Token,
      guesses: ["A1", "A2", "A3", "A4", "A5", "A6"],
      moleIndictmentId: op2.id,
    });

    // Should overwrite verdict A and have ONLY 1 confirmed voter (Op 2)
    expect(alternativeProposal.locked).toBe(false);
    expect(alternativeProposal.proposedVerdict?.guesses).toEqual(["A1", "A2", "A3", "A4", "A5", "A6"]);
    expect(alternativeProposal.proposedVerdict?.confirmedBy).toEqual([op2.id]);
    expect(alternativeProposal.proposedVerdict?.confirmedBy).toHaveLength(1);
  });

  it("prohibits cross-team verdict tampering", async () => {
    const { code, redOps, blueOps, playerTokens } = await setupVerdictPhase();
    const redOp = redOps[0];
    const blueOp = blueOps[0];
    const redToken = playerTokens[redOp.id];
    const blueToken = playerTokens[blueOp.id];

    // Red op proposes
    await store.submitTeamVerdict({
      code,
      sessionToken: redToken,
      guesses: ["W1", "W2", "W3", "W4", "W5", "W6"],
      moleIndictmentId: redOp.id,
    });

    // Blue op tries to confirm Red team proposal with confirmOnly
    // Because blueOp belongs to BLUE team, submitTeamVerdict operates on BLUE, which has no proposal!
    await expect(
      store.submitTeamVerdict({
        code,
        sessionToken: blueToken,
        confirmOnly: true,
      })
    ).rejects.toThrow(/NO_PROPOSAL_TO_CONFIRM/);
  });
});
