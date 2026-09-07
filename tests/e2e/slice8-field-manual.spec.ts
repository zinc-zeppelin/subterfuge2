import { test, expect } from "@playwright/test";
import { SixPlayerHarness } from "../harness/multiplayer-harness";
import path from "path";

test.describe("Slice 8: Operational Field Manual with Role-Specific Directives", () => {
  let harness: SixPlayerHarness;
  const screenshotsDir = path.resolve(process.cwd(), "screenshots");

  test.beforeEach(async ({ browser }) => {
    harness = new SixPlayerHarness(browser);
  });

  test.afterEach(async () => {
    await harness.teardown();
  });

  test("verifies Field Manual is accessible across all phases and role directives expand/collapse correctly", async ({
    baseURL,
  }) => {
    test.setTimeout(120000);
    const url = baseURL || "http://localhost:3000";

    // 1. Lobby Phase: Initialize 6 players
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

    // Standard field agent directives are visible
    await expect(hostPage.locator("#field-agent-directives")).toBeVisible();

    // Consensus directives are collapsed by default in lobby
    await expect(hostPage.locator("#consensus-directives-content")).toBeHidden();
    await hostPage.click("#consensus-directives-toggle");
    await expect(hostPage.locator("#consensus-directives-content")).toBeVisible();

    // Mole directives are collapsed by default in lobby
    await expect(hostPage.locator("#mole-directives-content")).toBeHidden();
    await hostPage.click("#mole-directives-toggle");
    await expect(hostPage.locator("#mole-directives-content")).toBeVisible();

    // Test dismiss with close button
    await hostPage.click("#close-field-manual-btn");
    await expect(hostPage.locator("#field-manual-modal")).toBeHidden();

    // Test dismiss with Escape key
    await hostPage.click("#field-manual-btn");
    await expect(hostPage.locator("#field-manual-modal")).toBeVisible();
    await hostPage.keyboard.press("Escape");
    await expect(hostPage.locator("#field-manual-modal")).toBeHidden();

    // Start operation to enter INFILTRATION phase
    await harness.setAllReady();
    await harness.hostStartsOperation();
    await harness.expectAllInInfiltrationPhase();

    // Identify roles: Find Mole and regular Field Agents
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

    // 2. Test Regular Agent experience
    const agentPage = harness.sessions[redAgentIdx].page;
    await expect(agentPage.locator("#field-manual-btn")).toBeVisible();
    await agentPage.click("#field-manual-btn");
    await expect(agentPage.locator("#field-manual-modal")).toBeVisible();
    await expect(agentPage.locator("#field-agent-directives")).toBeVisible();
    // Consensus and Mole directives are collapsed initially for regular agent
    await expect(agentPage.locator("#consensus-directives-content")).toBeHidden();
    await expect(agentPage.locator("#mole-directives-content")).toBeHidden();
    // Agent can manually expand Consensus directives if desired
    await agentPage.click("#consensus-directives-toggle");
    await expect(agentPage.locator("#consensus-directives-content")).toBeVisible();
    // Agent can manually expand Mole directives if desired
    await agentPage.click("#mole-directives-toggle");
    await expect(agentPage.locator("#mole-directives-content")).toBeVisible();
    await agentPage.click("#close-field-manual-btn");

    // 3. Test Mole experience (Auto-expanded Mole Directives)
    const molePage = harness.sessions[moleIdx].page;
    await expect(molePage.locator("#field-manual-btn")).toBeVisible();
    await molePage.click("#field-manual-btn");
    await expect(molePage.locator("#field-manual-modal")).toBeVisible();
    await expect(molePage.locator("#field-agent-directives")).toBeVisible();
    // Mole directives should be auto-expanded for Moles!
    await expect(molePage.locator("#mole-directives-content")).toBeVisible();
    // Consensus directives should remain collapsed
    await expect(molePage.locator("#consensus-directives-content")).toBeHidden();

    // Screenshot Mole Field Manual
    await molePage.screenshot({
      path: path.join(screenshotsDir, "13-field-manual-mole.png"),
    });

    await molePage.click("#close-field-manual-btn");

    // 4. Test Availability in VERDICT Phase
    await harness.warpTime("VERDICT");
    for (const op of harness.sessions) {
      await expect(op.page.locator("#room-phase-badge")).toHaveText("VERDICT", {
        timeout: 15000,
      });
      await expect(op.page.locator("#verdict-board")).toBeVisible({ timeout: 15000 });
    }

    // Field Manual must be accessible in Verdict phase
    await expect(hostPage.locator("#field-manual-btn")).toBeVisible();
    await hostPage.click("#field-manual-btn");
    await expect(hostPage.locator("#field-manual-modal")).toBeVisible();
    await expect(hostPage.locator("#field-agent-directives")).toBeVisible();
    await hostPage.click("#close-field-manual-btn");

    // 5. Test Availability in DEBRIEF Phase
    // Submit verdicts with two-member consensus from both teams to trigger Debrief
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

    // Field Manual is accessible in Debrief phase
    await expect(hostPage.locator("#field-manual-btn")).toBeVisible();
    await hostPage.click("#field-manual-btn");
    await expect(hostPage.locator("#field-manual-modal")).toBeVisible();
    await expect(hostPage.locator("#field-agent-directives")).toBeVisible();
    await hostPage.click("#close-field-manual-btn");
  });
});
