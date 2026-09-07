import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestStore, TestStoreContext } from "../helpers/test-store";
import { Room, Player } from "@/lib/types/game";

describe("Mission Meter Scoring Engine", () => {
  let ctx: TestStoreContext;

  beforeEach(() => {
    ctx = createTestStore();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  // Helper to generate a mock room with given players and words
  function createMockRoom(
    redWords: string[],
    blueWords: string[],
    moleIds: { redTeamMoleId?: string; blueTeamMoleId?: string } = {}
  ): Room {
    const players: Player[] = [];

    redWords.forEach((word, i) => {
      const id = `red-player-${i}`;
      players.push({
        id,
        roomId: "test-room",
        sessionToken: `token-${id}`,
        displayName: `RedOperative-${i}`,
        apparentTeam: "RED",
        actualTeam: id === moleIds.redTeamMoleId ? "BLUE" : "RED",
        role: id === moleIds.redTeamMoleId ? "MOLE" : "AGENT",
        assignedWord: word,
        isReady: true,
        createdAt: new Date().toISOString(),
      });
    });

    blueWords.forEach((word, i) => {
      const id = `blue-player-${i}`;
      players.push({
        id,
        roomId: "test-room",
        sessionToken: `token-${id}`,
        displayName: `BlueOperative-${i}`,
        apparentTeam: "BLUE",
        actualTeam: id === moleIds.blueTeamMoleId ? "RED" : "BLUE",
        role: id === moleIds.blueTeamMoleId ? "MOLE" : "AGENT",
        assignedWord: word,
        isReady: true,
        createdAt: new Date().toISOString(),
      });
    });

    return {
      id: "test-room",
      code: "BCDFGH",
      hostId: "red-player-0",
      phase: "VERDICT",
      durationHours: 24,
      verdictDurationMinutes: 60,
      createdAt: new Date().toISOString(),
      players,
    };
  }

  it("calculates 100% extraction with 0 internal penalty and no mole bonus", () => {
    const room = createMockRoom(["BALLET", "TANGO", "WALTZ"], ["STEP", "SWAY", "SPIN"]);

    // Red guesses all 3 enemy words AND all 3 of their own words
    const guesses = ["STEP", "SWAY", "SPIN", "BALLET", "TANGO", "WALTZ"];
    const result = ctx.store.calculateTeamVerdictScore(room, "RED", guesses);

    expect(result.enemyExtractionScore).toBe(100);
    expect(result.internalDeductionScore).toBe(0);
    expect(result.moleBonusScore).toBe(0);
    expect(result.score).toBe(100);
  });

  it("calculates fractional enemy extraction (e.g. 2 out of 3 = 67%)", () => {
    const room = createMockRoom(["BALLET", "TANGO", "WALTZ"], ["STEP", "SWAY", "SPIN"]);

    // Red guesses 2 of 3 enemy words, all 3 own words, plus 1 bogus word
    const guesses = ["STEP", "SWAY", "BOGUS", "BALLET", "TANGO", "WALTZ"];
    const result = ctx.store.calculateTeamVerdictScore(room, "RED", guesses);

    expect(result.enemyExtractionScore).toBe(67);
    expect(result.internalDeductionScore).toBe(0);
    expect(result.score).toBe(67);
  });

  it("calculates 0% enemy extraction when no enemy words are found", () => {
    const room = createMockRoom(["BALLET", "TANGO", "WALTZ"], ["STEP", "SWAY", "SPIN"]);

    const guesses = ["BOGUS1", "BOGUS2", "BOGUS3", "BALLET", "TANGO", "WALTZ"];
    const result = ctx.store.calculateTeamVerdictScore(room, "RED", guesses);

    expect(result.enemyExtractionScore).toBe(0);
    expect(result.internalDeductionScore).toBe(0);
    expect(result.score).toBe(0);
  });

  it("applies -20% flat penalty for each missed allied code word", () => {
    const room = createMockRoom(["BALLET", "TANGO", "WALTZ"], ["STEP", "SWAY", "SPIN"]);

    // Red guesses all 3 enemy words, but missed 1 own word (WALTZ replaced by BOGUS)
    const guesses1 = ["STEP", "SWAY", "SPIN", "BALLET", "TANGO", "BOGUS"];
    const result1 = ctx.store.calculateTeamVerdictScore(room, "RED", guesses1);

    expect(result1.enemyExtractionScore).toBe(100);
    expect(result1.internalDeductionScore).toBe(20);
    expect(result1.score).toBe(80);

    // Missed 2 own words: -40% penalty
    const guesses2 = ["STEP", "SWAY", "SPIN", "BALLET", "BOGUS1", "BOGUS2"];
    const result2 = ctx.store.calculateTeamVerdictScore(room, "RED", guesses2);

    expect(result2.enemyExtractionScore).toBe(100);
    expect(result2.internalDeductionScore).toBe(40);
    expect(result2.score).toBe(60);
  });

  it("clamps base score to 0 before applying mole indictment bonus", () => {
    const room = createMockRoom(
      ["BALLET", "TANGO", "WALTZ"],
      ["STEP", "SWAY", "SPIN"],
      { redTeamMoleId: "red-player-2" }
    );

    // Red misses all enemy words (0%) and misses all 3 own words (-60% penalty)
    // 0 - 60 = -60, which must be clamped to 0!
    // Plus correctly indicting the mole (+20%): 0 + 20 = 20 (NOT -40)
    const guesses = ["BOGUS1", "BOGUS2", "BOGUS3", "BOGUS4", "BOGUS5", "BOGUS6"];
    const result = ctx.store.calculateTeamVerdictScore(
      room,
      "RED",
      guesses,
      "red-player-2"
    );

    expect(result.enemyExtractionScore).toBe(0);
    expect(result.internalDeductionScore).toBe(60);
    expect(result.moleBonusScore).toBe(20);
    expect(result.score).toBe(20);
  });

  it("awards +20% flat bonus when correctly indicting the embedded mole", () => {
    const room = createMockRoom(
      ["BALLET", "TANGO", "WALTZ"],
      ["STEP", "SWAY", "SPIN"],
      { redTeamMoleId: "red-player-1" }
    );

    const guesses = ["STEP", "SWAY", "SPIN", "BALLET", "TANGO", "WALTZ"];
    const result = ctx.store.calculateTeamVerdictScore(
      room,
      "RED",
      guesses,
      "red-player-1"
    );

    expect(result.moleBonusScore).toBe(20);
    expect(result.moleIndictmentName).toBe("RedOperative-1");
    expect(result.score).toBe(120);
  });

  it("awards 0 bonus when indicting an innocent field agent", () => {
    const room = createMockRoom(
      ["BALLET", "TANGO", "WALTZ"],
      ["STEP", "SWAY", "SPIN"],
      { redTeamMoleId: "red-player-1" }
    );

    const guesses = ["STEP", "SWAY", "SPIN", "BALLET", "TANGO", "WALTZ"];
    // Indict red-player-0 who is a genuine AGENT, not a MOLE
    const result = ctx.store.calculateTeamVerdictScore(
      room,
      "RED",
      guesses,
      "red-player-0"
    );

    expect(result.moleBonusScore).toBe(0);
    expect(result.moleIndictmentName).toBe("RedOperative-0");
    expect(result.score).toBe(100);
  });

  it("handles case-insensitivity and whitespace padding in guesses", () => {
    const room = createMockRoom(["BALLET", "TANGO", "WALTZ"], ["STEP", "SWAY", "SPIN"]);

    const guesses = [
      "  step  ",
      "sway",
      "SpIn",
      "ballet",
      "TANGO",
      "  waltz  ",
    ];
    const result = ctx.store.calculateTeamVerdictScore(room, "RED", guesses);

    expect(result.enemyExtractionScore).toBe(100);
    expect(result.internalDeductionScore).toBe(0);
    expect(result.score).toBe(100);
  });

  it("calculates asymmetric extraction proportions for odd player counts (4 Red vs 3 Blue)", () => {
    const room = createMockRoom(
      ["BALLET", "TANGO", "WALTZ", "ROUTINE"], // 4 Red players
      ["STEP", "SWAY", "SPIN"] // 3 Blue players
    );

    // Blue guessing Red: 4 enemy words available (25% per word)
    const blueGuesses = ["BALLET", "TANGO", "BOGUS1", "STEP", "SWAY", "SPIN"];
    const blueResult = ctx.store.calculateTeamVerdictScore(room, "BLUE", blueGuesses);
    expect(blueResult.enemyExtractionScore).toBe(50); // 2 out of 4 = 50%

    // Red guessing Blue: 3 enemy words available (33.33% per word)
    const redGuesses = ["STEP", "BOGUS1", "BOGUS2", "BALLET", "TANGO", "WALTZ", "ROUTINE"];
    const redResult = ctx.store.calculateTeamVerdictScore(room, "RED", redGuesses);
    expect(redResult.enemyExtractionScore).toBe(33); // 1 out of 3 = 33%
  });
});
