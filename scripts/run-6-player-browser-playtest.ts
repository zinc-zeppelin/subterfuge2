import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

const TARGET_URL = process.env.PLAYTEST_URL || "https://subterfuge2.vercel.app";
const SCREENSHOT_DIR = path.resolve(process.cwd(), "screenshots/playtest-6p");

interface Operative {
  index: number;
  callsign: string;
  context: BrowserContext;
  page: Page;
  apparentTeam?: "RED" | "BLUE";
  actualTeam?: "RED" | "BLUE";
  role?: string;
  assignedWord?: string;
  id?: string;
}

const CALLSIGNS = [
  "Falcon-Lead",      // Host
  "Raven-Infiltrator",
  "Phoenix-Watcher",
  "Viper-Commander",
  "Ghost-Shadow",
  "Specter-Operative",
];

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log(`=======================================================`);
  console.log(`[PLAYTEST] Starting 6-Player Visual Browser Playtest`);
  console.log(`[PLAYTEST] Target URL: ${TARGET_URL}`);
  console.log(`[PLAYTEST] Screenshot Directory: ${SCREENSHOT_DIR}`);
  console.log(`=======================================================\n`);

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser: Browser = await chromium.launch({
    headless: true,
  });

  const operatives: Operative[] = [];
  const consoleLogs: Record<string, string[]> = {};

  try {
    // 1. Initialize 6 independent browser contexts
    for (let i = 0; i < 6; i++) {
      const callsign = CALLSIGNS[i];
      consoleLogs[callsign] = [];
      const context = await browser.newContext({
        viewport: { width: 1280, height: 850 },
        permissions: ["clipboard-read", "clipboard-write"],
      });
      const page = await context.newPage();

      page.on("console", (msg) => {
        const text = `[${msg.type()}] ${msg.text()}`;
        consoleLogs[callsign].push(text);
        if (msg.type() === "error") {
          console.warn(`[CONSOLE-ERR][${callsign}] ${msg.text()}`);
        }
      });

      operatives.push({
        index: i,
        callsign,
        context,
        page,
      });
    }

    // ==========================================
    // PHASE 1: LOBBY & ROSTER ONBOARDING
    // ==========================================
    console.log(`\n--- PHASE 1: LOBBY CREATION & ONBOARDING ---`);
    const host = operatives[0];
    await host.page.goto(TARGET_URL);
    await host.page.waitForSelector("#callsign-input", { timeout: 15000 });
    await host.page.fill("#callsign-input", host.callsign);
    await host.page.click("#create-room-btn");

    await host.page.waitForURL(/\/room\/[A-Z0-9]{6}/, { timeout: 20000 });
    const urlMatch = host.page.url().match(/\/room\/([A-Z0-9]{6})/);
    if (!urlMatch) throw new Error(`Failed to extract room code from ${host.page.url()}`);
    const roomCode = urlMatch[1];
    console.log(`[LOBBY] Room created: ${roomCode} by ${host.callsign}`);

    // Remaining 5 operatives join
    for (let i = 1; i < 6; i++) {
      const op = operatives[i];
      await op.page.goto(TARGET_URL);
      await op.page.waitForSelector("#callsign-input", { timeout: 15000 });
      await op.page.fill("#callsign-input", op.callsign);
      await op.page.fill("#room-code-input", roomCode);
      await op.page.click("#join-room-btn");
      await op.page.waitForURL(new RegExp(`/room/${roomCode}`), { timeout: 20000 });
      console.log(`[LOBBY] ${op.callsign} joined room ${roomCode}`);
    }

    // Wait for roster to display all 6 operatives on all screens
    console.log(`[LOBBY] Verifying 6 operatives present in roster across all stations...`);
    for (const op of operatives) {
      await op.page.waitForSelector("#player-roster", { timeout: 15000 });
      await op.page.waitForFunction(
        () => document.querySelectorAll("#player-roster > div").length === 6,
        { timeout: 15000 }
      );
    }

    // Capture Lobby Screenshots for all 6 operatives
    for (const op of operatives) {
      const filePath = path.join(SCREENSHOT_DIR, `op${op.index}-${op.callsign}-01-lobby.png`);
      await op.page.screenshot({ path: filePath, fullPage: true });
    }
    console.log(`[SCREENSHOT] Captured 6 Lobby screenshots in ${SCREENSHOT_DIR}`);

    // All operatives declare readiness
    for (const op of operatives) {
      await op.page.click("#toggle-ready-btn");
      await op.page.waitForSelector("#toggle-ready-btn:has-text('CANCEL READY STATUS')", { timeout: 10000 });
    }
    console.log(`[LOBBY] All 6 operatives declared readiness.`);

    // Host sees 6/6 READY and clicks Start Operation
    await host.page.waitForSelector("#start-operation-btn:not([disabled])", { timeout: 10000 });
    await host.page.click("#start-operation-btn");
    console.log(`[LOBBY] Host authorized deployment. Transitioning to INFILTRATION...`);

    // ==========================================
    // PHASE 2: INFILTRATION & SECRET DOSSIER
    // ==========================================
    console.log(`\n--- PHASE 2: INFILTRATION & DOSSIER EXTRACTION ---`);
    for (const op of operatives) {
      await op.page.waitForSelector("#room-phase-badge:has-text('INFILTRATION')", { timeout: 20000 });
      await op.page.waitForSelector("#top-secret-dossier", { timeout: 15000 });
    }
    console.log(`[INFILTRATION] All 6 stations confirmed in INFILTRATION phase.`);

    // Each operative reads dossier metadata and decrypts their secret word
    for (const op of operatives) {
      const apparentText = await op.page.locator("#self-apparent-team").innerText();
      const actualText = await op.page.locator("#self-actual-team").innerText();
      const roleText = await op.page.locator("#self-role").innerText();

      op.apparentTeam = apparentText.includes("RED") ? "RED" : "BLUE";
      op.actualTeam = actualText.includes("RED") ? "RED" : "BLUE";
      op.role = roleText.trim();

      // Click "HOLD TO DECRYPT" to reveal the secret word
      await op.page.click("#decrypt-word-btn");
      await op.page.waitForSelector("#self-assigned-word", { timeout: 10000 });
      op.assignedWord = (await op.page.locator("#self-assigned-word").innerText()).trim();

      console.log(
        `[DOSSIER] ${op.callsign.padEnd(18)} Cover: ${op.apparentTeam} | Loyalty: ${op.actualTeam} | Role: ${op.role.padEnd(12)} | Word: "${op.assignedWord}"`
      );

      // Capture Dossier Screenshot with word decrypted
      const filePath = path.join(SCREENSHOT_DIR, `op${op.index}-${op.callsign}-02-dossier-decrypted.png`);
      await op.page.screenshot({ path: filePath, fullPage: true });
    }
    console.log(`[SCREENSHOT] Captured 6 Dossier screenshots in ${SCREENSHOT_DIR}`);

    // Query room state to get player IDs for DM targeting
    const stateRes = await host.page.request.get(`${TARGET_URL}/api/rooms/${roomCode}/state`);
    const stateJson = await stateRes.json();
    for (const p of stateJson.players) {
      const matchingOp = operatives.find((o) => o.callsign === p.displayName);
      if (matchingOp) {
        matchingOp.id = p.id;
      }
    }

    // ==========================================
    // PHASE 3: OPERATIONAL COMMS (PUBLIC, TEAM, DM)
    // ==========================================
    console.log(`\n--- PHASE 3: OPERATIONAL COMMS (PUBLIC, TEAM, DM) ---`);

    // 3.1 Public Wire Transmissions
    await operatives[0].page.click("#tab-public");
    await operatives[0].page.fill("#message-input", "[PUBLIC WIRE] Lead operative Falcon checking in. All stations confirm signal.");
    await operatives[0].page.click("#send-message-btn");

    await operatives[3].page.click("#tab-public");
    await operatives[3].page.fill("#message-input", "[PUBLIC WIRE] Viper Command online. Frequency verified.");
    await operatives[3].page.click("#send-message-btn");
    await delay(1000);

    // 3.2 Team Radio Comms
    // Red Team
    const redOps = operatives.filter((o) => o.apparentTeam === "RED");
    for (const op of redOps) {
      await op.page.click("#tab-team");
    }
    await redOps[0].page.fill("#message-input", "[TEAM RED] Squad Red, acknowledge secure channel. Let's compare mission coordinates.");
    await redOps[0].page.click("#send-message-btn");
    await redOps[1].page.fill("#message-input", "[TEAM RED] Copy Lead. My intel points toward an energetic, rhythmic theme.");
    await redOps[1].page.click("#send-message-btn");

    // Blue Team
    const blueOps = operatives.filter((o) => o.apparentTeam === "BLUE");
    for (const op of blueOps) {
      await op.page.click("#tab-team");
    }
    await blueOps[0].page.fill("#message-input", "[TEAM BLUE] Blue command standing by. Keep communications disciplined.");
    await blueOps[0].page.click("#send-message-btn");
    await blueOps[1].page.fill("#message-input", "[TEAM BLUE] Understood. Monitoring all cross-frequency chatter.");
    await blueOps[1].page.click("#send-message-btn");
    await delay(1000);

    // Capture Comms Screenshot for each operative
    for (const op of operatives) {
      const filePath = path.join(SCREENSHOT_DIR, `op${op.index}-${op.callsign}-03-comms-wire.png`);
      await op.page.screenshot({ path: filePath, fullPage: true });
    }
    console.log(`[SCREENSHOT] Captured 6 Comms Wire screenshots in ${SCREENSHOT_DIR}`);

    // ==========================================
    // PHASE 4: COVERT MOLE VERIFICATION HANDSHAKE
    // ==========================================
    console.log(`\n--- PHASE 4: MOLE CLEARANCE CHALLENGE PROTOCOL ---`);
    // Find the mole on Red (apparent RED, actual BLUE) and mole on Blue (apparent BLUE, actual RED)
    const moleOnRed = operatives.find((o) => o.apparentTeam === "RED" && o.actualTeam === "BLUE");
    const blueChallenger = operatives.find((o) => o.apparentTeam === "BLUE" && o.actualTeam === "BLUE");

    if (!moleOnRed || !blueChallenger) {
      console.warn("[HANDSHAKE] Could not isolate Mole/Challenger pair; skipping handshake.");
    } else {
      console.log(`[HANDSHAKE] Challenger: ${blueChallenger.callsign} (Apparent BLUE) -> Target Mole: ${moleOnRed.callsign} (Apparent RED)`);

      // Challenger opens DM tab and selects Mole on Red
      await blueChallenger.page.click("#tab-dm");
      await blueChallenger.page.selectOption("#dm-peer-select", moleOnRed.id!);
      await blueChallenger.page.fill("#message-input", "Whisper transmission: State clearance credentials.");
      await blueChallenger.page.click("#send-message-btn");
      await delay(800);

      // Challenger clicks "REQUEST MOLE VERIFICATION"
      await blueChallenger.page.waitForSelector("#verify-credentials-btn", { timeout: 10000 });
      await blueChallenger.page.click("#verify-credentials-btn");
      console.log(`[HANDSHAKE] Clearance challenge dispatched by ${blueChallenger.callsign}`);

      // Recipient (Mole on Red) opens DM or receives modal
      await moleOnRed.page.waitForSelector("#clearance-challenge-modal", { timeout: 12000 });
      console.log(`[HANDSHAKE] Clearance challenge modal displayed on ${moleOnRed.callsign}'s station!`);

      // Recipient clicks "COUNTER-SIGN CLEARANCE"
      await moleOnRed.page.click("#submit-counter-signature-btn");

      // Verify Mole 3-second self-destruct toast appears!
      await moleOnRed.page.waitForSelector("#mole-verification-toast", { timeout: 10000 });
      const toastText = await moleOnRed.page.locator("#mole-verification-toast").innerText();
      console.log(`[HANDSHAKE] Mole Self-Destruct Toast Confirmed: "${toastText.trim()}"`);
      await moleOnRed.page.screenshot({
        path: path.join(SCREENSHOT_DIR, `mole-verification-toast-${moleOnRed.callsign}.png`),
        fullPage: true,
      });

      // Verify Challenger receives Confirmed Asset Receipt
      await blueChallenger.page.waitForSelector("#confirmed-asset-receipt", { timeout: 10000 });
      console.log(`[HANDSHAKE] Challenger Station Confirmed Asset Receipt Verified!`);
      await blueChallenger.page.screenshot({
        path: path.join(SCREENSHOT_DIR, `challenger-confirmed-asset-${blueChallenger.callsign}.png`),
        fullPage: true,
      });

      // Test Anti-Forensic Burn
      await blueChallenger.page.waitForSelector("#burn-dm-btn", { timeout: 10000 });
      await blueChallenger.page.click("#burn-dm-btn");
      await delay(1000);
      console.log(`[HANDSHAKE] Anti-Forensic Burn executed by ${blueChallenger.callsign}. Comms shredded.`);
      await blueChallenger.page.screenshot({
        path: path.join(SCREENSHOT_DIR, `dm-burned-${blueChallenger.callsign}.png`),
        fullPage: true,
      });
    }

    // ==========================================
    // PHASE 5: 50% MIDPOINT THEME DECLASSIFICATION
    // ==========================================
    console.log(`\n--- PHASE 5: 50% MIDPOINT THEME INTERCEPT ---`);
    await host.page.request.post(`${TARGET_URL}/api/rooms/${roomCode}/timer/warp`, {
      data: { target: "MIDPOINT" },
    });
    console.log(`[MIDPOINT] Warped timer to MIDPOINT.`);

    for (const op of operatives) {
      await op.page.waitForSelector("#declassified-theme-banner", { timeout: 15000 });
    }
    const themeName = (await host.page.locator("#declassified-theme-name").innerText()).trim();
    console.log(`[MIDPOINT] Operational Theme Declassified Across All Stations: "${themeName}"`);

    // Capture Midpoint Screenshot for each operative
    for (const op of operatives) {
      const filePath = path.join(SCREENSHOT_DIR, `op${op.index}-${op.callsign}-04-midpoint-intercept.png`);
      await op.page.screenshot({ path: filePath, fullPage: true });
    }
    console.log(`[SCREENSHOT] Captured 6 Midpoint Intercept screenshots in ${SCREENSHOT_DIR}`);

    // ==========================================
    // PHASE 6: VERDICT PHASE & COLLABORATION
    // ==========================================
    console.log(`\n--- PHASE 6: VERDICT DELIBERATION & LOCK-IN ---`);
    await host.page.request.post(`${TARGET_URL}/api/rooms/${roomCode}/timer/warp`, {
      data: { target: "VERDICT" },
    });
    console.log(`[VERDICT] Warped timer to VERDICT.`);

    for (const op of operatives) {
      await op.page.waitForSelector("#room-phase-badge:has-text('VERDICT')", { timeout: 20000 });
      await op.page.waitForSelector("#verdict-board", { timeout: 15000 });
    }
    console.log(`[VERDICT] All 6 stations confirmed in VERDICT phase.`);

    // Field Agents and Moles propose candidate words matching theme
    const fieldOps = operatives.filter((o) => o.role !== "SPYMASTER");
    for (const op of fieldOps.slice(0, 4)) {
      await op.page.fill("#proposal-word-input", op.assignedWord!);
      await op.page.click("#propose-word-btn");
      console.log(`[VERDICT] ${op.callsign} (${op.apparentTeam}) proposed candidate word "${op.assignedWord}"`);
      await delay(500);
    }

    // Upvote suggestions
    for (const op of operatives) {
      const upvoteBtns = await op.page.locator("button[id^='upvote-btn-']").all();
      if (upvoteBtns.length > 0) {
        await upvoteBtns[0].click().catch(() => {});
      }
    }
    await delay(1000);

    // Both Spymasters assemble their official guesses and indict suspected moles
    const redSpymaster = operatives.find((o) => o.apparentTeam === "RED" && o.role === "SPYMASTER")!;
    const blueSpymaster = operatives.find((o) => o.apparentTeam === "BLUE" && o.role === "SPYMASTER")!;

    console.log(`[VERDICT] Red Spymaster: ${redSpymaster.callsign} | Blue Spymaster: ${blueSpymaster.callsign}`);

    // Red Spymaster adds 6 words (using all assigned words known from the match)
    for (const op of operatives) {
      await redSpymaster.page.fill("#spymaster-word-input", op.assignedWord!);
      await redSpymaster.page.click("#add-guess-btn");
      await delay(200);
    }

    // Red Spymaster selects Mole Indictment
    if (moleOnRed) {
      await redSpymaster.page.selectOption("#mole-indictment-select", moleOnRed.id!);
      console.log(`[VERDICT] Red Spymaster indicted suspected mole: ${moleOnRed.callsign}`);
    }

    // Blue Spymaster adds 6 words
    for (const op of operatives) {
      await blueSpymaster.page.fill("#spymaster-word-input", op.assignedWord!);
      await blueSpymaster.page.click("#add-guess-btn");
      await delay(200);
    }

    const moleOnBlue = operatives.find((o) => o.apparentTeam === "BLUE" && o.actualTeam === "RED");
    if (moleOnBlue) {
      await blueSpymaster.page.selectOption("#mole-indictment-select", moleOnBlue.id!);
      console.log(`[VERDICT] Blue Spymaster indicted suspected mole: ${moleOnBlue.callsign}`);
    }

    // Capture Verdict screenshots BEFORE lock-in
    for (const op of operatives) {
      const filePath = path.join(SCREENSHOT_DIR, `op${op.index}-${op.callsign}-05-verdict-board.png`);
      await op.page.screenshot({ path: filePath, fullPage: true });
    }
    console.log(`[SCREENSHOT] Captured 6 Verdict Board screenshots in ${SCREENSHOT_DIR}`);

    // Both Spymasters submit verdicts
    await redSpymaster.page.click("#lock-in-verdict-btn");
    await delay(1000);
    await blueSpymaster.page.click("#lock-in-verdict-btn");
    console.log(`[VERDICT] Both Spymasters locked in official verdicts.`);

    // ==========================================
    // PHASE 7: DEBRIEF & MISSION ASSESSMENT
    // ==========================================
    console.log(`\n--- PHASE 7: DEBRIEF & FINAL CODEBOOK DECLASSIFICATION ---`);
    for (const op of operatives) {
      await op.page.waitForSelector("#room-phase-badge:has-text('DEBRIEF')", { timeout: 20000 });
      await op.page.waitForSelector("#debrief-view", { timeout: 15000 });
      await op.page.waitForSelector("#debrief-winner-banner", { timeout: 15000 });
      await op.page.waitForSelector("#debrief-codebook", { timeout: 15000 });
      await op.page.waitForSelector("#debrief-roster", { timeout: 15000 });
    }
    console.log(`[DEBRIEF] All 6 stations confirmed in DEBRIEF phase.`);

    const winnerText = await host.page.locator("#debrief-winner-banner").innerText();
    const redScore = await host.page.locator("#red-final-score").innerText();
    const blueScore = await host.page.locator("#blue-final-score").innerText();

    console.log(`\n=======================================================`);
    console.log(`[MISSION OUTCOME] ${winnerText.replace(/\n+/g, " ").trim()}`);
    console.log(`[SCORES] RED: ${redScore} | BLUE: ${blueScore}`);
    console.log(`=======================================================\n`);

    // Capture Debrief Screenshot for each operative
    for (const op of operatives) {
      const filePath = path.join(SCREENSHOT_DIR, `op${op.index}-${op.callsign}-06-debrief.png`);
      await op.page.screenshot({ path: filePath, fullPage: true });
    }
    console.log(`[SCREENSHOT] Captured 6 Debrief screenshots in ${SCREENSHOT_DIR}`);

    // Output operative summary table
    console.log(`\nOPERATIVE SUMMARY:`);
    for (const op of operatives) {
      console.log(
        `- ${op.callsign.padEnd(20)} | Cover: ${op.apparentTeam} | True Allegiance: ${op.actualTeam} | Role: ${op.role} | Word: ${op.assignedWord}`
      );
    }

    // Check for any console errors across all contexts
    console.log(`\nCONSOLE ERROR AUDIT:`);
    let totalErrors = 0;
    for (const op of operatives) {
      const errors = consoleLogs[op.callsign].filter((log) => log.startsWith("[error]"));
      if (errors.length > 0) {
        console.warn(`Operative ${op.callsign} encountered ${errors.length} console errors:`);
        errors.forEach((e) => console.warn(`  ${e}`));
        totalErrors += errors.length;
      }
    }
    if (totalErrors === 0) {
      console.log(`✓ ZERO console errors detected across all 6 operative stations! Clean execution.`);
    }

    console.log(`\n[PLAYTEST] 6-Player Visual Browser Playtest Completed Successfully!`);
  } finally {
    for (const op of operatives) {
      await op.context.close().catch(() => {});
    }
    await browser.close().catch(() => {});
  }
}

run().catch((err) => {
  console.error("[PLAYTEST FATAL ERROR]", err);
  process.exit(1);
});
