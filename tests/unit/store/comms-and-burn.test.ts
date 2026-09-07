import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createIsolatedGameStore, cleanupIsolatedStore } from "../helpers/test-store";
import { GameStore } from "@/lib/store/game-store";

describe("Comms & Shred Protocol (Unit)", () => {
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

  async function setupActiveRoom() {
    const { room, host } = await store.createRoom({
      hostName: "Host",
      sessionToken: "host-tok",
    });

    const players = [host];
    for (let i = 1; i < 6; i++) {
      const res = await store.joinRoom({
        code: room.code,
        playerName: `Op${i}`,
        sessionToken: `tok-${i}`,
      });
      players.push(res.player);
    }

    for (const p of players) {
      await store.toggleReady(room.code, p.id, p.sessionToken);
    }

    const started = await store.startOperation(room.code, host.sessionToken);

    const redOps = started.players.filter((p) => p.apparentTeam === "RED");
    const blueOps = started.players.filter((p) => p.apparentTeam === "BLUE");

    return { room: started, players: started.players, redOps, blueOps };
  }

  it("allows operatives to broadcast public transmissions readable by everyone", async () => {
    const { room, players } = await setupActiveRoom();

    const sender = players[0];
    const msg = await store.sendMessage({
      code: room.code,
      sessionToken: sender.sessionToken,
      channelType: "PUBLIC",
      content: "Attention all operatives",
    });

    expect(msg.channelType).toBe("PUBLIC");
    expect(msg.content).toBe("Attention all operatives");
    expect(msg.senderName).toBe(sender.displayName);

    for (const p of players) {
      const comms = await store.getMessages({
        code: room.code,
        sessionToken: p.sessionToken,
        channelType: "PUBLIC",
      });
      expect(comms.some((m) => m.id === msg.id)).toBe(true);
    }
  });

  it("enforces strict team channel isolation between RED and BLUE", async () => {
    const { room, redOps, blueOps } = await setupActiveRoom();

    const redSender = redOps[0];
    const redMsg = await store.sendMessage({
      code: room.code,
      sessionToken: redSender.sessionToken,
      channelType: "TEAM_RED",
      content: "Classified Red Directive",
    });

    for (const red of redOps) {
      const comms = await store.getMessages({
        code: room.code,
        sessionToken: red.sessionToken,
      });
      expect(comms.some((m) => m.id === redMsg.id)).toBe(true);
    }

    for (const blue of blueOps) {
      const comms = await store.getMessages({
        code: room.code,
        sessionToken: blue.sessionToken,
      });
      expect(comms.some((m) => m.id === redMsg.id)).toBe(false);
    }
  });

  it("prevents operatives from posting to opposing team channels", async () => {
    const { room, redOps } = await setupActiveRoom();
    const redOp = redOps[0];

    await expect(
      store.sendMessage({
        code: room.code,
        sessionToken: redOp.sessionToken,
        channelType: "TEAM_BLUE",
        content: "Infiltrating blue wire",
      })
    ).rejects.toThrow();
  });

  it("enforces strict 1-on-1 DM privacy and rejects eavesdropping", async () => {
    const { room, players } = await setupActiveRoom();
    const sender = players[0];
    const recipient = players[1];
    const eavesdropper = players[2];

    const dm = await store.sendMessage({
      code: room.code,
      sessionToken: sender.sessionToken,
      channelType: "DM",
      content: "Eyes only rendezvous",
      recipientId: recipient.id,
    });

    const senderComms = await store.getMessages({
      code: room.code,
      sessionToken: sender.sessionToken,
      peerId: recipient.id,
    });
    expect(senderComms.some((m) => m.id === dm.id)).toBe(true);

    const recipientComms = await store.getMessages({
      code: room.code,
      sessionToken: recipient.sessionToken,
      peerId: sender.id,
    });
    expect(recipientComms.some((m) => m.id === dm.id)).toBe(true);

    const spyComms = await store.getMessages({
      code: room.code,
      sessionToken: eavesdropper.sessionToken,
    });
    expect(spyComms.some((m) => m.id === dm.id)).toBe(false);
  });

  it("rejects DM transmissions without valid recipientId", async () => {
    const { room, players } = await setupActiveRoom();
    await expect(
      store.sendMessage({
        code: room.code,
        sessionToken: players[0].sessionToken,
        channelType: "DM",
        content: "Blind DM",
      })
    ).rejects.toThrow();
  });

  it("enforces anti-forensic shredding of 1-on-1 DM history", async () => {
    const { room, players } = await setupActiveRoom();
    const alice = players[0];
    const bob = players[1];

    await store.sendMessage({
      code: room.code,
      sessionToken: alice.sessionToken,
      channelType: "DM",
      content: "Top secret plan",
      recipientId: bob.id,
    });

    await store.sendMessage({
      code: room.code,
      sessionToken: bob.sessionToken,
      channelType: "DM",
      content: "Understood, destroying evidence",
      recipientId: alice.id,
    });

    const burnResult = await store.burnConversation({
      code: room.code,
      sessionToken: alice.sessionToken,
      peerId: bob.id,
    });

    expect(burnResult.success).toBe(true);
    expect(burnResult.count).toBe(2);

    const aliceView = await store.getMessages({
      code: room.code,
      sessionToken: alice.sessionToken,
      peerId: bob.id,
    });
    expect(aliceView.length).toBe(0);

    const bobView = await store.getMessages({
      code: room.code,
      sessionToken: bob.sessionToken,
      peerId: alice.id,
    });
    expect(bobView.length).toBe(2);

    await store.burnConversation({
      code: room.code,
      sessionToken: bob.sessionToken,
      peerId: alice.id,
    });

    const bobViewAfter = await store.getMessages({
      code: room.code,
      sessionToken: bob.sessionToken,
      peerId: alice.id,
    });
    expect(bobViewAfter.length).toBe(0);
  });

  it("rejects shredding with invalid session or non-existent peer", async () => {
    const { room, players } = await setupActiveRoom();
    await expect(
      store.burnConversation({
        code: room.code,
        sessionToken: "invalid-token",
        peerId: players[1].id,
      })
    ).rejects.toThrow();

    const res = await store.burnConversation({
      code: room.code,
      sessionToken: players[0].sessionToken,
      peerId: "fake-peer-id",
    });
    expect(res.success).toBe(true);
    expect(res.count).toBe(0);
  });
});
