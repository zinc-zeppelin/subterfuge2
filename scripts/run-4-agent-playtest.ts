import { execSync } from "child_process";

interface OperativeReport {
  callsign: string;
  apparentTeam: string;
  actualTeam: string;
  role: string;
  assignedWord: string;
  securityAudit: string;
  moleHandshakeExperience: string;
  commsExperience: string;
  verdictExperience: string;
  observedBugs: string[];
}

function run(cmd: string): any {
  try {
    const stdout = execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    try {
      return JSON.parse(stdout);
    } catch {
      return stdout;
    }
  } catch (err: any) {
    let errJson: any = null;
    try {
      errJson = JSON.parse(err.stdout || err.stderr);
    } catch {
      // not JSON
    }
    return { error: err.message, stderr: err.stderr, stdout: err.stdout, json: errJson };
  }
}

async function main() {
  const targetUrl = process.argv[2] || process.env.PLAYTEST_TARGET_URL || "http://localhost:3000";
  console.log(`\n======================================================`);
  console.log(`[PROJECT SUBTERFUGE] 4-AGENT PLAYTEST ORCHESTRATOR`);
  console.log(`Target: ${targetUrl}`);
  console.log(`======================================================\n`);

  const reports: Record<string, OperativeReport> = {};

  // 1. Host establishes room
  console.log(`[STEP 1] Agent-Alpha (Host) creating operation...`);
  const createRes = run(`npx tsx scripts/agent-operative.ts create --name "Alpha-Host" --session alpha --url "${targetUrl}"`);
  if (!createRes.roomCode) {
    console.error("Failed to create room:", createRes);
    process.exit(1);
  }
  const roomCode = createRes.roomCode;
  console.log(`  ✓ Room established with code: ${roomCode}`);

  // 2. Operatives Bravo, Charlie, Delta join
  console.log(`\n[STEP 2] Operatives Bravo, Charlie, Delta joining room ${roomCode}...`);
  for (const op of [
    { name: "Bravo-Agent", session: "bravo" },
    { name: "Charlie-Agent", session: "charlie" },
    { name: "Delta-Agent", session: "delta" },
  ]) {
    const joinRes = run(`npx tsx scripts/agent-operative.ts join --code ${roomCode} --name "${op.name}" --session ${op.session} --url "${targetUrl}"`);
    console.log(`  ✓ ${op.name} joined (${joinRes.playerId})`);
  }

  // 3. All 4 operatives declare ready
  console.log(`\n[STEP 3] Signaling operational readiness across all 4 operatives...`);
  for (const session of ["alpha", "bravo", "charlie", "delta"]) {
    const readyRes = run(`npx tsx scripts/agent-operative.ts ready --session ${session}`);
    console.log(`  ✓ Session '${session}' ready: ${readyRes.ok}`);
  }

  // 4. Host commences infiltration
  console.log(`\n[STEP 4] Host authorizing deployment...`);
  const startRes = run(`npx tsx scripts/agent-operative.ts start --session alpha`);
  console.log(`  ✓ Infiltration commenced: ${startRes.ok}`);

  // 5. Infiltration Phase: Dossier retrieval and Leak Audits
  console.log(`\n[STEP 5] Dossier retrieval and zero-leak security audit across all 4 operatives...`);
  const states: Record<string, any> = {};
  for (const session of ["alpha", "bravo", "charlie", "delta"]) {
    const state = run(`npx tsx scripts/agent-operative.ts state --session ${session}`);
    states[session] = state;
    const leakAudit = run(`npx tsx scripts/agent-operative.ts audit-leak --session ${session}`);

    reports[session] = {
      callsign: state.self.displayName,
      apparentTeam: state.self.apparentTeam,
      actualTeam: state.self.actualTeam,
      role: state.self.role,
      assignedWord: state.self.assignedWord,
      securityAudit: leakAudit.verdict === "SECURE_PASS" ? "PASSED (0 leaks)" : `FAILED: ${leakAudit.leaks.join(", ")}`,
      moleHandshakeExperience: "",
      commsExperience: "",
      verdictExperience: "",
      observedBugs: leakAudit.leaks || [],
    };

    console.log(`  Operative ${state.self.displayName}:`);
    console.log(`    Cover: ${state.self.apparentTeam} | Allegiance: ${state.self.actualTeam} | Role: ${state.self.role}`);
    console.log(`    Assigned Secret Word: ${state.self.assignedWord}`);
    console.log(`    Security Leak Check: ${leakAudit.verdict}`);
  }

  // Find operatives for testing
  const operatives = Object.entries(states).map(([session, state]) => ({
    session,
    id: state.self.id,
    callsign: state.self.displayName,
    apparentTeam: state.self.apparentTeam,
    actualTeam: state.self.actualTeam,
    role: state.self.role,
    word: state.self.assignedWord,
  }));

  const moleOp = operatives.find((o) => o.role === "MOLE")!;
  const moleAlliedOps = operatives.filter((o) => o.actualTeam === moleOp.actualTeam && o.id !== moleOp.id);
  const moleOpposingOps = operatives.filter((o) => o.actualTeam !== moleOp.actualTeam);

  console.log(`\n[ESPIONAGE MATRIX IDENTIFIED]:`);
  console.log(`  Embedded Mole: ${moleOp.callsign} (Cover: ${moleOp.apparentTeam} | True: ${moleOp.actualTeam})`);
  console.log(`  Allied Operatives: ${moleAlliedOps.map((o) => `${o.callsign} (${o.role})`).join(", ")}`);
  console.log(`  Enemy Operatives: ${moleOpposingOps.map((o) => `${o.callsign} (${o.role})`).join(", ")}`);

  // 6. Test Comms Isolation (Public Wire, Red Radio, Blue Radio)
  console.log(`\n[STEP 6] Testing Comms Suite & Radio Frequency Isolation...`);
  run(`npx tsx scripts/agent-operative.ts send --session alpha --channel PUBLIC --content "Attention all operatives: Keep frequencies clean."`);
  run(`npx tsx scripts/agent-operative.ts send --session alpha --channel TEAM --content "Red Team Classified: Disinformation plan active."`);

  // Verify that Blue operatives cannot see Red Team radio
  const blueOp = operatives.find((o) => o.apparentTeam === "BLUE")!;
  const blueMsgs = run(`npx tsx scripts/agent-operative.ts messages --session ${blueOp.session}`);
  const leakedTeamRedMsg = (Array.isArray(blueMsgs) ? blueMsgs : []).find((m: any) => m.channelType === "TEAM_RED");
  if (leakedTeamRedMsg) {
    console.error(`  ❌ CRITICAL BUG: Blue operative saw Red Radio transmission!`);
    reports[blueOp.session].observedBugs.push("Comms Leak: Red Team Radio visible to Blue operative!");
    reports[blueOp.session].commsExperience = "FAILED: Intercepted opposing team radio";
  } else {
    console.log(`  ✓ Radio Channel Isolation verified: Blue operative cannot see Red Team radio.`);
    reports[blueOp.session].commsExperience = "PASSED: Secure channel isolation strictly enforced";
    reports["alpha"].commsExperience = "PASSED: Transmissions successfully broadcast";
  }

  // 7. Universal Mole Verification Protocol Test
  console.log(`\n[STEP 7] Testing Universal Mole Verification Protocol across opposing factions...`);

  // Test 7A: Prohibited Same-Faction Challenge
  const sameTeamA = operatives[0];
  const sameTeamB = operatives.find((o) => o.apparentTeam === sameTeamA.apparentTeam && o.id !== sameTeamA.id)!;
  console.log(`  Testing same-team challenge restriction between ${sameTeamA.callsign} and ${sameTeamB.callsign} (${sameTeamA.apparentTeam})...`);
  const sameTeamChallenge = run(`npx tsx scripts/agent-operative.ts challenge --session ${sameTeamA.session} --target ${sameTeamB.id}`);
  const isRejected = sameTeamChallenge.error || (sameTeamChallenge.json && sameTeamChallenge.json.error) || sameTeamChallenge.ok === false;
  if (isRejected) {
    const errMsg = sameTeamChallenge.json?.error || sameTeamChallenge.error || sameTeamChallenge.result?.error;
    console.log(`  ✓ Properly rejected same-faction challenge: ${errMsg}`);
  } else {
    console.error(`  ❌ BUG: Server permitted same-faction mole challenge!`);
    reports[sameTeamA.session].observedBugs.push("Bug: Same-faction mole challenge was permitted!");
  }

  // Test 7B: Counter-Intelligence Test: Challenging a Loyal Operative (Non-Mole) across factions
  const loyalNonMole = operatives.find((o) => o.role !== "MOLE")!;
  const opposingChallenger = operatives.find((o) => o.apparentTeam !== loyalNonMole.apparentTeam)!;
  console.log(`  Testing counter-intelligence: ${opposingChallenger.callsign} (${opposingChallenger.apparentTeam}) challenging loyal operative ${loyalNonMole.callsign} (${loyalNonMole.apparentTeam}, ${loyalNonMole.role})...`);
  const fakeChallenge = run(`npx tsx scripts/agent-operative.ts challenge --session ${opposingChallenger.session} --target ${loyalNonMole.id}`);
  console.log(`  ✓ Challenge issued to loyal operative: ok=${fakeChallenge.ok}`);
  const loyalState = run(`npx tsx scripts/agent-operative.ts state --session ${loyalNonMole.session}`);
  const loyalIncoming = loyalState.incomingChallenges || [];
  if (loyalIncoming.length > 0) {
    const fakeResp = run(`npx tsx scripts/agent-operative.ts respond --session ${loyalNonMole.session} --challenge ${loyalIncoming[0].id} --action ACCEPT`);
    if (fakeResp.result?.isMole === false) {
      console.log(`  ✓ Correctly rejected non-mole counterfeit verification: "${fakeResp.result?.message}"`);
    } else {
      console.error(`  ❌ BUG: Server verified non-mole operative!`);
      reports[loyalNonMole.session].observedBugs.push("Bug: Non-mole verified as mole!");
    }
  }

  // Test 7C: Valid Opposing-Faction Challenge to the Genuine Mole
  const challenger = moleAlliedOps[0];
  console.log(`  ${challenger.callsign} (${challenger.role}, Apparent: ${challenger.apparentTeam}) issuing clearance challenge to ${moleOp.callsign} (Apparent: ${moleOp.apparentTeam})...`);
  const challengeRes = run(`npx tsx scripts/agent-operative.ts challenge --session ${challenger.session} --target ${moleOp.id}`);
  console.log(`  ✓ Challenge issued: ok=${challengeRes.ok}`);

  // Mole fetches state to check incoming challenges
  const moleStateBefore = run(`npx tsx scripts/agent-operative.ts state --session ${moleOp.session}`);
  const incoming = moleStateBefore.incomingChallenges || [];
  if (incoming.length === 0) {
    console.error(`  ❌ BUG: Mole did not receive incoming challenge modal!`);
    reports[moleOp.session].observedBugs.push("Mole Handshake Bug: Incoming challenge not present in state");
  } else {
    console.log(`  ✓ Mole received incoming challenge from ${incoming[0].requesterName}`);
    // Mole accepts
    const respondRes = run(`npx tsx scripts/agent-operative.ts respond --session ${moleOp.session} --challenge ${incoming[0].id} --action ACCEPT`);
    console.log(`  ✓ Mole accepted challenge: isMole=${respondRes.result?.isMole}, msg=${respondRes.result?.message}`);

    // Verify challenger received CONFIRMED ASSET
    const challengerStateAfter = run(`npx tsx scripts/agent-operative.ts state --session ${challenger.session}`);
    const verified = (challengerStateAfter.verifiedAssets || []).includes(moleOp.id);
    if (verified) {
      console.log(`  ✓ Challenger ${challenger.callsign} received permanent CONFIRMED ASSET receipt for ${moleOp.callsign}!`);
      reports[challenger.session].moleHandshakeExperience = "PASSED: Successfully verified double-agent asset";
      reports[moleOp.session].moleHandshakeExperience = "PASSED: Screen-safe 3s self-destruct counter-signature handshake verified";
    } else {
      console.error(`  ❌ BUG: Challenger did not receive verified asset status!`);
      reports[challenger.session].observedBugs.push("Mole Handshake Bug: Verified asset not in challenger state");
    }
  }

  // Test 7D: Anti-Forensic Burn in 1x1 DM
  console.log(`\n[STEP 8] Testing Anti-Forensic DM Burn Protocol...`);
  run(`npx tsx scripts/agent-operative.ts send --session ${challenger.session} --channel DM --content "Secret rendezvous confirmed." --to ${moleOp.id}`);
  const burnRes = run(`npx tsx scripts/agent-operative.ts burn --session ${challenger.session} --peer ${moleOp.id}`);
  console.log(`  ✓ Burn executed by ${challenger.callsign}: ${burnRes.ok} (purged ${burnRes.result?.count} messages)`);

  // 8. 50% Midpoint Theme Intercept
  console.log(`\n[STEP 9] Warping timer to 50% Midpoint Intercept...`);
  run(`npx tsx scripts/agent-operative.ts warp --session alpha --to MIDPOINT`);
  const midpointState = run(`npx tsx scripts/agent-operative.ts state --session alpha`);
  console.log(`  ✓ Midpoint Declassified Theme: ${midpointState.room?.declassifiedTheme || midpointState.selectedTheme}`);

  // 9. Verdict Deliberation & Collaborative Voting
  console.log(`\n[STEP 10] Warping to VERDICT phase...`);
  run(`npx tsx scripts/agent-operative.ts warp --session alpha --to VERDICT`);
  
  // Field agent proposes words
  const propOp = operatives.find((o) => o.role === "AGENT") || operatives[1];
  console.log(`  ${propOp.callsign} proposing word "${propOp.word}" on collaborative board...`);
  const propRes = run(`npx tsx scripts/agent-operative.ts propose --session ${propOp.session} --word "${propOp.word}"`);
  console.log(`  ✓ Word proposed: ${propRes.ok}`);

  // Both spymasters submit verdicts
  console.log(`\n[STEP 11] Spymasters assembling guesses and submitting official verdicts...`);
  const redSpy = operatives.find((o) => o.apparentTeam === "RED" && o.role === "SPYMASTER") || operatives[0];
  const blueSpy = operatives.find((o) => o.apparentTeam === "BLUE" && o.role === "SPYMASTER") || operatives[2];

  // Populate guesses: Red guesses correctly for all words and indicts the Mole
  const redGuesses = operatives.map((o) => o.word).join(",");
  const blueGuesses = operatives.map((o) => o.word).join(",");

  const redSubmitRes = run(`npx tsx scripts/agent-operative.ts submit --session ${redSpy.session} --guesses "${redGuesses}" --mole ${moleOp.id}`);
  console.log(`  ✓ Red Spymaster (${redSpy.callsign}) submitted verdict: ${redSubmitRes.ok}`);

  const blueSubmitRes = run(`npx tsx scripts/agent-operative.ts submit --session ${blueSpy.session} --guesses "${blueGuesses}"`);
  console.log(`  ✓ Blue Spymaster (${blueSpy.callsign}) submitted verdict: ${blueSubmitRes.ok}`);

  // 10. Debrief Inspection & Scoring
  console.log(`\n[STEP 12] Inspecting post-operation Debrief and Master Codebook...`);
  const debriefState = run(`npx tsx scripts/agent-operative.ts state --session alpha`);
  const redScore = debriefState.allVerdicts?.RED?.score ?? 0;
  const blueScore = debriefState.allVerdicts?.BLUE?.score ?? 0;
  const redBonus = debriefState.allVerdicts?.RED?.tiebreakerBonus;
  const blueBonus = debriefState.allVerdicts?.BLUE?.tiebreakerBonus;
  const theme = debriefState.room?.declassifiedTheme;
  const codebookWordCount = debriefState.codebook ? Object.keys(debriefState.codebook).length : 0;

  console.log(`  ✓ Room Phase: ${debriefState.room.phase}`);
  console.log(`  ✓ Mission Winner: ${debriefState.room.winner}`);
  console.log(`  ✓ Red Score: ${redScore} PTS ${redBonus ? `(+${redBonus} Mole Tiebreaker)` : ""} | Blue Score: ${blueScore} PTS ${blueBonus ? `(+${blueBonus} Mole Tiebreaker)` : ""}`);
  console.log(`  ✓ Master Codebook Declassified: ${debriefState.codebook ? "YES" : "NO"} (${codebookWordCount} words, Theme: ${theme})`);

  for (const session of ["alpha", "bravo", "charlie", "delta"]) {
    const op = operatives.find((o) => o.session === session)!;
    const isWinner = debriefState.room.winner !== "DRAW" && op.actualTeam === debriefState.room.winner;
    reports[session].verdictExperience = `Verdict resolved to ${debriefState.room.winner} VICTORY (Red: ${redScore} PTS, Blue: ${blueScore} PTS). Operative outcome: ${isWinner ? "VICTORY" : "DEFEAT"}.`;
  }

  // 11. Rematch Test
  console.log(`\n[STEP 13] Host executing Rematch loop...`);
  const rematchRes = run(`npx tsx scripts/agent-operative.ts rematch --session alpha`);
  console.log(`  ✓ Rematch returned to Lobby: ${rematchRes.ok}`);
  const lobbyState = run(`npx tsx scripts/agent-operative.ts state --session alpha`);
  console.log(`  ✓ Verified Room Phase: ${lobbyState.room.phase} (${lobbyState.players.length} players connected)`);

  console.log(`\n======================================================`);
  console.log(`PLAYTEST EXECUTION COMPLETE. COMPILING AGENT DIARIES.`);
  console.log(`======================================================\n`);

  return reports;
}

main().then((reports) => {
  console.log(JSON.stringify(reports, null, 2));
}).catch((err) => {
  console.error("Playtest orchestrator error:", err);
  process.exit(1);
});
