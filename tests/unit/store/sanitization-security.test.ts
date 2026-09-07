import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createIsolatedGameStore, cleanupIsolatedStore } from "../helpers/test-store";
import { GameStore } from "@/lib/store/game-store";

describe("Client State Sanitization & Redaction Security (Unit)", () => {
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

  async function createStartedGame() {
    const { room, host } = await store.createRoom({
      hostName: "Commander",
      sessionToken: "host-tok",
    });

    const tokens = ["host-tok"];
    for (let i = 1; i < 6; i++) {
      const res = await store.joinRoom({
        code: room.code,
        playerName: `Agent${i}`,
        sessionToken: `tok-${i}`,
      });
      tokens.push(`tok-${i}`);
    }

    for (let i = 0; i < 6; i++) {
      await store.toggleReady(room.code, undefined, tokens[i]);
    }

    const activeRoom = await store.startOperation(room.code, host.sessionToken);
    return { code: room.code, activeRoom, tokens };
  }

  it("strictly scrubs opposing and teammate secret roles, words, and true teams during INFILTRATION", async () => {
    const { code, tokens } = await createStartedGame();

    const clientState = await store.getClientGameState(code, tokens[0]);

    // Caller self state is fully defined
    expect(clientState.self.assignedWord).toBeDefined();
    expect(clientState.self.role).toBeDefined();
    expect(clientState.self.actualTeam).toBeDefined();
    expect(clientState.self.apparentTeam).toBeDefined();

    // Redacted players array
    expect(clientState.players.length).toBe(6);
    for (const p of clientState.players) {
      expect(p.displayName).toBeDefined();
      expect(p.apparentTeam).toBeDefined();
      expect(p.isReady).toBeDefined();
      // Crucial: hidden during INFILTRATION
      expect(p.assignedWord).toBeUndefined();
      expect(p.role).toBeUndefined();
      expect(p.actualTeam).toBeUndefined();
    }

    // Codebook must be withheld
    expect(clientState.codebook).toBeUndefined();
  });

  it("redacts selectedTheme before midpoint and declassifies it after midpoint", async () => {
    const { code, tokens } = await createStartedGame();

    // Before midpoint
    const earlyState = await store.getClientGameState(code, tokens[0]);
    expect(earlyState.room.declassifiedTheme).toBeUndefined();

    // Warp to midpoint
    await store.warpTimer({ code, target: "MIDPOINT" });

    // After midpoint
    const midState = await store.getClientGameState(code, tokens[0]);
    expect(midState.room.declassifiedTheme).toBeDefined();
    expect(typeof midState.room.declassifiedTheme).toBe("string");
  });

  it("strictly scrubs secret data during VERDICT phase as well", async () => {
    const { code, tokens } = await createStartedGame();
    await store.warpTimer({ code, target: "VERDICT" });

    const verdictState = await store.getClientGameState(code, tokens[0]);
    expect(verdictState.room.phase).toBe("VERDICT");

    for (const p of verdictState.players) {
      expect(p.assignedWord).toBeUndefined();
      expect(p.role).toBeUndefined();
      expect(p.actualTeam).toBeUndefined();
    }
    expect(verdictState.codebook).toBeUndefined();
  });

  it("fully declassifies all player roles, actual teams, assigned words, and codebook in DEBRIEF", async () => {
    const { code, tokens } = await createStartedGame();
    await store.warpTimer({ code, target: "DEBRIEF" });

    const debriefState = await store.getClientGameState(code, tokens[0]);
    expect(debriefState.room.phase).toBe("DEBRIEF");

    for (const p of debriefState.players) {
      expect(p.assignedWord).toBeDefined();
      expect(p.role).toBeDefined();
      expect(p.actualTeam).toBeDefined();
    }

    expect(debriefState.codebook).toBeDefined();
    expect(Object.keys(debriefState.codebook || {}).length).toBe(6);
  });

  it("rejects unauthorized sessions attempting to fetch client state", async () => {
    const { code } = await createStartedGame();

    await expect(
      store.getClientGameState(code, "malicious-unknown-token")
    ).rejects.toThrow(/Unauthorized/);
  });
});
