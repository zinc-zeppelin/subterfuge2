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
    }
  }

  /**
   * Toggle ready status for a specific player
   */
  public async toggleReady(playerIndex: number): Promise<void> {
    const op = this.sessions[playerIndex];
    await op.page.click("#toggle-ready-btn");
  }

  /**
   * Toggle ready status for all 6 operatives
   */
  public async setAllReady(): Promise<void> {
    for (let i = 0; i < this.sessions.length; i++) {
      await this.toggleReady(i);
    }
  }

  /**
   * Verify on every operative's screen that the roster displays the expected count
   */
  public async verifyRosterCountOnAll(expectedCount: number): Promise<void> {
    for (const op of this.sessions) {
      await expect(op.page.locator("#player-roster > div")).toHaveCount(expectedCount, {
        timeout: 10000,
      });
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
