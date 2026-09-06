import { test, expect } from "@playwright/test";
import { SixPlayerHarness } from "../harness/multiplayer-harness";

test.describe("Slice 3: Communication Suite, Channel Isolation & Anti-Forensic Burn", () => {
  let harness: SixPlayerHarness;

  test.beforeEach(async ({ browser }) => {
    harness = new SixPlayerHarness(browser);
  });

  test.afterEach(async () => {
    await harness.teardown();
  });

  test("should enforce channel isolation between Public, Team Radio, and 1-on-1 DMs, and support conversation burning", async ({
    baseURL,
  }) => {
    const url = baseURL || "http://localhost:3000";

    // 1. Initialize and deploy 6 operatives into INFILTRATION phase
    await harness.initSessions();
    await harness.hostCreatesRoom(url);
    await harness.joinRemainingOperatives(url);
    await harness.setAllReady();
    await harness.hostStartsOperation();
    await harness.expectAllInInfiltrationPhase();

    // 2. Identify Red and Blue operatives
    const dossiers = [];
    for (let i = 0; i < 6; i++) {
      const d = await harness.getPlayerDossier(i);
      dossiers.push({ ...d, index: i });
    }
    const redOps = dossiers.filter((d) => d.apparentTeam === "RED");
    const blueOps = dossiers.filter((d) => d.apparentTeam === "BLUE");

    const redOp1 = redOps[0].index;
    const redOp2 = redOps[1].index;
    const blueOp1 = blueOps[0].index;

    // 3. Test Public Wire: Broadcast visible to all operatives
    const publicMsg = "PUBLIC BROADCAST: Attention all field assets.";
    await harness.switchTab(redOp1, "PUBLIC");
    await harness.sendMessage(redOp1, publicMsg);

    // Assert visible on Red Op 1, Red Op 2, and Blue Op 1
    await harness.expectMessageInFeed(redOp1, publicMsg);
    await harness.switchTab(redOp2, "PUBLIC");
    await harness.expectMessageInFeed(redOp2, publicMsg);
    await harness.switchTab(blueOp1, "PUBLIC");
    await harness.expectMessageInFeed(blueOp1, publicMsg);

    // 4. Test Team Radio Isolation: Red Radio message only visible to apparent Red operatives
    const redRadioMsg = "RED TEAM TRANSMISSION: Meet at sector 7.";
    await harness.switchTab(redOp1, "TEAM");
    await harness.sendMessage(redOp1, redRadioMsg);

    // Red Op 1 and Red Op 2 see the message
    await harness.expectMessageInFeed(redOp1, redRadioMsg);
    await harness.switchTab(redOp2, "TEAM");
    await harness.expectMessageInFeed(redOp2, redRadioMsg);

    // Blue Op 1 on Blue Radio does NOT see the Red message
    await harness.switchTab(blueOp1, "TEAM");
    await harness.expectMessageNotInFeed(blueOp1, redRadioMsg);

    // 5. Test 1-on-1 Direct Messages & Conversation Burning
    const dmMsg = "COVERT PROPOSAL: I have intelligence on the codebook.";
    await harness.switchTab(redOp1, "DM");
    await harness.selectDMPeer(redOp1, blueOp1);
    await harness.sendMessage(redOp1, dmMsg);

    // Red Op 1 sees DM
    await harness.expectMessageInFeed(redOp1, dmMsg);

    // Blue Op 1 selects Red Op 1 and sees DM
    await harness.switchTab(blueOp1, "DM");
    await harness.selectDMPeer(blueOp1, redOp1);
    await harness.expectMessageInFeed(blueOp1, dmMsg);

    // Third-party Red Op 2 selects Blue Op 1 and asserts NO access to that DM
    await harness.switchTab(redOp2, "DM");
    await harness.selectDMPeer(redOp2, blueOp1);
    await harness.expectMessageNotInFeed(redOp2, dmMsg);

    // 6. Test Unilateral Burn Conversation: Red Op 1 burns the conversation with Blue Op 1
    await harness.switchTab(redOp1, "DM");
    await harness.selectDMPeer(redOp1, blueOp1);
    await harness.burnDM(redOp1);

    // Verify messages wiped for Red Op 1 (the burner), but retained for Blue Op 1 (the peer)
    await harness.expectMessageNotInFeed(redOp1, dmMsg);
    await harness.expectMessageInFeed(blueOp1, dmMsg);

    // Now Blue Op 1 burns the conversation from their station
    await harness.burnDM(blueOp1);
    await harness.expectMessageNotInFeed(blueOp1, dmMsg);
  });
});
