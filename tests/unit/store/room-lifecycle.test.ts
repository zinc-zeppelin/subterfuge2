import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestStore, TestStoreContext } from "../helpers/test-store";

describe("Room Lifecycle, Lobby Management & Session Persistence", () => {
  let ctx: TestStoreContext;

  beforeEach(() => {
    ctx = createTestStore();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  describe("Room Code Generation", () => {
    it("generates unambiguous 6-character Jackbox-style room codes", () => {
      const allowedChars = new Set("BCDFGHJKMNPQRSTVWXYZ23456789".split(""));
      for (let i = 0; i < 50; i++) {
        const code = ctx.store.generateRoomCode();
        expect(code.length).toBe(6);
        for (const char of code) {
          expect(allowedChars.has(char)).toBe(true);
        }
        // Vowels and ambiguous characters strictly prohibited
        expect(code).not.toMatch(/[AEIOU01L]/);
      }
    });
  });

  describe("Room Creation & Joining", () => {
    it("creates a room with trimmed host callsign and default durations", async () => {
      const { room, host } = await ctx.store.createRoom({
        hostName: "  Commander-Alpha  ",
        sessionToken: "host-session-123",
      });

      expect(room.code.length).toBe(6);
      expect(room.phase).toBe("LOBBY");
      expect(room.durationHours).toBe(12);
      expect(room.verdictDurationMinutes).toBe(60);
      expect(room.players.length).toBe(1);

      expect(host.displayName).toBe("Commander-Alpha");
      expect(host.isHost).toBe(true);
      expect(host.isReady).toBe(false);
      expect(host.sessionToken).toBe("host-session-123");
    });

    it("respects custom infiltration and verdict durations", async () => {
      const { room } = await ctx.store.createRoom({
        hostName: "Host",
        sessionToken: "token-host",
        durationHours: 6,
        verdictDurationMinutes: 30,
      });

      expect(room.durationHours).toBe(6);
      expect(room.verdictDurationMinutes).toBe(30);
    });

    it("validates duration bounds (1-24 hours) during room creation", async () => {
      await expect(
        ctx.store.createRoom({
          hostName: "Host",
          sessionToken: "token-host",
          durationHours: 0,
        })
      ).rejects.toThrow("INVALID_DURATION");

      await expect(
        ctx.store.createRoom({
          hostName: "Host",
          sessionToken: "token-host",
          durationHours: 25,
        })
      ).rejects.toThrow("INVALID_DURATION");

      await expect(
        ctx.store.createRoom({
          hostName: "Host",
          sessionToken: "token-host",
          durationHours: 5.5,
        })
      ).rejects.toThrow("INVALID_DURATION");

      // Regression: reject non-numeric values (boolean, array)
      await expect(
        ctx.store.createRoom({
          hostName: "Host",
          sessionToken: "token-host",
          durationHours: true as any,
        })
      ).rejects.toThrow("INVALID_DURATION");

      await expect(
        ctx.store.createRoom({
          hostName: "Host",
          sessionToken: "token-host",
          durationHours: [8] as any,
        })
      ).rejects.toThrow("INVALID_DURATION");
    });

    it("updates room duration settings by host in lobby", async () => {
      const { room } = await ctx.store.createRoom({
        hostName: "Host",
        sessionToken: "host-tok",
      });
      expect(room.durationHours).toBe(12);

      const updated = await ctx.store.updateRoomSettings(room.code, "host-tok", {
        durationHours: 8,
      });
      expect(updated.durationHours).toBe(8);

      const boundMin = await ctx.store.updateRoomSettings(room.code, "host-tok", {
        durationHours: 1,
      });
      expect(boundMin.durationHours).toBe(1);

      const boundMax = await ctx.store.updateRoomSettings(room.code, "host-tok", {
        durationHours: 24,
      });
      expect(boundMax.durationHours).toBe(24);
    });

    it("rejects invalid duration updates and non-host calls", async () => {
      const { room } = await ctx.store.createRoom({
        hostName: "Host",
        sessionToken: "host-tok",
      });

      const { player: p2 } = await ctx.store.joinRoom({
        code: room.code,
        playerName: "Player-2",
        sessionToken: "p2-tok",
      });

      // Non-host attempt
      await expect(
        ctx.store.updateRoomSettings(room.code, "p2-tok", { durationHours: 6 })
      ).rejects.toThrow("UNAUTHORIZED");

      // Invalid bounds
      await expect(
        ctx.store.updateRoomSettings(room.code, "host-tok", { durationHours: 0 })
      ).rejects.toThrow("INVALID_DURATION");

      await expect(
        ctx.store.updateRoomSettings(room.code, "host-tok", { durationHours: 25 })
      ).rejects.toThrow("INVALID_DURATION");

      // Regression: reject non-numeric values (boolean, array)
      await expect(
        ctx.store.updateRoomSettings(room.code, "host-tok", { durationHours: true as any })
      ).rejects.toThrow("INVALID_DURATION");

      await expect(
        ctx.store.updateRoomSettings(room.code, "host-tok", { durationHours: [8] as any })
      ).rejects.toThrow("INVALID_DURATION");
    });

    it("allows operatives to join an active lobby", async () => {
      const { room } = await ctx.store.createRoom({
        hostName: "Host",
        sessionToken: "token-host",
      });

      const { player } = await ctx.store.joinRoom({
        code: room.code,
        playerName: "Operative-Beta",
        sessionToken: "token-beta",
      });

      expect(player.displayName).toBe("Operative-Beta");
      expect(player.isHost).toBe(false);
      expect(player.isReady).toBe(false);

      const fetchedRoom = await ctx.store.getRoom(room.code);
      expect(fetchedRoom?.players.length).toBe(2);
    });

    it("rejects joining a non-existent room", async () => {
      await expect(
        ctx.store.joinRoom({
          code: "ZZZZZZ",
          playerName: "Ghost",
          sessionToken: "token-ghost",
        })
      ).rejects.toThrowError(/OPERATION_NOT_FOUND/);
    });

    it("rejects duplicate callsigns in the same lobby", async () => {
      const { room } = await ctx.store.createRoom({
        hostName: "Commander-Alpha",
        sessionToken: "token-host",
      });

      await expect(
        ctx.store.joinRoom({
          code: room.code,
          playerName: "commander-alpha", // Case-insensitive duplicate
          sessionToken: "token-duplicate",
        })
      ).rejects.toThrowError(/OPERATIVE_EXISTS/);
    });

    it("reconnects an existing session token without duplicating player entry", async () => {
      const { room, host } = await ctx.store.createRoom({
        hostName: "Commander-Alpha",
        sessionToken: "reusable-session-token",
      });

      const rejoin = await ctx.store.joinRoom({
        code: room.code,
        playerName: "Commander-Alpha",
        sessionToken: "reusable-session-token",
      });

      expect(rejoin.player.id).toBe(host.id);
      expect(rejoin.player.displayName).toBe("Commander-Alpha");
      expect(rejoin.room.players.length).toBe(1);
    });

    it("enforces maximum lobby capacity (12 operatives)", async () => {
      const { room, host } = await ctx.store.createRoom({
        hostName: "Host",
        sessionToken: "token-host",
      });

      for (let i = 1; i < 12; i++) {
        await ctx.store.joinRoom({
          code: room.code,
          playerName: `Op-${i}`,
          sessionToken: `token-${i}`,
        });
      }

      // 13th player attempt
      await expect(
        ctx.store.joinRoom({
          code: room.code,
          playerName: "Op-13",
          sessionToken: "token-13",
        })
      ).rejects.toThrowError(/CAPACITY_REACHED/);
    });
  });

  describe("Readiness & Start Gating", () => {
    it("toggles player readiness status", async () => {
      const { room, host } = await ctx.store.createRoom({
        hostName: "Host",
        sessionToken: "token-host",
      });

      expect(host.isReady).toBe(false);

      const toggled1 = await ctx.store.toggleReady(room.code, host.id, "token-host");
      expect(toggled1.isReady).toBe(true);

      const toggled2 = await ctx.store.toggleReady(room.code, host.id, "token-host");
      expect(toggled2.isReady).toBe(false);
    });

    it("prevents toggling readiness using mismatched session credentials", async () => {
      const { room, host } = await ctx.store.createRoom({
        hostName: "Host",
        sessionToken: "token-host",
      });

      await expect(
        ctx.store.toggleReady(room.code, host.id, "imposter-token")
      ).rejects.toThrowError(/Operative not found|UNAUTHORIZED/);
    });
  });

  describe("Lobby Management: Leave & Kick", () => {
    it("allows a non-host operative to leave lobby", async () => {
      const { room } = await ctx.store.createRoom({
        hostName: "Host",
        sessionToken: "token-host",
      });
      const { player } = await ctx.store.joinRoom({
        code: room.code,
        playerName: "Operative",
        sessionToken: "token-op",
      });

      const leaveRes = await ctx.store.leaveRoom({
        code: room.code,
        sessionToken: "token-op",
      });
      expect(leaveRes.success).toBe(true);

      const updated = await ctx.store.getRoom(room.code);
      expect(updated?.players.length).toBe(1);
      expect(updated?.players[0].displayName).toBe("Host");
    });

    it("migrates host role to oldest remaining player when host leaves", async () => {
      const { room } = await ctx.store.createRoom({
        hostName: "OriginalHost",
        sessionToken: "token-host",
      });
      const { player: op1 } = await ctx.store.joinRoom({
        code: room.code,
        playerName: "NewHostCandidate",
        sessionToken: "token-op1",
      });

      const leaveRes = await ctx.store.leaveRoom({
        code: room.code,
        sessionToken: "token-host",
      });
      expect(leaveRes.success).toBe(true);
      expect(leaveRes.newHostId).toBe(op1.id);

      const updated = await ctx.store.getRoom(room.code);
      expect(updated?.hostId).toBe(op1.id);
      expect(updated?.players[0].isHost).toBe(true);
    });

    it("destroys room when last remaining operative leaves", async () => {
      const { room } = await ctx.store.createRoom({
        hostName: "SoloOperative",
        sessionToken: "token-solo",
      });

      const leaveRes = await ctx.store.leaveRoom({
        code: room.code,
        sessionToken: "token-solo",
      });
      expect(leaveRes.roomClosed).toBe(true);

      const updated = await ctx.store.getRoom(room.code);
      expect(updated).toBeUndefined();
    });

    it("allows host to dismiss an operative from lobby", async () => {
      const { room } = await ctx.store.createRoom({
        hostName: "Commander",
        sessionToken: "token-host",
      });
      const { player } = await ctx.store.joinRoom({
        code: room.code,
        playerName: "DisobedientOp",
        sessionToken: "token-target",
      });

      const kickRes = await ctx.store.kickPlayer({
        code: room.code,
        hostSessionToken: "token-host",
        targetPlayerId: player.id,
      });
      expect(kickRes.success).toBe(true);

      const updated = await ctx.store.getRoom(room.code);
      expect(updated?.players.length).toBe(1);
    });

    it("prevents host from kicking themselves", async () => {
      const { room, host } = await ctx.store.createRoom({
        hostName: "Commander",
        sessionToken: "token-host",
      });

      await expect(
        ctx.store.kickPlayer({
          code: room.code,
          hostSessionToken: "token-host",
          targetPlayerId: host.id,
        })
      ).rejects.toThrowError(/CANNOT_KICK_HOST/);
    });

    it("prevents non-hosts from kicking other operatives", async () => {
      const { room } = await ctx.store.createRoom({
        hostName: "Commander",
        sessionToken: "token-host",
      });
      const { player: op1 } = await ctx.store.joinRoom({
        code: room.code,
        playerName: "Op1",
        sessionToken: "token-op1",
      });
      const { player: op2 } = await ctx.store.joinRoom({
        code: room.code,
        playerName: "Op2",
        sessionToken: "token-op2",
      });

      await expect(
        ctx.store.kickPlayer({
          code: room.code,
          hostSessionToken: "token-op1", // Non-host attempt
          targetPlayerId: op2.id,
        })
      ).rejects.toThrowError(/UNAUTHORIZED/);
    });
  });

  describe("Pre-Mission Briefing Authentication & Burn", () => {
    it("burns briefing when operative supplies matching codeword", async () => {
      const { room } = await ctx.store.createRoom({
        hostName: "Host",
        sessionToken: "token-0",
      });
      await ctx.store.toggleReady(room.code, undefined, "token-0");

      for (let i = 1; i < 6; i++) {
        const { player } = await ctx.store.joinRoom({
          code: room.code,
          playerName: `Op-${i}`,
          sessionToken: `token-${i}`,
        });
        await ctx.store.toggleReady(room.code, player.id, `token-${i}`);
      }

      const started = await ctx.store.startOperation(room.code, "token-0");
      const host = started.players.find((p) => p.isHost)!;
      expect(host.assignedWord).toBeDefined();

      const burnRes = await ctx.store.burnBriefing({
        code: room.code,
        sessionToken: "token-0",
        codeword: host.assignedWord!,
      });
      expect(burnRes.success).toBe(true);
      expect(burnRes.player.hasBurnedBriefing).toBe(true);
    });

    it("rejects briefing burn when codeword does not match assigned word", async () => {
      const { room } = await ctx.store.createRoom({
        hostName: "Host",
        sessionToken: "token-0",
      });
      await ctx.store.toggleReady(room.code, undefined, "token-0");

      for (let i = 1; i < 6; i++) {
        const { player } = await ctx.store.joinRoom({
          code: room.code,
          playerName: `Op-${i}`,
          sessionToken: `token-${i}`,
        });
        await ctx.store.toggleReady(room.code, player.id, `token-${i}`);
      }

      await ctx.store.startOperation(room.code, "token-0");

      await expect(
        ctx.store.burnBriefing({
          code: room.code,
          sessionToken: "token-0",
          codeword: "WRONG_INCORRECT_CODEWORD",
        })
      ).rejects.toThrowError(/INVALID_CODEWORD/);
    });
  });

  describe("Rematch Operational Loop", () => {
    it("resets room to LOBBY and clears all secret assignments while preserving connected players", async () => {
      const { room } = await ctx.store.createRoom({
        hostName: "Host",
        sessionToken: "token-0",
      });
      await ctx.store.toggleReady(room.code, undefined, "token-0");

      for (let i = 1; i < 6; i++) {
        const { player } = await ctx.store.joinRoom({
          code: room.code,
          playerName: `Op-${i}`,
          sessionToken: `token-${i}`,
        });
        await ctx.store.toggleReady(room.code, player.id, `token-${i}`);
      }

      await ctx.store.startOperation(room.code, "token-0");

      // Host authorizes rematch
      const rematched = await ctx.store.rematchOperation(room.code, "token-0");

      expect(rematched.phase).toBe("LOBBY");
      expect(rematched.players.length).toBe(6);
      expect(rematched.selectedTheme).toBeUndefined();
      expect(rematched.codebook).toBeUndefined();
      expect(rematched.winner).toBeUndefined();

      for (const p of rematched.players) {
        expect(p.isReady).toBe(false);
        expect(p.role).toBeUndefined();
        expect(p.assignedWord).toBeUndefined();
        expect(p.apparentTeam).toBeUndefined();
        expect(p.actualTeam).toBeUndefined();
        expect(p.hasBurnedBriefing).toBe(false);
      }
    });

    it("prevents non-hosts from authorizing a rematch", async () => {
      const { room } = await ctx.store.createRoom({
        hostName: "Host",
        sessionToken: "token-0",
      });
      await ctx.store.toggleReady(room.code, undefined, "token-0");

      for (let i = 1; i < 6; i++) {
        const { player } = await ctx.store.joinRoom({
          code: room.code,
          playerName: `Op-${i}`,
          sessionToken: `token-${i}`,
        });
        await ctx.store.toggleReady(room.code, player.id, `token-${i}`);
      }

      await ctx.store.startOperation(room.code, "token-0");

      await expect(
        ctx.store.rematchOperation(room.code, "token-1") // Non-host attempt
      ).rejects.toThrowError(/UNAUTHORIZED/);
    });
  });
});
