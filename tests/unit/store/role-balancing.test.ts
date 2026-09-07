import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestStore, TestStoreContext } from "../helpers/test-store";
import { AVAILABLE_THEMES } from "@/lib/data/word-bank";

describe("Role Balancing & Faction Distribution Matrix (6-12 Players)", () => {
  let ctx: TestStoreContext;

  beforeEach(() => {
    ctx = createTestStore();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  // Helper to create and fill a room with N operatives, ready them all, and commence
  async function setupAndStartRoom(playerCount: number) {
    const hostToken = "host-token";
    const { room, host } = await ctx.store.createRoom({
      hostName: "Host-0",
      sessionToken: hostToken,
    });
    await ctx.store.toggleReady(room.code, host.id, hostToken);

    for (let i = 1; i < playerCount; i++) {
      const token = `token-${i}`;
      const { player } = await ctx.store.joinRoom({
        code: room.code,
        playerName: `Player-${i}`,
        sessionToken: token,
      });
      await ctx.store.toggleReady(room.code, player.id, token);
    }

    const startedRoom = await ctx.store.startOperation(room.code, hostToken);
    return { room: startedRoom, hostToken };
  }

  it("rejects infiltration start if player count is under 6", async () => {
    const hostToken = "host-token";
    const { room, host } = await ctx.store.createRoom({
      hostName: "Host-0",
      sessionToken: hostToken,
    });
    await ctx.store.toggleReady(room.code, host.id, hostToken);

    // Only 3 players
    for (let i = 1; i < 3; i++) {
      const token = `token-${i}`;
      const { player } = await ctx.store.joinRoom({
        code: room.code,
        playerName: `Player-${i}`,
        sessionToken: token,
      });
      await ctx.store.toggleReady(room.code, player.id, token);
    }

    await expect(
      ctx.store.startOperation(room.code, hostToken)
    ).rejects.toThrowError(/INVALID_ROSTER_COUNT/);
  });

  it("rejects infiltration start if any operative is not ready", async () => {
    const hostToken = "host-token";
    const { room, host } = await ctx.store.createRoom({
      hostName: "Host-0",
      sessionToken: hostToken,
    });
    // Host is ready
    await ctx.store.toggleReady(room.code, host.id, hostToken);

    // Add 5 players, leave the last one not ready
    for (let i = 1; i < 6; i++) {
      const token = `token-${i}`;
      const { player } = await ctx.store.joinRoom({
        code: room.code,
        playerName: `Player-${i}`,
        sessionToken: token,
      });
      if (i < 5) {
        await ctx.store.toggleReady(room.code, player.id, token);
      }
    }

    await expect(
      ctx.store.startOperation(room.code, hostToken)
    ).rejects.toThrowError(/NOT_READY/);
  });

  it("rejects infiltration start if initiated by a non-host operative", async () => {
    const hostToken = "host-token";
    const { room, host } = await ctx.store.createRoom({
      hostName: "Host-0",
      sessionToken: hostToken,
    });
    await ctx.store.toggleReady(room.code, host.id, hostToken);

    let nonHostToken = "";
    for (let i = 1; i < 6; i++) {
      const token = `token-${i}`;
      if (i === 1) nonHostToken = token;
      const { player } = await ctx.store.joinRoom({
        code: room.code,
        playerName: `Player-${i}`,
        sessionToken: token,
      });
      await ctx.store.toggleReady(room.code, player.id, token);
    }

    await expect(
      ctx.store.startOperation(room.code, nonHostToken)
    ).rejects.toThrowError(/UNAUTHORIZED/);
  });

  it.each([6, 8, 10])("correctly balances even player counts (N=%i): equal team sizes and 1 mole per team", async (n) => {
    const { room } = await setupAndStartRoom(n);

    expect(room.players.length).toBe(n);

    const redPlayers = room.players.filter((p) => p.apparentTeam === "RED");
    const bluePlayers = room.players.filter((p) => p.apparentTeam === "BLUE");

    expect(redPlayers.length).toBe(n / 2);
    expect(bluePlayers.length).toBe(n / 2);

    const redMoles = redPlayers.filter((p) => p.role === "MOLE");
    const blueMoles = bluePlayers.filter((p) => p.role === "MOLE");

    expect(redMoles.length).toBe(1);
    expect(blueMoles.length).toBe(1);

    // Red mole has true loyalty to BLUE
    expect(redMoles[0].actualTeam).toBe("BLUE");
    // Blue mole has true loyalty to RED
    expect(blueMoles[0].actualTeam).toBe("RED");
  });

  it.each([7, 9, 11])("correctly balances odd player counts (N=%i): ceil/floor split and 1 mole per team", async (n) => {
    const { room } = await setupAndStartRoom(n);

    expect(room.players.length).toBe(n);

    const redPlayers = room.players.filter((p) => p.apparentTeam === "RED");
    const bluePlayers = room.players.filter((p) => p.apparentTeam === "BLUE");

    const expectedLarger = Math.ceil(n / 2);
    const expectedSmaller = Math.floor(n / 2);

    expect(
      (redPlayers.length === expectedLarger && bluePlayers.length === expectedSmaller) ||
      (redPlayers.length === expectedSmaller && bluePlayers.length === expectedLarger)
    ).toBe(true);

    const redMoles = redPlayers.filter((p) => p.role === "MOLE");
    const blueMoles = bluePlayers.filter((p) => p.role === "MOLE");

    expect(redMoles.length).toBe(1);
    expect(blueMoles.length).toBe(1);
    expect(redMoles[0].actualTeam).toBe("BLUE");
    expect(blueMoles[0].actualTeam).toBe("RED");
  });

  it("deploys double moles at max capacity (N=12): 2 moles per team (4 moles total)", async () => {
    const { room } = await setupAndStartRoom(12);

    expect(room.players.length).toBe(12);

    const redPlayers = room.players.filter((p) => p.apparentTeam === "RED");
    const bluePlayers = room.players.filter((p) => p.apparentTeam === "BLUE");

    expect(redPlayers.length).toBe(6);
    expect(bluePlayers.length).toBe(6);

    const redMoles = redPlayers.filter((p) => p.role === "MOLE");
    const blueMoles = bluePlayers.filter((p) => p.role === "MOLE");

    expect(redMoles.length).toBe(2);
    expect(blueMoles.length).toBe(2);

    for (const mole of redMoles) {
      expect(mole.apparentTeam).toBe("RED");
      expect(mole.actualTeam).toBe("BLUE");
    }
    for (const mole of blueMoles) {
      expect(mole.apparentTeam).toBe("BLUE");
      expect(mole.actualTeam).toBe("RED");
    }
  });

  it("strictly prohibits legacy spymaster role across all operative assignments", async () => {
    const { room } = await setupAndStartRoom(8);
    for (const p of room.players) {
      expect(p.role).not.toBe("SPYMASTER");
      expect(["AGENT", "MOLE"]).toContain(p.role);
    }
  });

  it("assigns unique code words to every operative from the designated theme", async () => {
    const { room } = await setupAndStartRoom(8);
    expect(room.selectedTheme).toBeDefined();
    expect(AVAILABLE_THEMES).toContain(room.selectedTheme);

    const assignedWords = room.players.map((p) => p.assignedWord);
    for (const word of assignedWords) {
      expect(word).toBeTruthy();
    }

    const uniqueWords = new Set(assignedWords);
    expect(uniqueWords.size).toBe(8);
  });
});
