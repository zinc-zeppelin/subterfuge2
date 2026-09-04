import { test, expect } from "@playwright/test";
import { SixPlayerHarness } from "../harness/multiplayer-harness";

test.describe("Slice 2: Operational Deployment & Thematic Assignment Engine", () => {
  let harness: SixPlayerHarness;

  test.beforeEach(async ({ browser }) => {
    harness = new SixPlayerHarness(browser);
  });

  test.afterEach(async () => {
    await harness.teardown();
  });

  test("should deploy 6 operatives into balanced teams, assign roles & secret thematic words, and enforce redaction", async ({
    baseURL,
  }) => {
    const url = baseURL || "http://localhost:3000";

    // 1. Initialize 6 independent operative contexts
    await harness.initSessions();

    // 2. Host establishes room
    const roomCode = await harness.hostCreatesRoom(url);

    // 3. Operatives 1-5 join
    await harness.joinRemainingOperatives(url);

    // 4. All declare ready
    await harness.setAllReady();

    // 5. Host authorizes deployment
    await harness.hostStartsOperation();

    // 6. Assert all 6 browser contexts transition to INFILTRATION phase
    await harness.expectAllInInfiltrationPhase();

    // 7. Verify Team & Role Distribution Matrix across all 6 operatives
    const dossiers = [];
    for (let i = 0; i < 6; i++) {
      const dossier = await harness.getPlayerDossier(i);
      dossiers.push(dossier);
    }

    const redApparent = dossiers.filter((d) => d.apparentTeam === "RED");
    const blueApparent = dossiers.filter((d) => d.apparentTeam === "BLUE");
    expect(redApparent.length).toBe(3);
    expect(blueApparent.length).toBe(3);

    const redSpymasters = dossiers.filter(
      (d) => d.apparentTeam === "RED" && d.actualTeam === "RED" && d.role === "SPYMASTER"
    );
    const blueSpymasters = dossiers.filter(
      (d) => d.apparentTeam === "BLUE" && d.actualTeam === "BLUE" && d.role === "SPYMASTER"
    );
    expect(redSpymasters.length).toBe(1);
    expect(blueSpymasters.length).toBe(1);

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
    expect(redAgents.length).toBe(1);
    expect(blueAgents.length).toBe(1);

    // 8. Verify Thematic Secret Word Assignment & Anti-Peeking Redaction
    const assignedWords = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const word = await harness.decryptAndGetSecretWord(i);
      expect(word.length).toBeGreaterThan(1);
      assignedWords.add(word);
    }
    // All 6 words drawn from the primary theme must be unique
    expect(assignedWords.size).toBe(6);

    // 9. Verify Covert Data Isolation: Other players' rosters do not expose sensitive roles or words
    const page0 = harness.sessions[0].page;
    const rosterText = await page0.locator("#red-team-roster").innerText();
    expect(rosterText).not.toContain("MOLE");
    expect(rosterText).not.toContain("SPYMASTER");
  });
});
