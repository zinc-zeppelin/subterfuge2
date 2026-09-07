import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createIsolatedGameStore, cleanupIsolatedStore } from "../helpers/test-store";
import { GameStore } from "@/lib/store/game-store";

describe("Concurrency, Thread-Safety & Mutex Locks (Unit)", () => {
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

  it("handles concurrent joins safely without dropping players or corrupting capacity", async () => {
    const { room } = await store.createRoom({
      hostName: "Host",
      sessionToken: "host-tok",
    });

    // Fire 11 concurrent joins (reaching max capacity 12)
    const joinPromises = Array.from({ length: 11 }, (_, i) =>
      store.joinRoom({
        code: room.code,
        playerName: `ConcurrentOp${i + 1}`,
        sessionToken: `c-tok-${i + 1}`,
      })
    );

    const results = await Promise.all(joinPromises);
    expect(results).toHaveLength(11);

    const finalRoom = await store.getRoom(room.code);
    expect(finalRoom?.players.length).toBe(12);

    // 13th join must be rejected with CAPACITY_REACHED
    await expect(
      store.joinRoom({
        code: room.code,
        playerName: "OverflowOp",
        sessionToken: "overflow-tok",
      })
    ).rejects.toThrow(/CAPACITY_REACHED/);
  });

  it("handles concurrent ready toggles without race condition corruption", async () => {
    const { room, host } = await store.createRoom({
      hostName: "Host",
      sessionToken: "host-tok",
    });

    const join = await store.joinRoom({
      code: room.code,
      playerName: "Agent2",
      sessionToken: "tok-2",
    });

    // Concurrently toggle ready 4 times for the same player
    await Promise.all([
      store.toggleReady(room.code, join.player.id, join.player.sessionToken),
      store.toggleReady(room.code, join.player.id, join.player.sessionToken),
      store.toggleReady(room.code, join.player.id, join.player.sessionToken),
      store.toggleReady(room.code, join.player.id, join.player.sessionToken),
    ]);

    const updatedRoom = await store.getRoom(room.code);
    const p = updatedRoom?.players.find((x) => x.id === join.player.id);
    // 4 toggles from initial false -> false -> true -> false -> true -> false
    expect(p?.isReady).toBe(false);
  });

  it("supports reentrant locking without deadlocks", async () => {
    const res = await store.withLock(async () => {
      // Nested withLock should immediately proceed via storeLockContext
      return await store.withLock(async () => {
        return "reentrant-ok";
      });
    });

    expect(res).toBe("reentrant-ok");
  });
});
