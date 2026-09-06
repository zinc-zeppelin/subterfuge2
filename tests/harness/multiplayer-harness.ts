import { Browser, BrowserContext, Page, expect } from "@playwright/test";

export interface OperativeSession {
  index: number;
  callsign: string;
  context: BrowserContext;
  page: Page;
}

export class SixPlayerHarness {
  public sessions: OperativeSession[] = [];
  public roomCode: string | null = null;

  constructor(private browser: Browser) {}

  /**
   * Initialize 6 distinct browser contexts for 6-player multiplayer testing
   */
  public async initSessions(
    callsigns: string[] = [
      "Viper-Commander",
      "Shadow-Mole1",
      "Hawk-Agent1",
      "Ghost-Commander",
      "Specter-Mole2",
      "Raven-Agent2",
    ]
  ): Promise<OperativeSession[]> {
    if (callsigns.length !== 6) {
      throw new Error("SixPlayerHarness requires exactly 6 operative callsigns");
    }

    this.sessions = [];
    for (let i = 0; i < 6; i++) {
      const context = await this.browser.newContext();
      const page = await context.newPage();
      this.sessions.push({
        index: i,
        callsign: callsigns[i],
        context,
        page,
      });
    }

    return this.sessions;
  }

  /**
   * Operative 0 (Host) creates the room and obtains the 6-character room code
   */
  public async hostCreatesRoom(baseURL: string): Promise<string> {
    const host = this.sessions[0];
    await host.page.goto(`${baseURL}/`);

    // Enter call-sign
    await host.page.fill("#callsign-input", host.callsign);

    // Click create room
    await host.page.click("#create-room-btn");

    // Wait for navigation to /room/[code]
    await host.page.waitForURL(/\/room\/[A-Z0-9]{6}/);

    const url = host.page.url();
    const match = url.match(/\/room\/([A-Z0-9]{6})/);
    if (!match) throw new Error(`Failed to extract room code from URL: ${url}`);

    this.roomCode = match[1];
    return this.roomCode;
  }

  /**
   * Operatives 1 through 5 join the room via the room code
   */
  public async joinRemainingOperatives(baseURL: string): Promise<void> {
    if (!this.roomCode) throw new Error("Room code not set. Host must create room first.");

    for (let i = 1; i < this.sessions.length; i++) {
      const op = this.sessions[i];
      await op.page.goto(`${baseURL}/`);

      await op.page.fill("#callsign-input", op.callsign);
      await op.page.fill("#room-code-input", this.roomCode);
      await op.page.click("#join-room-btn");

      await op.page.waitForURL(new RegExp(`/room/${this.roomCode}`));
      await expect(op.page.locator("#player-roster")).toBeVisible({ timeout: 15000 });
    }
  }

  /**
   * Toggle ready status for a specific player
   */
  public async toggleReady(playerIndex: number): Promise<void> {
    const op = this.sessions[playerIndex];
    await expect(op.page.locator("#toggle-ready-btn")).toBeVisible({ timeout: 15000 });
    await op.page.click("#toggle-ready-btn");
    await expect(op.page.locator("#toggle-ready-btn")).toContainText("CANCEL READY STATUS", { timeout: 15000 });
  }

  /**
   * Toggle ready status for all 6 operatives
   */
  public async setAllReady(): Promise<void> {
    // First ensure every session has connected to the lobby
    for (const op of this.sessions) {
      await expect(op.page.locator("#toggle-ready-btn")).toBeVisible({ timeout: 15000 });
    }
    for (let i = 0; i < this.sessions.length; i++) {
      await this.toggleReady(i);
    }
    // Ensure host sees full readiness and enabled start button
    const hostPage = this.sessions[0].page;
    await expect(hostPage.getByText(`${this.sessions.length}/${this.sessions.length} READY`)).toBeVisible({ timeout: 15000 });
    await expect(hostPage.locator("#start-operation-btn")).toBeEnabled({ timeout: 15000 });
  }

  /**
   * Verify on every operative's screen that the roster displays the expected count
   */
  public async verifyRosterCountOnAll(expectedCount: number): Promise<void> {
    for (const op of this.sessions) {
      await expect(op.page.locator("#player-roster")).toBeVisible({ timeout: 15000 });
      await expect(op.page.locator("#player-roster > div")).toHaveCount(expectedCount, {
        timeout: 15000,
      });
    }
  }

  /**
   * Operative 0 (Host) clicks the button to authorize deployment and commence operation
   */
  public async hostStartsOperation(): Promise<void> {
    const host = this.sessions[0];
    await host.page.click("#start-operation-btn");
  }

  /**
   * Assert that all 6 browser contexts see the INFILTRATION phase badge
   */
  public async expectAllInInfiltrationPhase(): Promise<void> {
    for (const op of this.sessions) {
      await expect(op.page.locator("#room-phase-badge")).toHaveText("INFILTRATION", {
        timeout: 15000,
      });
    }
  }

  /**
   * Click hold-to-decrypt button and retrieve the assigned secret code word
   */
  public async decryptAndGetSecretWord(playerIndex: number): Promise<string> {
    const op = this.sessions[playerIndex];
    // Initially word should be redacted
    await expect(op.page.locator("#self-word-redacted")).toBeVisible();

    // Press hold-to-decrypt button
    await op.page.dispatchEvent("#decrypt-word-btn", "mousedown");

    // Decrypted word should appear
    const wordLocator = op.page.locator("#self-assigned-word");
    await expect(wordLocator).toBeVisible();
    const word = await wordLocator.innerText();

    // Release button
    await op.page.dispatchEvent("#decrypt-word-btn", "mouseup");
    return word.trim();
  }

  /**
   * Get an operative's classified dossier info
   */
  public async getPlayerDossier(playerIndex: number): Promise<{
    apparentTeam: string;
    actualTeam: string;
    role: string;
  }> {
    const op = this.sessions[playerIndex];
    const apparentText = await op.page.locator("#self-apparent-team").innerText();
    const actualEl = op.page.locator("#self-actual-team");
    const roleEl = op.page.locator("#self-role");

    const actualAttr = await actualEl.getAttribute("data-actual-team");
    const actualText = actualAttr || (await actualEl.innerText());

    const roleAttr = await roleEl.getAttribute("data-actual-role");
    const roleText = roleAttr || (await roleEl.innerText());

    return {
      apparentTeam: apparentText.includes("RED") ? "RED" : "BLUE",
      actualTeam: actualText.includes("RED") ? "RED" : "BLUE",
      role: roleText.trim(),
    };
  }

  /**
   * Switch communication tab
   */
  public async switchTab(playerIndex: number, tab: "PUBLIC" | "TEAM" | "DM"): Promise<void> {
    const op = this.sessions[playerIndex];
    if (tab === "PUBLIC") await op.page.click("#tab-public");
    if (tab === "TEAM") await op.page.click("#tab-team");
    if (tab === "DM") await op.page.click("#tab-dm");
  }

  /**
   * Send a transmission on the currently active tab
   */
  public async sendMessage(playerIndex: number, text: string): Promise<void> {
    const op = this.sessions[playerIndex];
    await op.page.fill("#message-input", text);
    await op.page.click("#send-message-btn");
  }

  /**
   * Assert a message is visible in the player's current message feed
   */
  public async expectMessageInFeed(playerIndex: number, text: string): Promise<void> {
    const op = this.sessions[playerIndex];
    await expect(op.page.locator("#message-list")).toContainText(text, { timeout: 10000 });
  }

  /**
   * Assert a message is NOT visible in the player's current message feed
   */
  public async expectMessageNotInFeed(playerIndex: number, text: string): Promise<void> {
    const op = this.sessions[playerIndex];
    await expect(op.page.locator("#message-list")).not.toContainText(text);
  }

  /**
   * Select a target peer in the DM tab
   */
  public async selectDMPeer(playerIndex: number, targetPlayerIndex: number): Promise<void> {
    const op = this.sessions[playerIndex];
    const target = this.sessions[targetPlayerIndex];
    const option = op.page.locator("#dm-peer-select option", { hasText: target.callsign });
    const value = await option.getAttribute("value");
    if (value) {
      await op.page.selectOption("#dm-peer-select", value);
    }
  }

  /**
   * Burn current DM conversation
   */
  public async burnDM(playerIndex: number): Promise<void> {
    const op = this.sessions[playerIndex];
    await op.page.click("#burn-dm-btn");
    const confirmBtn = op.page.locator("#confirm-burn-btn");
    if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await confirmBtn.click();
    }
  }

  /**
   * Initiate clearance challenge in DM view
   */
  public async initiateClearanceChallenge(playerIndex: number): Promise<void> {
    const op = this.sessions[playerIndex];
    await op.page.click("#verify-credentials-btn");
  }

  /**
   * Submit counter-signature on incoming challenge
   */
  public async submitCounterSignature(playerIndex: number): Promise<void> {
    const op = this.sessions[playerIndex];
    await expect(op.page.locator("#clearance-challenge-modal")).toBeVisible({ timeout: 10000 });
    await op.page.click("#submit-counter-signature-btn");
  }

  /**
   * Decline incoming clearance challenge
   */
  public async declineCounterSignature(playerIndex: number): Promise<void> {
    const op = this.sessions[playerIndex];
    await expect(op.page.locator("#clearance-challenge-modal")).toBeVisible({ timeout: 10000 });
    await op.page.click("#decline-challenge-btn");
  }

  /**
   * Assert 3-second self-destruct toast on Mole screen
   */
  public async expectMoleSelfDestructToast(playerIndex: number): Promise<void> {
    const op = this.sessions[playerIndex];
    await expect(op.page.locator("#mole-verification-toast")).toBeVisible({ timeout: 10000 });
    await expect(op.page.locator("#mole-verification-toast")).toContainText("Operative Verified. Channel Secured.");
  }

  /**
   * Assert self-destruct toast disappeared
   */
  public async expectMoleToastDisappeared(playerIndex: number): Promise<void> {
    const op = this.sessions[playerIndex];
    await expect(op.page.locator("#mole-verification-toast")).not.toBeVisible({ timeout: 10000 });
  }

  /**
   * Assert denied clearance toast
   */
  public async expectDeniedToast(playerIndex: number): Promise<void> {
    const op = this.sessions[playerIndex];
    await expect(op.page.locator("#denied-verification-toast")).toBeVisible({ timeout: 10000 });
  }

  /**
   * Assert confirmed asset receipt is displayed for requester
   */
  public async expectConfirmedAssetReceipt(playerIndex: number): Promise<void> {
    const op = this.sessions[playerIndex];
    await expect(op.page.locator("#confirmed-asset-receipt")).toBeVisible({ timeout: 10000 });
    await expect(op.page.locator("#confirmed-asset-badge")).toBeVisible({ timeout: 10000 });
  }

  /**
   * Warp time to target milestone (MIDPOINT or VERDICT)
   */
  public async warpTime(target: "MIDPOINT" | "VERDICT"): Promise<void> {
    if (!this.roomCode) throw new Error("Room code not set");
    const page = this.sessions[0].page;
    const res = await page.request.post(`/api/rooms/${this.roomCode}/timer/warp`, {
      data: { target },
    });
    if (!res.ok()) {
      throw new Error(`Failed to warp time: ${await res.text()}`);
    }
  }

  /**
   * Assert that the declassified theme banner is visible across all 6 operatives
   */
  public async expectDeclassifiedThemeBannerOnAll(): Promise<string> {
    let themeName = "";
    for (const op of this.sessions) {
      await expect(op.page.locator("#declassified-theme-banner")).toBeVisible({ timeout: 10000 });
      const nameLocator = op.page.locator("#declassified-theme-name");
      await expect(nameLocator).toBeVisible({ timeout: 10000 });
      const text = await nameLocator.innerText();
      expect(text.trim().length).toBeGreaterThan(0);
      if (!themeName) themeName = text.trim();
      expect(text.trim()).toBe(themeName);
    }
    return themeName;
  }

  /**
   * Assert that the declassified theme banner is NOT visible on any operative
   */
  public async expectDeclassifiedThemeNotVisibleOnAll(): Promise<void> {
    for (const op of this.sessions) {
      await expect(op.page.locator("#declassified-theme-banner")).not.toBeVisible();
    }
  }

  /**
   * Propose a word on team's collaborative verdict board
   */
  public async proposeWord(playerIndex: number, word: string): Promise<void> {
    const op = this.sessions[playerIndex];
    await op.page.fill("#proposal-word-input", word);
    await op.page.click("#propose-word-btn");
  }

  /**
   * Spymaster adds a word directly to their official draft
   */
  public async spymasterAddGuess(playerIndex: number, word: string): Promise<void> {
    const op = this.sessions[playerIndex];
    await op.page.fill("#spymaster-word-input", word);
    await op.page.click("#add-guess-btn");
  }

  /**
   * Spymaster submits official verdict
   */
  public async spymasterSubmitVerdict(playerIndex: number): Promise<void> {
    const op = this.sessions[playerIndex];
    await op.page.click("#lock-in-verdict-btn");
    const confirmBtn = op.page.locator("#confirm-verdict-btn");
    if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await confirmBtn.click();
    }
  }

  /**
   * Assert verdict is locked in
   */
  public async expectVerdictLocked(playerIndex: number): Promise<void> {
    const op = this.sessions[playerIndex];
    await expect(op.page.locator("#verdict-locked-badge")).toBeVisible({ timeout: 10000 });
  }

  /**
   * Spymaster selects a suspected mole for indictment
   */
  public async spymasterSelectMoleIndictment(playerIndex: number, targetId: string): Promise<void> {
    const op = this.sessions[playerIndex];
    await op.page.selectOption("#mole-indictment-select", targetId);
  }

  /**
   * Assert debrief view is visible across all 6 operatives
   */
  public async expectDebriefViewOnAll(): Promise<void> {
    for (const op of this.sessions) {
      await expect(op.page.locator("#room-phase-badge")).toHaveText("DEBRIEF", { timeout: 15000 });
      await expect(op.page.locator("#debrief-winner-banner")).toBeVisible({ timeout: 15000 });
      await expect(op.page.locator("#debrief-codebook")).toBeVisible({ timeout: 15000 });
      await expect(op.page.locator("#debrief-roster")).toBeVisible({ timeout: 15000 });
    }
  }

  /**
   * Host authorizes rematch and asserts all 6 operatives return to LOBBY
   */
  public async hostRematchAndExpectLobby(): Promise<void> {
    const host = this.sessions[0];
    await expect(host.page.locator("#rematch-btn")).toBeVisible({ timeout: 10000 });
    await host.page.click("#rematch-btn");

    for (const op of this.sessions) {
      await expect(op.page.locator("#room-phase-badge")).toHaveText("LOBBY", { timeout: 15000 });
      await expect(op.page.locator("#player-roster")).toBeVisible({ timeout: 15000 });
    }
  }

  /**
   * Clean up all browser contexts
   */
  public async teardown(): Promise<void> {
    for (const op of this.sessions) {
      await op.context.close().catch(() => {});
    }
    this.sessions = [];
  }
}
