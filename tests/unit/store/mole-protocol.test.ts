import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createIsolatedGameStore, cleanupIsolatedStore } from "../helpers/test-store";
import { GameStore } from "@/lib/store/game-store";

describe("Mole Clearance Protocol (Unit)", () => {
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

  async function setupActiveRoomWithKnownMole() {
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

    const moles = started.players.filter((p) => p.role === "MOLE");
    const agents = started.players.filter((p) => p.role === "AGENT");

    return { room: started, players: started.players, moles, agents };
  }

  it("prohibits same-faction clearance challenges", async () => {
    const { room, players } = await setupActiveRoomWithKnownMole();

    const redOps = players.filter((p) => p.apparentTeam === "RED");
    expect(redOps.length).toBeGreaterThanOrEqual(2);

    const requester = redOps[0];
    const target = redOps[1];

    await expect(
      store.initiateMoleChallenge({
        code: room.code,
        sessionToken: requester.sessionToken,
        targetPlayerId: target.id,
      })
    ).rejects.toThrow(/opposing factions/);
  });

  it("permits opposing-cover clearance challenges and records pending challenge", async () => {
    const { room, players } = await setupActiveRoomWithKnownMole();

    const redOp = players.find((p) => p.apparentTeam === "RED")!;
    const blueOp = players.find((p) => p.apparentTeam === "BLUE")!;

    const challenge = await store.initiateMoleChallenge({
      code: room.code,
      sessionToken: redOp.sessionToken,
      targetPlayerId: blueOp.id,
    });

    expect(challenge.requesterId).toBe(redOp.id);
    expect(challenge.targetId).toBe(blueOp.id);
    expect(challenge.status).toBe("PENDING");

    // Target operative sees incoming challenge
    const targetState = await store.getClientGameState(room.code, blueOp.sessionToken);
    expect(targetState.incomingChallenges.some((c) => c.id === challenge.id)).toBe(true);

    // Requester operative sees challengeStatus as PENDING
    const requesterState = await store.getClientGameState(room.code, redOp.sessionToken);
    expect(requesterState.challengeStatuses[blueOp.id]).toBe("PENDING");
  });

  it("verifies genuine mole when challenge is ACCEPTED by the mole", async () => {
    const { room, moles, players } = await setupActiveRoomWithKnownMole();
    const mole = moles[0];

    const opposingCoverOp = players.find(
      (p) => p.actualTeam === mole.actualTeam && p.role === "AGENT"
    )!;

    const challenge = await store.initiateMoleChallenge({
      code: room.code,
      sessionToken: opposingCoverOp.sessionToken,
      targetPlayerId: mole.id,
    });

    const response = await store.respondMoleChallenge({
      code: room.code,
      sessionToken: mole.sessionToken,
      challengeId: challenge.id,
      action: "ACCEPT",
    });

    expect(response.success).toBe(true);
    expect(response.isMole).toBe(true);

    const verifications = await store.getMoleVerifications(room.code, opposingCoverOp.sessionToken);
    expect(verifications.some((v) => v.moleId === mole.id)).toBe(true);

    const requesterState = await store.getClientGameState(room.code, opposingCoverOp.sessionToken);
    expect(requesterState.verifiedAssets).toContain(mole.id);
    expect(requesterState.challengeStatuses[mole.id]).toBe("ACCEPTED");
  });

  it("denies verification when challenge is DENIED or target is loyal AGENT", async () => {
    const { room, agents, players } = await setupActiveRoomWithKnownMole();
    const agent = agents[0];

    const opposingCoverOp = players.find((p) => p.apparentTeam !== agent.apparentTeam)!;

    const challenge = await store.initiateMoleChallenge({
      code: room.code,
      sessionToken: opposingCoverOp.sessionToken,
      targetPlayerId: agent.id,
    });

    const response = await store.respondMoleChallenge({
      code: room.code,
      sessionToken: agent.sessionToken,
      challengeId: challenge.id,
      action: "ACCEPT",
    });

    expect(response.isMole).toBe(false);

    const requesterState = await store.getClientGameState(room.code, opposingCoverOp.sessionToken);
    expect(requesterState.verifiedAssets).not.toContain(agent.id);
    expect(requesterState.challengeStatuses[agent.id]).toBe("DENIED");
  });

  it("prevents third-party operatives from accessing another operative's verified assets", async () => {
    const { room, moles, players } = await setupActiveRoomWithKnownMole();
    const mole = moles[0];
    const challenger = players.find(
      (p) => p.actualTeam === mole.actualTeam && p.role === "AGENT"
    )!;
    const thirdParty = players.find((p) => p.id !== challenger.id && p.id !== mole.id)!;

    const challenge = await store.initiateMoleChallenge({
      code: room.code,
      sessionToken: challenger.sessionToken,
      targetPlayerId: mole.id,
    });

    await store.respondMoleChallenge({
      code: room.code,
      sessionToken: mole.sessionToken,
      challengeId: challenge.id,
      action: "ACCEPT",
    });

    const challengerState = await store.getClientGameState(room.code, challenger.sessionToken);
    expect(challengerState.verifiedAssets).toContain(mole.id);

    const thirdPartyState = await store.getClientGameState(room.code, thirdParty.sessionToken);
    expect(thirdPartyState.verifiedAssets).not.toContain(mole.id);
  });
});
