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

    // Spymaster directives are collapsed by default in lobby
    await expect(hostPage.locator("#spymaster-directives-content")).toBeHidden();
    await hostPage.click("#spymaster-directives-toggle");
    await expect(hostPage.locator("#spymaster-directives-content")).toBeVisible();

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

    // Identify roles: Find Spymaster, Mole, and regular Field Agent
    let redSpymasterIdx = -1;
    let blueSpymasterIdx = -1;
    let moleIdx = -1;
    let regularAgentIdx = -1;

    for (let i = 0; i < 6; i++) {
      const dossier = await harness.getPlayerDossier(i);
      if (dossier.role === "SPYMASTER") {
        if (dossier.apparentTeam === "RED") redSpymasterIdx = i;
        else blueSpymasterIdx = i;
      } else if (dossier.role === "MOLE" && moleIdx === -1) {
        moleIdx = i;
      } else if (dossier.role === "AGENT" && regularAgentIdx === -1) {
        regularAgentIdx = i;
      }
    }

    const spymasterIdx = redSpymasterIdx !== -1 ? redSpymasterIdx : blueSpymasterIdx;
    expect(spymasterIdx).toBeGreaterThanOrEqual(0);
    expect(moleIdx).toBeGreaterThanOrEqual(0);
    expect(regularAgentIdx).toBeGreaterThanOrEqual(0);

    // 2. Test Regular Agent experience
    const agentPage = harness.sessions[regularAgentIdx].page;
    await expect(agentPage.locator("#field-manual-btn")).toBeVisible();
    await agentPage.click("#field-manual-btn");
    await expect(agentPage.locator("#field-manual-modal")).toBeVisible();
    await expect(agentPage.locator("#field-agent-directives")).toBeVisible();
    // Spymaster and Mole are collapsed initially for regular agent
    await expect(agentPage.locator("#spymaster-directives-content")).toBeHidden();
    await expect(agentPage.locator("#mole-directives-content")).toBeHidden();
    // Agent can manually expand Spymaster directives if desired
    await agentPage.click("#spymaster-directives-toggle");
    await expect(agentPage.locator("#spymaster-directives-content")).toBeVisible();
    // Agent can manually expand Mole directives if desired
    await agentPage.click("#mole-directives-toggle");
    await expect(agentPage.locator("#mole-directives-content")).toBeVisible();
    await agentPage.click("#close-field-manual-btn");

    // 3. Test Spymaster experience (Auto-expanded Spymaster Directives)
    const spymasterPage = harness.sessions[spymasterIdx].page;
    await expect(spymasterPage.locator("#field-manual-btn")).toBeVisible();
    await spymasterPage.click("#field-manual-btn");
    await expect(spymasterPage.locator("#field-manual-modal")).toBeVisible();
    await expect(spymasterPage.locator("#field-agent-directives")).toBeVisible();
    // Spymaster directives should be auto-expanded for Spymasters!
    await expect(spymasterPage.locator("#spymaster-directives-content")).toBeVisible();
    // Mole directives should remain collapsed
    await expect(spymasterPage.locator("#mole-directives-content")).toBeHidden();

    // Screenshot Spymaster Field Manual
    await spymasterPage.screenshot({
      path: path.join(screenshotsDir, "12-field-manual-spymaster.png"),
    });

    await spymasterPage.click("#close-field-manual-btn");

    // 4. Test Mole experience (Auto-expanded Mole Directives)
    const molePage = harness.sessions[moleIdx].page;
    await expect(molePage.locator("#field-manual-btn")).toBeVisible();
    await molePage.click("#field-manual-btn");
    await expect(molePage.locator("#field-manual-modal")).toBeVisible();
    await expect(molePage.locator("#field-agent-directives")).toBeVisible();
    // Mole directives should be auto-expanded for Moles!
    await expect(molePage.locator("#mole-directives-content")).toBeVisible();
    // Spymaster directives should remain collapsed
    await expect(molePage.locator("#spymaster-directives-content")).toBeHidden();

    // Screenshot Mole Field Manual
    await molePage.screenshot({
      path: path.join(screenshotsDir, "13-field-manual-mole.png"),
    });

    await molePage.click("#close-field-manual-btn");

    // 5. Test Availability in VERDICT Phase
    await harness.warpTime("VERDICT");
    await expect(hostPage.locator("#verdict-board")).toBeVisible({ timeout: 15000 });

    // Field Manual must be accessible in Verdict phase
    await expect(hostPage.locator("#field-manual-btn")).toBeVisible();
    await hostPage.click("#field-manual-btn");
    await expect(hostPage.locator("#field-manual-modal")).toBeVisible();
    await expect(hostPage.locator("#field-agent-directives")).toBeVisible();
    await hostPage.click("#close-field-manual-btn");

    // 6. Test Availability in DEBRIEF Phase
    // Submit verdicts from both Spymasters to trigger Debrief
    await harness.spymasterAddGuess(blueSpymasterIdx, "TESTWORD1");
    await harness.spymasterSubmitVerdict(blueSpymasterIdx);
    await harness.expectVerdictLocked(blueSpymasterIdx);

    await harness.spymasterAddGuess(redSpymasterIdx, "TESTWORD2");
    await harness.spymasterSubmitVerdict(redSpymasterIdx);
    await harness.expectDebriefViewOnAll();

    // Field Manual is accessible in Debrief phase
    await expect(hostPage.locator("#field-manual-btn")).toBeVisible();
    await hostPage.click("#field-manual-btn");
    await expect(hostPage.locator("#field-manual-modal")).toBeVisible();
    await expect(hostPage.locator("#field-agent-directives")).toBeVisible();
    await hostPage.click("#close-field-manual-btn");
  });
});
