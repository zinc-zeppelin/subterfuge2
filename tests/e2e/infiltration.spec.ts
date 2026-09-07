/**
 * Domain: Infiltration Phase
 *
 * Covers:
 *  - Operational deployment, role/word assignment & redaction (was Slice 2)
 *  - 50% midpoint theme declassification & timer transition (was Slice 5)
 *  - Operational Field Manual with role-specific directives (was Slice 8)
 */

import { test, expect } from "@playwright/test";
import { SixPlayerHarness } from "../harness/multiplayer-harness";
import path from "path";

const screenshotsDir = path.resolve(process.cwd(), "screenshots");

// ---------------------------------------------------------------------------
// 1. Deployment, role assignment matrix & data redaction
// ---------------------------------------------------------------------------
test.describe("Infiltration — Deployment & Role Assignment", () => {
  let harness: SixPlayerHarness;

  test.beforeEach(async ({ browser }) => {
    harness = new SixPlayerHarness(browser);
  });

  test.afterEach(async () => {
    await harness.teardown();
  });

  test("deploys 6 operatives into balanced teams, assigns roles & secret thematic words, and enforces redaction", async ({ baseURL }) => {
    const url = baseURL || "http://localhost:3000";

    await harness.initSessions();
    const roomCode = await harness.hostCreatesRoom(url);
    await harness.joinRemainingOperatives(url);
    await harness.setAllReady();
    await harness.hostStartsOperation();
    await harness.expectAllInInfiltrationPhase();

    // Verify Team & Role Distribution Matrix across all 6 operatives
    const dossiers = [];
    for (let i = 0; i < 6; i++) {
      const dossier = await harness.getPlayerDossier(i);
      dossiers.push(dossier);
    }

    const redApparent = dossiers.filter((d) => d.apparentTeam === "RED");
    const blueApparent = dossiers.filter((d) => d.apparentTeam === "BLUE");
    expect(redApparent.length).toBe(3);
    expect(blueApparent.length).toBe(3);

    const redMoles = dossiers.filter(
      (d) => d.apparentTeam === "RED" && d.actualTeam === "BLUE" && d.role === "MOLE"
    );
    const blueMoles = dossiers.filter(
      (d) => d.apparentTeam === "BLUE" && d.actualTeam === "RED" && d.role === "MOLE"
    );
    expect(redMoles.length).toBe(1);
    expect(blueMoles.length).toBe(1);

    const redAgents = dossiers.filter(
      (d) => d.apparentTeam === "RED" && d.actualTeam === "RED" && d.role === "AGENT"
    );
    const blueAgents = dossiers.filter(
      (d) => d.apparentTeam === "BLUE" && d.actualTeam === "BLUE" && d.role === "AGENT"
    );
    expect(redAgents.length).toBe(2);
    expect(blueAgents.length).toBe(2);

    // Verify thematic secret word assignment & anti-peeking redaction
    const assignedWords = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const word = await harness.decryptAndGetSecretWord(i);
      expect(word.length).toBeGreaterThan(1);
      assignedWords.add(word);
    }
    expect(assignedWords.size).toBe(6);

    // Verify covert data isolation: roster does not expose sensitive roles or words
    const page0 = harness.sessions[0].page;
    const rosterText = await page0.locator("#red-team-roster").innerText();
    expect(rosterText).not.toContain("MOLE");
    expect(rosterText).not.toContain("SPYMASTER");
  });
});

// ---------------------------------------------------------------------------
// 2. 50% midpoint theme declassification & timer transitions
// ---------------------------------------------------------------------------
test.describe("Infiltration — Timers & Midpoint Declassification", () => {
  let harness: SixPlayerHarness;

  test.beforeEach(async ({ browser }) => {
    harness = new SixPlayerHarness(browser);
  });

  test.afterEach(async () => {
    await harness.teardown();
  });

  test("enforces theme confidentiality before midpoint, broadcasts declassified theme banner at 50% time, and transitions to VERDICT", async ({ baseURL }) => {
    const url = baseURL || "http://localhost:3000";

    await harness.initSessions([
      "Viper-T1",
      "Shadow-T2",
      "Hawk-T3",
      "Ghost-T4",
      "Specter-T5",
      "Raven-T6",
    ]);

    await harness.hostCreatesRoom(url);
    await harness.joinRemainingOperatives(url);
    await harness.setAllReady();
    await harness.hostStartsOperation();
    await harness.expectAllInInfiltrationPhase();

    // Pre-midpoint: theme is strictly classified
    await harness.expectDeclassifiedThemeNotVisibleOnAll();

    for (const op of harness.sessions) {
      await expect(op.page.locator("#operational-timer-display")).toBeVisible();
      await expect(op.page.locator("#timer-countdown")).toBeVisible();
    }

    // Trigger 50% time elapsed
    await harness.warpTime("MIDPOINT");

    // All 6 operatives receive the confirmed operational theme
    const declassifiedTheme = await harness.expectDeclassifiedThemeBannerOnAll();
    expect(declassifiedTheme.length).toBeGreaterThan(0);

    // Verify operatives can decrypt their assigned words
    for (let i = 0; i < 6; i++) {
      const word = await harness.decryptAndGetSecretWord(i);
      expect(word.length).toBeGreaterThan(0);
    }

    // Advance to 100% time -> auto-transition to VERDICT phase
    await harness.warpTime("VERDICT");

    for (const op of harness.sessions) {
      await expect(op.page.locator("#room-phase-badge")).toHaveText("VERDICT", { timeout: 10000 });
      await expect(op.page.locator("#operational-timer-display")).toContainText("VERDICT DELIBERATION");
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Operational Field Manual across all phases
// ---------------------------------------------------------------------------
test.describe("Infiltration — Field Manual & Role Directives", () => {
  let harness: SixPlayerHarness;

  test.beforeEach(async ({ browser }) => {
    harness = new SixPlayerHarness(browser);
  });

  test.afterEach(async () => {
    await harness.teardown();
  });

  test("verifies Field Manual is accessible across all phases and role directives expand/collapse correctly", async ({ baseURL }) => {
    test.setTimeout(240000);
    const url = baseURL || "http://localhost:3000";

    await harness.initSessions([
      "Agent-Alpha",
      "Agent-Bravo",
      "Agent-Charlie",
      "Agent-Delta",
      "Agent-Echo",
      "Agent-Foxtrot",
    ]);

    for (const op of harness.sessions) {
      await op.page.setViewportSize({ width: 1280, height: 900 });
    }

    const roomCode = await harness.hostCreatesRoom(url);
    await harness.joinRemainingOperatives(url);

    // Verify Field Manual in LOBBY phase
    const hostPage = harness.sessions[0].page;
    await expect(hostPage.locator("#field-manual-btn")).toBeVisible();
    await hostPage.click("#field-manual-btn");
    await expect(hostPage.locator("#field-manual-modal")).toBeVisible();
    await expect(hostPage.locator("#field-agent-directives")).toBeVisible();

    // Consensus directives collapsed by default in lobby
    await expect(hostPage.locator("#consensus-directives-content")).toBeHidden();
    await hostPage.click("#consensus-directives-toggle");
    await expect(hostPage.locator("#consensus-directives-content")).toBeVisible();

    // Mole directives collapsed by default in lobby
    await expect(hostPage.locator("#mole-directives-content")).toBeHidden();
    await hostPage.click("#mole-directives-toggle");
    await expect(hostPage.locator("#mole-directives-content")).toBeVisible();

    // Dismiss with close button
    await hostPage.click("#close-field-manual-btn");
    await expect(hostPage.locator("#field-manual-modal")).toBeHidden();

    // Dismiss with Escape key
    await hostPage.click("#field-manual-btn");
    await expect(hostPage.locator("#field-manual-modal")).toBeVisible();
    await hostPage.keyboard.press("Escape");
    await expect(hostPage.locator("#field-manual-modal")).toBeHidden();

    // Enter INFILTRATION phase
    await harness.setAllReady();
    await harness.hostStartsOperation();
    await harness.expectAllInInfiltrationPhase();

    // Identify roles
    const dossiers = [];
    let redAgentIdx = -1;
    let blueAgentIdx = -1;
    let moleIdx = -1;

    for (let i = 0; i < 6; i++) {
      const dossier = await harness.getPlayerDossier(i);
      dossiers.push({ idx: i, ...dossier });
      if (dossier.role === "MOLE" && moleIdx === -1) {
        moleIdx = i;
      } else if (dossier.role === "AGENT") {
        if (dossier.apparentTeam === "RED" && redAgentIdx === -1) redAgentIdx = i;
        else if (dossier.apparentTeam === "BLUE" && blueAgentIdx === -1) blueAgentIdx = i;
      }
    }

    const redOps = dossiers.filter((d) => d.apparentTeam === "RED");
    const blueOps = dossiers.filter((d) => d.apparentTeam === "BLUE");

    expect(moleIdx).toBeGreaterThanOrEqual(0);
    expect(redAgentIdx).toBeGreaterThanOrEqual(0);
    expect(blueAgentIdx).toBeGreaterThanOrEqual(0);

    // Regular Agent experience: Mole/Consensus directives collapsed initially
    const agentPage = harness.sessions[redAgentIdx].page;
    await expect(agentPage.locator("#field-manual-btn")).toBeVisible();
    await agentPage.click("#field-manual-btn");
    await expect(agentPage.locator("#field-manual-modal")).toBeVisible();
    await expect(agentPage.locator("#field-agent-directives")).toBeVisible();
    await expect(agentPage.locator("#consensus-directives-content")).toBeHidden();
    await expect(agentPage.locator("#mole-directives-content")).toBeHidden();
    await agentPage.click("#consensus-directives-toggle");
    await expect(agentPage.locator("#consensus-directives-content")).toBeVisible();
    await agentPage.click("#mole-directives-toggle");
    await expect(agentPage.locator("#mole-directives-content")).toBeVisible();
    await agentPage.click("#close-field-manual-btn");

    // Mole experience: Mole Directives auto-expanded
    const molePage = harness.sessions[moleIdx].page;
    await expect(molePage.locator("#field-manual-btn")).toBeVisible();
    await molePage.click("#field-manual-btn");
    await expect(molePage.locator("#field-manual-modal")).toBeVisible();
    await expect(molePage.locator("#field-agent-directives")).toBeVisible();
    await expect(molePage.locator("#mole-directives-content")).toBeVisible(); // auto-expanded for Moles
    await expect(molePage.locator("#consensus-directives-content")).toBeHidden();

    await molePage.screenshot({ path: path.join(screenshotsDir, "13-field-manual-mole.png") });
    await molePage.click("#close-field-manual-btn");

    // Verify availability in VERDICT phase
    await harness.warpTime("VERDICT");
    for (const op of harness.sessions) {
      await expect(op.page.locator("#room-phase-badge")).toHaveText("VERDICT", { timeout: 15000 });
      await expect(op.page.locator("#verdict-board")).toBeVisible({ timeout: 15000 });
    }

    await expect(hostPage.locator("#field-manual-btn")).toBeVisible();
    await hostPage.click("#field-manual-btn");
    await expect(hostPage.locator("#field-manual-modal")).toBeVisible();
    await expect(hostPage.locator("#field-agent-directives")).toBeVisible();
    await hostPage.click("#close-field-manual-btn");

    // Verify availability in DEBRIEF phase
    for (let i = 1; i <= 6; i++) {
      await harness.operativeAddVerdictGuess(blueOps[0].idx, `TESTBLUE${i}`);
    }
    await harness.operativeProposeVerdict(blueOps[0].idx);
    await harness.teammateConfirmVerdict(blueOps[1].idx);
    await harness.expectVerdictLocked(blueOps[0].idx);

    for (let i = 1; i <= 6; i++) {
      await harness.operativeAddVerdictGuess(redOps[0].idx, `TESTRED${i}`);
    }
    await harness.operativeProposeVerdict(redOps[0].idx);
    await harness.teammateConfirmVerdict(redOps[1].idx);
    await harness.expectDebriefViewOnAll();

    await expect(hostPage.locator("#field-manual-btn")).toBeVisible();
    await hostPage.click("#field-manual-btn");
    await expect(hostPage.locator("#field-manual-modal")).toBeVisible();
    await expect(hostPage.locator("#field-agent-directives")).toBeVisible();
    await hostPage.click("#close-field-manual-btn");
  });
});
