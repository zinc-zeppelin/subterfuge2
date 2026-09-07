import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as createRoomHandler } from "@/app/api/rooms/route";
import { POST as joinRoomHandler } from "@/app/api/rooms/[code]/join/route";
import { POST as readyHandler } from "@/app/api/rooms/[code]/ready/route";
import { POST as startHandler } from "@/app/api/rooms/[code]/start/route";
import { GET as stateHandler } from "@/app/api/rooms/[code]/state/route";
import { POST as burnBriefingHandler } from "@/app/api/rooms/[code]/briefing/burn/route";
import { GET as getMessagesHandler, POST as postMessageHandler } from "@/app/api/rooms/[code]/messages/route";
import { POST as burnMessagesHandler } from "@/app/api/rooms/[code]/messages/burn/route";
import { POST as challengeHandler } from "@/app/api/rooms/[code]/mole/challenge/route";
import { POST as respondChallengeHandler } from "@/app/api/rooms/[code]/mole/respond/route";
import { GET as getVerificationsHandler } from "@/app/api/rooms/[code]/mole/verifications/route";
import { POST as warpTimerHandler } from "@/app/api/rooms/[code]/timer/warp/route";
import { POST as suggestHandler } from "@/app/api/rooms/[code]/verdict/suggest/route";
import { POST as voteHandler } from "@/app/api/rooms/[code]/verdict/vote/route";
import { POST as adoptHandler } from "@/app/api/rooms/[code]/verdict/adopt/route";
import { POST as removeHandler } from "@/app/api/rooms/[code]/verdict/remove/route";
import { POST as indictHandler } from "@/app/api/rooms/[code]/verdict/indict/route";
import { POST as submitVerdictHandler } from "@/app/api/rooms/[code]/verdict/submit/route";
import { POST as rematchHandler } from "@/app/api/rooms/[code]/rematch/route";
import { POST as leaveHandler } from "@/app/api/rooms/[code]/leave/route";
import { POST as kickHandler } from "@/app/api/rooms/[code]/kick/route";
import { gameStore } from "@/lib/store/game-store";

describe("API Route HTTP Contracts & Input Validation (Unit)", () => {
  beforeEach(async () => {
    await gameStore.reset();
  });

  async function setupActiveRoom() {
    const { room, host } = await gameStore.createRoom({
      hostName: "Host",
      sessionToken: "host-tok",
    });

    const tokens = ["host-tok"];
    for (let i = 1; i < 6; i++) {
      const res = await gameStore.joinRoom({
        code: room.code,
        playerName: `Op${i}`,
        sessionToken: `tok-${i}`,
      });
      tokens.push(`tok-${i}`);
    }

    for (const p of (await gameStore.getRoom(room.code))!.players) {
      await gameStore.toggleReady(room.code, p.id, p.sessionToken);
    }

    const started = await gameStore.startOperation(room.code, host.sessionToken);
    return { code: room.code, host, tokens, room: started };
  }

  describe("POST /api/rooms", () => {
    it("rejects empty operative callsign with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/rooms", {
        method: "POST",
        body: JSON.stringify({ hostName: "" }),
      });
      const res = await createRoomHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/call-sign is required/i);
    });

    it("rejects callsigns longer than 20 characters with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/rooms", {
        method: "POST",
        body: JSON.stringify({ hostName: "A".repeat(25) }),
      });
      const res = await createRoomHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/exceed 20 characters/i);
    });

    it("creates room with valid parameters and sets session cookie", async () => {
      const req = new NextRequest("http://localhost:3000/api/rooms", {
        method: "POST",
        body: JSON.stringify({ hostName: "Commander" }),
      });
      const res = await createRoomHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.roomCode).toBeDefined();
      expect(data.sessionToken).toBeDefined();
      expect(res.cookies.get("subterfuge_session")?.value).toBe(data.sessionToken);
    });
  });

  describe("POST /api/rooms/[code]/join", () => {
    it("rejects invalid room code with 404", async () => {
      const req = new NextRequest("http://localhost:3000/api/rooms/ZZZZZZ/join", {
        method: "POST",
        body: JSON.stringify({ playerName: "Agent-X" }),
      });
      const res = await joinRoomHandler(req, { params: { code: "ZZZZZZ" } });
      expect(res.status).toBe(404);
    });

    it("rejects duplicate callsign in active lobby with 409", async () => {
      const { room } = await gameStore.createRoom({
        hostName: "Falcon",
        sessionToken: "host-tok",
      });

      const req = new NextRequest(`http://localhost:3000/api/rooms/${room.code}/join`, {
        method: "POST",
        body: JSON.stringify({ playerName: "Falcon" }),
      });
      const res = await joinRoomHandler(req, { params: { code: room.code } });
      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/rooms/[code]/ready", () => {
    it("rejects unauthenticated ready requests with 401", async () => {
      const { room } = await gameStore.createRoom({
        hostName: "Falcon",
        sessionToken: "host-tok",
      });

      const req = new NextRequest(`http://localhost:3000/api/rooms/${room.code}/ready`, {
        method: "POST",
      });
      const res = await readyHandler(req, { params: { code: room.code } });
      expect(res.status).toBe(401);
    });

    it("successfully toggles operative ready status with valid token", async () => {
      const { room } = await gameStore.createRoom({
        hostName: "Falcon",
        sessionToken: "host-tok",
      });

      const req = new NextRequest(`http://localhost:3000/api/rooms/${room.code}/ready`, {
        method: "POST",
        headers: { "x-session-token": "host-tok" },
      });
      const res = await readyHandler(req, { params: { code: room.code } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.isReady).toBe(true);
    });
  });

  describe("POST /api/rooms/[code]/start", () => {
    it("rejects unauthenticated start request with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/rooms/TESTCD/start", {
        method: "POST",
      });
      const res = await startHandler(req, { params: { code: "TESTCD" } });
      expect(res.status).toBe(401);
    });

    it("rejects start request from non-host with 403", async () => {
      const { room } = await gameStore.createRoom({
        hostName: "Host",
        sessionToken: "host-tok",
      });
      await gameStore.joinRoom({
        code: room.code,
        playerName: "Op1",
        sessionToken: "op1-tok",
      });

      const req = new NextRequest(`http://localhost:3000/api/rooms/${room.code}/start`, {
        method: "POST",
        headers: { "x-session-token": "op1-tok" },
      });
      const res = await startHandler(req, { params: { code: room.code } });
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/rooms/[code]/state", () => {
    it("returns public room metadata with 401 when unauthenticated", async () => {
      const { room } = await gameStore.createRoom({
        hostName: "Host",
        sessionToken: "host-tok",
      });

      const req = new NextRequest(`http://localhost:3000/api/rooms/${room.code}/state`, {
        method: "GET",
      });
      const res = await stateHandler(req, { params: { code: room.code } });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toMatch(/NO_SESSION/);
      expect(data.phase).toBe("LOBBY");
    });

    it("returns sanitized client state for authenticated operative", async () => {
      const { code, tokens } = await setupActiveRoom();

      const req = new NextRequest(`http://localhost:3000/api/rooms/${code}/state`, {
        method: "GET",
        headers: { "x-session-token": tokens[0] },
      });
      const res = await stateHandler(req, { params: { code } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.self.displayName).toBe("Host");
      expect(data.self.assignedWord).toBeDefined();
    });
  });

  describe("POST /api/rooms/[code]/briefing/burn", () => {
    it("rejects briefing burn if codeword does not match authentic assignment", async () => {
      const { code, tokens } = await setupActiveRoom();

      const req = new NextRequest(`http://localhost:3000/api/rooms/${code}/briefing/burn`, {
        method: "POST",
        headers: { "x-session-token": tokens[0] },
        body: JSON.stringify({ codeword: "WRONGWORD" }),
      });
      const res = await burnBriefingHandler(req, { params: { code } });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/INVALID_CODEWORD/);
    });
  });

  describe("Messages & Comms API (/messages, /messages/burn)", () => {
    it("allows sending and receiving public transmissions", async () => {
      const { code, tokens } = await setupActiveRoom();

      const postReq = new NextRequest(`http://localhost:3000/api/rooms/${code}/messages`, {
        method: "POST",
        headers: { "x-session-token": tokens[0] },
        body: JSON.stringify({
          channelType: "PUBLIC",
          content: "Testing wire broadcast",
        }),
      });
      const postRes = await postMessageHandler(postReq, { params: { code } });
      expect(postRes.status).toBe(200);

      const getReq = new NextRequest(`http://localhost:3000/api/rooms/${code}/messages?channelType=PUBLIC`, {
        method: "GET",
        headers: { "x-session-token": tokens[1] },
      });
      const getRes = await getMessagesHandler(getReq, { params: { code } });
      expect(getRes.status).toBe(200);
      const data = await getRes.json();
      expect(data.messages.some((m: any) => m.content === "Testing wire broadcast")).toBe(true);
    });

    it("burns DM conversation history between two operatives", async () => {
      const { code, tokens, room } = await setupActiveRoom();
      const op0 = room.players[0];
      const op1 = room.players[1];

      // Send DM
      await postMessageHandler(
        new NextRequest(`http://localhost:3000/api/rooms/${code}/messages`, {
          method: "POST",
          headers: { "x-session-token": tokens[0] },
          body: JSON.stringify({
            channelType: "DM",
            content: "Secret rendezvous",
            recipientId: op1.id,
          }),
        }),
        { params: { code } }
      );

      // Burn DM
      const burnReq = new NextRequest(`http://localhost:3000/api/rooms/${code}/messages/burn`, {
        method: "POST",
        headers: { "x-session-token": tokens[0] },
        body: JSON.stringify({ peerId: op1.id }),
      });
      const burnRes = await burnMessagesHandler(burnReq, { params: { code } });
      expect(burnRes.status).toBe(200);
      const data = await burnRes.json();
      expect(data.success).toBe(true);
    });
  });

  describe("Mole Protocol API (/mole/challenge, /mole/respond, /mole/verifications)", () => {
    it("prohibits same-squad challenges and handles opposing challenges", async () => {
      const { code, room } = await setupActiveRoom();
      const redOps = room.players.filter((p) => p.apparentTeam === "RED");
      const blueOps = room.players.filter((p) => p.apparentTeam === "BLUE");

      // Same squad challenge -> 400
      const sameReq = new NextRequest(`http://localhost:3000/api/rooms/${code}/mole/challenge`, {
        method: "POST",
        headers: { "x-session-token": redOps[0].sessionToken },
        body: JSON.stringify({ targetPlayerId: redOps[1].id }),
      });
      const sameRes = await challengeHandler(sameReq, { params: { code } });
      expect(sameRes.status).toBe(400);

      // Opposing squad challenge -> 200
      const oppReq = new NextRequest(`http://localhost:3000/api/rooms/${code}/mole/challenge`, {
        method: "POST",
        headers: { "x-session-token": redOps[0].sessionToken },
        body: JSON.stringify({ targetPlayerId: blueOps[0].id }),
      });
      const oppRes = await challengeHandler(oppReq, { params: { code } });
      expect(oppRes.status).toBe(200);
      const oppData = await oppRes.json();
      expect(oppData.challenge.status).toBe("PENDING");

      // Respond to challenge
      const respReq = new NextRequest(`http://localhost:3000/api/rooms/${code}/mole/respond`, {
        method: "POST",
        headers: { "x-session-token": blueOps[0].sessionToken },
        body: JSON.stringify({ challengeId: oppData.challenge.id, action: "DENY" }),
      });
      const respRes = await respondChallengeHandler(respReq, { params: { code } });
      expect(respRes.status).toBe(200);

      // Fetch verifications
      const verifReq = new NextRequest(`http://localhost:3000/api/rooms/${code}/mole/verifications`, {
        method: "GET",
        headers: { "x-session-token": redOps[0].sessionToken },
      });
      const verifRes = await getVerificationsHandler(verifReq, { params: { code } });
      expect(verifRes.status).toBe(200);
    });
  });

  describe("Timer Warp API (/timer/warp)", () => {
    it("warps room phase to VERDICT", async () => {
      const { code } = await setupActiveRoom();

      const req = new NextRequest(`http://localhost:3000/api/rooms/${code}/timer/warp`, {
        method: "POST",
        headers: { "x-subterfuge-dev": "true" },
        body: JSON.stringify({ target: "VERDICT" }),
      });
      const res = await warpTimerHandler(req, { params: { code } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.phase).toBe("VERDICT");
    });
  });

  describe("Verdict Deliberation & Consensus API", () => {
    it("handles suggest, vote, adopt, and remove operations in VERDICT phase", async () => {
      const { code, room } = await setupActiveRoom();
      await gameStore.warpTimer({ code, target: "VERDICT" });

      const redOp = room.players.find((p) => p.apparentTeam === "RED")!;

      // 1. Suggest word
      const suggestReq = new NextRequest(`http://localhost:3000/api/rooms/${code}/verdict/suggest`, {
        method: "POST",
        headers: { "x-session-token": redOp.sessionToken },
        body: JSON.stringify({ word: "BALLET" }),
      });
      const suggestRes = await suggestHandler(suggestReq, { params: { code } });
      expect(suggestRes.status).toBe(200);
      const suggestData = await suggestRes.json();
      expect(suggestData.suggestion.word).toBe("BALLET");

      // 2. Vote for word
      const voteReq = new NextRequest(`http://localhost:3000/api/rooms/${code}/verdict/vote`, {
        method: "POST",
        headers: { "x-session-token": redOp.sessionToken },
        body: JSON.stringify({ suggestionId: suggestData.suggestion.id }),
      });
      const voteRes = await voteHandler(voteReq, { params: { code } });
      expect(voteRes.status).toBe(200);

      // 3. Adopt word
      const adoptReq = new NextRequest(`http://localhost:3000/api/rooms/${code}/verdict/adopt`, {
        method: "POST",
        headers: { "x-session-token": redOp.sessionToken },
        body: JSON.stringify({ word: "BALLET" }),
      });
      const adoptRes = await adoptHandler(adoptReq, { params: { code } });
      expect(adoptRes.status).toBe(200);

      // 4. Remove word
      const removeReq = new NextRequest(`http://localhost:3000/api/rooms/${code}/verdict/remove`, {
        method: "POST",
        headers: { "x-session-token": redOp.sessionToken },
        body: JSON.stringify({ word: "BALLET" }),
      });
      const removeRes = await removeHandler(removeReq, { params: { code } });
      expect(removeRes.status).toBe(200);
    });

    it("rejects invalid non-string moleIndictmentId with 400", async () => {
      const { code, room } = await setupActiveRoom();
      await gameStore.warpTimer({ code, target: "VERDICT" });

      const req = new NextRequest(`http://localhost:3000/api/rooms/${code}/verdict/indict`, {
        method: "POST",
        headers: { "x-session-token": room.players[0].sessionToken },
        body: JSON.stringify({ moleIndictmentId: 12345 }),
      });
      const res = await indictHandler(req, { params: { code } });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/INVALID_INDICTMENT/i);
    });
  });

  describe("POST /api/rooms/[code]/kick", () => {
    it("rejects non-host attempts to dismiss operatives with 403", async () => {
      const { room } = await gameStore.createRoom({
        hostName: "Host",
        sessionToken: "host-tok",
      });
      const { player } = await gameStore.joinRoom({
        code: room.code,
        playerName: "Op1",
        sessionToken: "op1-tok",
      });

      const req = new NextRequest(`http://localhost:3000/api/rooms/${room.code}/kick`, {
        method: "POST",
        headers: { "x-session-token": "op1-tok" },
        body: JSON.stringify({ targetPlayerId: player.id }),
      });
      const res = await kickHandler(req, { params: { code: room.code } });
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/rooms/[code]/leave", () => {
    it("allows an operative to leave an active lobby", async () => {
      const { room } = await gameStore.createRoom({
        hostName: "Host",
        sessionToken: "host-tok",
      });
      await gameStore.joinRoom({
        code: room.code,
        playerName: "Op1",
        sessionToken: "op1-tok",
      });

      const req = new NextRequest(`http://localhost:3000/api/rooms/${room.code}/leave`, {
        method: "POST",
        headers: { "x-session-token": "op1-tok" },
      });
      const res = await leaveHandler(req, { params: { code: room.code } });
      expect(res.status).toBe(200);

      const updated = await gameStore.getRoom(room.code);
      expect(updated?.players.some((p) => p.displayName === "Op1")).toBe(false);
    });
  });

  describe("POST /api/rooms/[code]/rematch", () => {
    it("rejects unauthenticated rematch authorization with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/rooms/TESTCD/rematch", {
        method: "POST",
      });
      const res = await rematchHandler(req, { params: { code: "TESTCD" } });
      expect(res.status).toBe(401);
    });

    it("resets operation back to lobby when authorized by commander", async () => {
      const { code, host } = await setupActiveRoom();
      await gameStore.warpTimer({ code, target: "DEBRIEF" });

      const req = new NextRequest(`http://localhost:3000/api/rooms/${code}/rematch`, {
        method: "POST",
        headers: { "x-session-token": host.sessionToken },
      });
      const res = await rematchHandler(req, { params: { code } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const refreshed = await gameStore.getRoom(code);
      expect(refreshed?.phase).toBe("LOBBY");
    });
  });

  describe("POST /api/rooms/[code]/verdict/submit", () => {
    it("rejects unauthenticated verdict submissions with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/rooms/TESTCD/verdict/submit", {
        method: "POST",
        body: JSON.stringify({ guesses: ["W1", "W2", "W3", "W4", "W5", "W6"] }),
      });
      const res = await submitVerdictHandler(req, { params: { code: "TESTCD" } });
      expect(res.status).toBe(401);
    });

    it("rejects non-array guesses with 400", async () => {
      const { code, tokens } = await setupActiveRoom();
      await gameStore.warpTimer({ code, target: "VERDICT" });

      const req = new NextRequest(`http://localhost:3000/api/rooms/${code}/verdict/submit`, {
        method: "POST",
        headers: { "x-session-token": tokens[0] },
        body: JSON.stringify({ guesses: "not-an-array" }),
      });
      const res = await submitVerdictHandler(req, { params: { code } });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/must be an array/i);
    });

    it("handles proposing and confirming team verdict", async () => {
      const { code, room } = await setupActiveRoom();
      await gameStore.warpTimer({ code, target: "VERDICT" });

      const redOps = room.players.filter((p) => p.apparentTeam === "RED");
      const sixWords = ["W1", "W2", "W3", "W4", "W5", "W6"];

      // First teammate proposes verdict
      const propReq = new NextRequest(`http://localhost:3000/api/rooms/${code}/verdict/submit`, {
        method: "POST",
        headers: { "x-session-token": redOps[0].sessionToken },
        body: JSON.stringify({ guesses: sixWords }),
      });
      const propRes = await submitVerdictHandler(propReq, { params: { code } });
      expect(propRes.status).toBe(200);
      const propData = await propRes.json();
      expect(propData.locked).toBe(false);
      expect(propData.confirmedCount).toBe(1);

      // Second teammate confirms
      const confReq = new NextRequest(`http://localhost:3000/api/rooms/${code}/verdict/submit`, {
        method: "POST",
        headers: { "x-session-token": redOps[1].sessionToken },
        body: JSON.stringify({ confirmOnly: true }),
      });
      const confRes = await submitVerdictHandler(confReq, { params: { code } });
      expect(confRes.status).toBe(200);
      const confData = await confRes.json();
      expect(confData.locked).toBe(true);
      expect(confData.verdict).toBeDefined();
    });
  });
});
