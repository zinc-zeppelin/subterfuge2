import fs from "fs";
import path from "path";

const SESSIONS_DIR = path.resolve(process.cwd(), ".sessions");
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

interface SessionData {
  roomCode: string;
  sessionToken: string;
  playerId: string;
  callsign: string;
  baseUrl: string;
}

function getSessionPath(name: string): string {
  return path.join(SESSIONS_DIR, `${name.toLowerCase()}.json`);
}

function loadSession(name: string): SessionData {
  const p = getSessionPath(name);
  if (!fs.existsSync(p)) {
    throw new Error(`Session '${name}' not found. Create or join a room first.`);
  }
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function saveSession(name: string, data: SessionData) {
  fs.writeFileSync(getSessionPath(name), JSON.stringify(data, null, 2));
}

async function request(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  return { ok: res.ok, status: res.status, json, text };
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
  };

  const sessionName = getArg("--session") || "default";
  const baseUrl = getArg("--url") || process.env.PLAYTEST_BASE_URL || "http://localhost:3000";

  if (!command || command === "--help" || command === "-h") {
    console.log(`
Agent Operative CLI:
  npx tsx scripts/agent-operative.ts create --name <Callsign> [--session <name>] [--url <url>]
  npx tsx scripts/agent-operative.ts join --code <RoomCode> --name <Callsign> [--session <name>]
  npx tsx scripts/agent-operative.ts ready [--session <name>]
  npx tsx scripts/agent-operative.ts start [--session <name>]
  npx tsx scripts/agent-operative.ts state [--session <name>]
  npx tsx scripts/agent-operative.ts messages [--session <name>]
  npx tsx scripts/agent-operative.ts send --channel <PUBLIC|TEAM|DM> --content <text> [--to <id>]
  npx tsx scripts/agent-operative.ts challenge --target <id> [--session <name>]
  npx tsx scripts/agent-operative.ts respond --challenge <id> --action <ACCEPT|DENY>
  npx tsx scripts/agent-operative.ts burn --peer <id> [--session <name>]
  npx tsx scripts/agent-operative.ts warp --to <MIDPOINT|VERDICT> [--session <name>]
  npx tsx scripts/agent-operative.ts propose --word <word> [--session <name>]
  npx tsx scripts/agent-operative.ts vote --id <suggestionId> [--session <name>]
  npx tsx scripts/agent-operative.ts submit --guesses <W1,W2,...> [--mole <id>]
  npx tsx scripts/agent-operative.ts rematch [--session <name>]
  npx tsx scripts/agent-operative.ts audit-leak [--session <name>]
`);
    return;
  }

  if (command === "create") {
    const name = getArg("--name") || "Agent-Alpha";
    const res = await request(`${baseUrl}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostName: name, durationHours: 24 }),
    });
    if (!res.ok) {
      console.error("Create failed:", res.text);
      process.exit(1);
    }
    const { roomCode, hostId, sessionToken } = res.json;
    saveSession(sessionName, {
      roomCode: roomCode,
      sessionToken: sessionToken,
      playerId: hostId,
      callsign: name,
      baseUrl,
    });
    console.log(JSON.stringify({ status: "ROOM_CREATED", roomCode, player: name, session: sessionName }, null, 2));
    return;
  }

  if (command === "join") {
    const code = getArg("--code");
    const name = getArg("--name") || `Agent-${sessionName}`;
    if (!code) throw new Error("--code required");
    const res = await request(`${baseUrl}/api/rooms/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerName: name }),
    });
    if (!res.ok) {
      console.error("Join failed:", res.text);
      process.exit(1);
    }
    const data = res.json;
    saveSession(sessionName, {
      roomCode: code.toUpperCase(),
      sessionToken: data.sessionToken,
      playerId: data.playerId,
      callsign: name,
      baseUrl,
    });
    console.log(JSON.stringify({ status: "JOINED", roomCode: code.toUpperCase(), playerId: data.playerId, session: sessionName }, null, 2));
    return;
  }

  const session = loadSession(sessionName);
  const targetUrl = session.baseUrl || baseUrl;

  if (command === "ready") {
    const res = await request(`${targetUrl}/api/rooms/${session.roomCode}/ready`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": session.sessionToken,
      },
      body: JSON.stringify({ playerId: session.playerId }),
    });
    console.log(JSON.stringify({ status: "READY_TOGGLED", ok: res.ok, result: res.json }, null, 2));
    return;
  }

  if (command === "start") {
    const res = await request(`${targetUrl}/api/rooms/${session.roomCode}/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": session.sessionToken,
      },
    });
    console.log(JSON.stringify({ status: "STARTED", ok: res.ok, result: res.json }, null, 2));
    return;
  }

  if (command === "state") {
    const res = await request(`${targetUrl}/api/rooms/${session.roomCode}/state`, {
      headers: { "x-session-token": session.sessionToken },
    });
    console.log(JSON.stringify(res.json, null, 2));
    return;
  }

  if (command === "messages") {
    const res = await request(`${targetUrl}/api/rooms/${session.roomCode}/messages`, {
      headers: { "x-session-token": session.sessionToken },
    });
    console.log(JSON.stringify(res.json, null, 2));
    return;
  }

  if (command === "send") {
    const channel = getArg("--channel") || "PUBLIC";
    const content = getArg("--content");
    const to = getArg("--to");
    if (!content) throw new Error("--content required");

    let channelType = channel;
    if (channel === "TEAM") {
      const stateRes = await request(`${targetUrl}/api/rooms/${session.roomCode}/state`, {
        headers: { "x-session-token": session.sessionToken },
      });
      const team = stateRes.json?.self?.apparentTeam;
      channelType = team === "RED" ? "TEAM_RED" : "TEAM_BLUE";
    }

    const res = await request(`${targetUrl}/api/rooms/${session.roomCode}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": session.sessionToken,
      },
      body: JSON.stringify({
        content,
        channelType,
        recipientId: to,
      }),
    });
    console.log(JSON.stringify({ status: "MESSAGE_SENT", ok: res.ok, message: res.json }, null, 2));
    return;
  }

  if (command === "challenge") {
    const target = getArg("--target");
    if (!target) throw new Error("--target required");
    const res = await request(`${targetUrl}/api/rooms/${session.roomCode}/mole/challenge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": session.sessionToken,
      },
      body: JSON.stringify({ targetPlayerId: target }),
    });
    if (!res.ok) {
      console.error(JSON.stringify({ status: "CHALLENGE_FAILED", ok: false, error: res.json?.error || res.text }));
      process.exit(1);
    }
    console.log(JSON.stringify({ status: "CHALLENGE_ISSUED", ok: true, result: res.json }, null, 2));
    return;
  }

  if (command === "respond") {
    const challengeId = getArg("--challenge");
    const action = (getArg("--action") || "ACCEPT").toUpperCase();
    if (!challengeId) throw new Error("--challenge required");
    const res = await request(`${targetUrl}/api/rooms/${session.roomCode}/mole/respond`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": session.sessionToken,
      },
      body: JSON.stringify({ challengeId, action }),
    });
    if (!res.ok) {
      console.error(JSON.stringify({ status: "RESPOND_FAILED", ok: false, error: res.json?.error || res.text }));
      process.exit(1);
    }
    console.log(JSON.stringify({ status: "CHALLENGE_RESPONDED", ok: true, result: res.json }, null, 2));
    return;
  }

  if (command === "burn") {
    const peer = getArg("--peer");
    if (!peer) throw new Error("--peer required");
    const res = await request(`${targetUrl}/api/rooms/${session.roomCode}/messages/burn`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": session.sessionToken,
      },
      body: JSON.stringify({ peerId: peer }),
    });
    if (!res.ok) {
      console.error(JSON.stringify({ status: "BURN_FAILED", ok: false, error: res.json?.error || res.text }));
      process.exit(1);
    }
    console.log(JSON.stringify({ status: "BURNED", ok: true, result: res.json }, null, 2));
    return;
  }

  if (command === "warp") {
    const to = (getArg("--to") || "MIDPOINT").toUpperCase();
    const res = await request(`${targetUrl}/api/rooms/${session.roomCode}/timer/warp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": session.sessionToken,
      },
      body: JSON.stringify({ target: to }),
    });
    if (!res.ok) {
      console.error(JSON.stringify({ status: "WARP_FAILED", ok: false, error: res.json?.error || res.text }));
      process.exit(1);
    }
    console.log(JSON.stringify({ status: "TIMER_WARPED", ok: true, result: res.json }, null, 2));
    return;
  }

  if (command === "propose") {
    const word = getArg("--word");
    if (!word) throw new Error("--word required");
    const res = await request(`${targetUrl}/api/rooms/${session.roomCode}/verdict/suggest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": session.sessionToken,
      },
      body: JSON.stringify({ word }),
    });
    if (!res.ok) {
      console.error(JSON.stringify({ status: "PROPOSE_FAILED", ok: false, error: res.json?.error || res.text }));
      process.exit(1);
    }
    console.log(JSON.stringify({ status: "WORD_PROPOSED", ok: true, result: res.json }, null, 2));
    return;
  }

  if (command === "vote") {
    const id = getArg("--id");
    if (!id) throw new Error("--id required");
    const res = await request(`${targetUrl}/api/rooms/${session.roomCode}/verdict/vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": session.sessionToken,
      },
      body: JSON.stringify({ suggestionId: id }),
    });
    if (!res.ok) {
      console.error(JSON.stringify({ status: "VOTE_FAILED", ok: false, error: res.json?.error || res.text }));
      process.exit(1);
    }
    console.log(JSON.stringify({ status: "VOTED", ok: true, result: res.json }, null, 2));
    return;
  }

  if (command === "submit") {
    const guessesStr = getArg("--guesses");
    const mole = getArg("--mole");
    if (!guessesStr) throw new Error("--guesses required (comma-separated)");
    const guesses = guessesStr.split(",").map((g) => g.trim().toUpperCase());
    const res = await request(`${targetUrl}/api/rooms/${session.roomCode}/verdict/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": session.sessionToken,
      },
      body: JSON.stringify({ guesses, moleIndictmentId: mole }),
    });
    if (!res.ok) {
      console.error(JSON.stringify({ status: "SUBMIT_FAILED", ok: false, error: res.json?.error || res.text }));
      process.exit(1);
    }
    console.log(JSON.stringify({ status: "VERDICT_SUBMITTED", ok: true, result: res.json }, null, 2));
    return;
  }

  if (command === "rematch") {
    const res = await request(`${targetUrl}/api/rooms/${session.roomCode}/rematch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": session.sessionToken,
      },
    });
    if (!res.ok) {
      console.error(JSON.stringify({ status: "REMATCH_FAILED", ok: false, error: res.json?.error || res.text }));
      process.exit(1);
    }
    console.log(JSON.stringify({ status: "REMATCH", ok: true, result: res.json }, null, 2));
    return;
  }

  if (command === "audit-leak") {
    const res = await request(`${targetUrl}/api/rooms/${session.roomCode}/state`, {
      headers: { "x-session-token": session.sessionToken },
    });
    const state = res.json;
    const phase = state.room.phase;
    const selfId = state.self.id;
    const leaks: string[] = [];

    // During INFILTRATION or VERDICT:
    if (phase === "INFILTRATION" || phase === "VERDICT") {
      // 1. Check if master codebook is leaked
      if (state.codebook) {
        leaks.push("LEAK: Master codebook is present before DEBRIEF!");
      }
      // 2. Check if selectedTheme leaked before midpoint
      if (!state.room.declassifiedTheme && state.selectedTheme) {
        leaks.push("LEAK: Secret theme leaked before 50% midpoint declassification!");
      }
      // 3. Check if other players' words, roles, or actualTeams leaked
      for (const p of state.players) {
        if (p.id !== selfId) {
          if (p.assignedWord) leaks.push(`LEAK: Assigned word of ${p.displayName} leaked! (${p.assignedWord})`);
          if (p.role) leaks.push(`LEAK: Role of ${p.displayName} leaked! (${p.role})`);
          if (p.actualTeam) leaks.push(`LEAK: Actual team of ${p.displayName} leaked! (${p.actualTeam})`);
          if (p.sessionToken) leaks.push(`LEAK: Session token of ${p.displayName} leaked!`);
        }
      }
    }

    console.log(JSON.stringify({
      status: "SECURITY_AUDIT",
      operative: session.callsign,
      phase,
      leaksFound: leaks.length,
      leaks,
      verdict: leaks.length === 0 ? "SECURE_PASS" : "SECURITY_FAIL",
    }, null, 2));
    return;
  }

  console.error("Unknown command:", command);
  process.exit(1);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
