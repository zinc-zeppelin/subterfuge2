import { Redis } from "@upstash/redis";
import {
  Room,
  Player,
  ClientGameState,
  SanitizedPlayer,
  Message,
  ChannelType,
  MoleChallenge,
  MoleVerification,
  WordSuggestion,
  TeamVerdict,
  ProposedVerdict,
  TeamDraftSlate,
  TeamColor,
} from "../types/game";
import { getRandomTheme, drawWordsForTheme } from "../data/word-bank";
import { randomUUID, randomInt } from "crypto";
import { AsyncLocalStorage } from "async_hooks";
import fs from "fs";
import path from "path";

interface StoreData {
  rooms: Record<string, Room>;
  sessions: Record<string, { roomCode: string; playerId: string }>;
  messages: Record<string, Message[]>;
  moleVerifications: Record<string, MoleVerification[]>;
  challenges: Record<string, MoleChallenge[]>;
}

const storeLockContext = new AsyncLocalStorage<string>();

// File-backed game store for local development & multi-worker test execution
export class GameStore {
  private dataDir: string;
  private filePath: string;
  private redis: Redis | null = null;
  private mutex: Promise<void> = Promise.resolve();

  constructor(customDataDir?: string, customRedis?: Redis | null) {
    this.dataDir = customDataDir || path.join(process.cwd(), ".data");
    this.filePath = path.join(this.dataDir, "game-store.json");

    if (customRedis !== undefined) {
      this.redis = customRedis;
      if (!this.redis) {
        this.ensureFile();
      }
    } else {
      const useLocal = process.env.USE_LOCAL_STORE === "true";
      const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
      const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

      if (!useLocal && redisUrl && redisToken) {
        this.redis = new Redis({
          url: redisUrl,
          token: redisToken,
        });
        console.log("[GameStore] Active Engine: Upstash Redis (Distributed HA)");
      } else {
        this.ensureFile();
        console.log("[GameStore] Active Engine: Local File (.data/game-store.json)");
      }
    }
  }

  private async acquireRedisLock(lockKey: string, lockVal: string, timeoutMs: number = 5000): Promise<boolean> {
    if (!this.redis) return true;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await this.redis.set(lockKey, lockVal, { nx: true, px: 10000 });
        if (res === "OK") return true;
      } catch (err: any) {
        console.error("[GameStore] Redis lock acquisition error", err);
        if (err?.message?.includes("max requests limit exceeded")) {
          console.warn("[GameStore] Upstash Redis quota exceeded. Falling back to local store engine.");
          this.redis = null;
          this.ensureFile();
          return true;
        }
        return false;
      }
      await new Promise((r) => setTimeout(r, 40));
    }
    return false;
  }

  private async releaseRedisLock(lockKey: string, lockVal: string): Promise<void> {
    if (!this.redis) return;
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await this.redis.eval(script, [lockKey], [lockVal]);
    } catch (err) {
      console.error("[GameStore] Redis lock release error", err);
    }
  }

  public async withLock<T>(fn: () => Promise<T>, options?: { skipRedis?: boolean }): Promise<T> {
    const existingLockId = storeLockContext.getStore();
    if (existingLockId) {
      return await fn();
    }

    let release: () => void;
    const nextLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const currentLock = this.mutex;
    this.mutex = nextLock;
    await currentLock;

    const lockKey = "subterfuge:store_lock";
    const lockVal = randomUUID();
    let redisLocked = false;
    if (this.redis && !options?.skipRedis) {
      try {
        redisLocked = await this.acquireRedisLock(lockKey, lockVal, 4000);
      } catch (err) {
        release!();
        throw err;
      }
      if (!redisLocked) {
        release!();
        throw new Error("STORE_BUSY: Could not acquire the distributed store lock. Retry the request.");
      }
    }

    try {
      return await storeLockContext.run(lockVal, async () => {
        return await fn();
      });
    } finally {
      if (this.redis && redisLocked) {
        try {
          await this.releaseRedisLock(lockKey, lockVal);
        } catch (err) {
          console.warn("[GameStore] Distributed lock release error", err);
        }
      }
      release!();
    }
  }


  private ensureFile(): void {
    if (this.redis) return;
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      const initial: StoreData = {
        rooms: {},
        sessions: {},
        messages: {},
        moleVerifications: {},
        challenges: {},
      };
      fs.writeFileSync(this.filePath, JSON.stringify(initial, null, 2), "utf-8");
    }
  }

  private async load(): Promise<StoreData> {
    if (this.redis) {
      try {
        const data = await this.redis.get<StoreData>("subterfuge:store");
        if (data) {
          if (!data.rooms) data.rooms = {};
          if (!data.sessions) data.sessions = {};
          if (!data.messages) data.messages = {};
          if (!data.moleVerifications) data.moleVerifications = {};
          if (!data.challenges) data.challenges = {};
          return data;
        }
      } catch (err: any) {
        console.error("[GameStore] Redis load error, falling back to local file store", err);
        if (err?.message?.includes("max requests limit exceeded")) {
          this.redis = null;
          this.ensureFile();
          return this.load();
        }
      }
      return { rooms: {}, sessions: {}, messages: {}, moleVerifications: {}, challenges: {} };
    }

    this.ensureFile();
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (!parsed.rooms) parsed.rooms = {};
      if (!parsed.sessions) parsed.sessions = {};
      if (!parsed.messages) parsed.messages = {};
      if (!parsed.moleVerifications) parsed.moleVerifications = {};
      if (!parsed.challenges) parsed.challenges = {};
      return parsed;
    } catch {
      return { rooms: {}, sessions: {}, messages: {}, moleVerifications: {}, challenges: {} };
    }
  }

  private async save(data: StoreData): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.set("subterfuge:store", data, { ex: 172800 });
        return;
      } catch (err: any) {
        console.error("[GameStore] Redis save error", err);
        if (err?.message?.includes("max requests limit exceeded")) {
          this.redis = null;
          this.ensureFile();
          return this.save(data);
        }
      }
      return;
    }

    this.ensureFile();
    const tmpPath = `${this.filePath}.tmp.${randomUUID()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmpPath, this.filePath);
  }

  public generateRoomCode(): string {
    // Jackbox standard: unambiguous consonants and digits (no vowels, no 0/O, 1/I/L)
    const chars = "BCDFGHJKMNPQRSTVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(randomInt(0, chars.length));
    }
    return code;
  }

  public async createRoom(params: {
    hostName: string;
    sessionToken: string;
    durationHours?: number;
    verdictDurationMinutes?: number;
  }): Promise<{ room: Room; host: Player }> {
    return this.withLock(async () => {
      const data = await this.load();

      let code = this.generateRoomCode();
      while (data.rooms[code]) {
        code = this.generateRoomCode();
      }

      const roomId = randomUUID();
      const hostId = randomUUID();

      const host: Player = {
        id: hostId,
        roomId,
        sessionToken: params.sessionToken,
        displayName: params.hostName.trim(),
        isReady: false,
        isHost: true,
        createdAt: new Date().toISOString(),
      };

      const room: Room = {
        id: roomId,
        code,
        hostId,
        phase: "LOBBY",
        durationHours: params.durationHours || 24,
        verdictDurationMinutes: params.verdictDurationMinutes || 60,
        createdAt: new Date().toISOString(),
        players: [host],
      };

      data.rooms[code.toUpperCase()] = room;
      data.sessions[params.sessionToken] = { roomCode: code.toUpperCase(), playerId: hostId };

      await this.save(data);
      return { room, host };
    });
  }

  public async getRoom(code: string): Promise<Room | undefined> {
    const data = await this.load();
    return data.rooms[code.toUpperCase()];
  }

  public async joinRoom(params: {
    code: string;
    playerName: string;
    sessionToken: string;
  }): Promise<{ room: Room; player: Player }> {
    return this.withLock(async () => {
      const data = await this.load();
      const upperCode = params.code.toUpperCase();
      const room = data.rooms[upperCode];

      if (!room) {
        throw new Error("OPERATION_NOT_FOUND: Invalid room code");
      }

      if (room.phase !== "LOBBY") {
        throw new Error("OPERATION_LOCKED: Game has already commenced");
      }

      if (room.players.length >= 12) {
        throw new Error("CAPACITY_REACHED: Maximum 12 operatives allowed");
      }

      // Check if player is reconnecting with same session token
      let sessionToken = params.sessionToken;
      const existingByToken = room.players.find((p) => p.sessionToken === sessionToken);
      if (existingByToken) {
        if (existingByToken.displayName.toLowerCase() === params.playerName.trim().toLowerCase()) {
          return { room, player: existingByToken };
        }
        // If someone joins with a different name but happens to share a session token,
        // allocate a fresh session token so both players can coexist!
        sessionToken = randomUUID();
      }

      // Check if call-sign is already registered by another operative in this operation
      const existingByName = room.players.find(
        (p) => p.displayName.toLowerCase() === params.playerName.trim().toLowerCase()
      );
      if (existingByName) {
        if (existingByName.sessionToken === params.sessionToken) {
          return { room, player: existingByName };
        }
        throw new Error(
          `OPERATIVE_EXISTS: Call-sign '${params.playerName.trim()}' is already registered in this operation. Please resume using your Personal Recovery Link or choose a distinct call-sign.`
        );
      }

      const playerId = randomUUID();
      const player: Player = {
        id: playerId,
        roomId: room.id,
        sessionToken,
        displayName: params.playerName.trim(),
        isReady: false,
        isHost: false,
        createdAt: new Date().toISOString(),
      };

      room.players.push(player);
      data.sessions[sessionToken] = { roomCode: upperCode, playerId };

      await this.save(data);
      return { room, player };
    });
  }

  public async toggleReady(code: string, playerId?: string, sessionToken?: string): Promise<Player> {
    return this.withLock(async () => {
      const data = await this.load();
      const upperCode = code.toUpperCase();
      const room = data.rooms[upperCode];
      if (!room) throw new Error("Room not found");

      const player = sessionToken
        ? room.players.find((p) => p.sessionToken === sessionToken)
        : room.players.find((p) => p.id === playerId);

      if (!player) throw new Error("Operative not found");

      if (playerId && sessionToken && player.id !== playerId) {
        throw new Error("UNAUTHORIZED: Session token does not match targeted operative");
      }

      player.isReady = !player.isReady;
      await this.save(data);
      return player;
    });
  }

  public async startOperation(code: string, sessionToken: string): Promise<Room> {
    return this.withLock(async () => {
      const data = await this.load();
      const upperCode = code.toUpperCase();
      const room = data.rooms[upperCode];
      if (!room) throw new Error("Room not found");

      const host = room.players.find((p) => p.id === room.hostId);
      if (!host || host.sessionToken !== sessionToken) {
        throw new Error("UNAUTHORIZED: Only the Operation Commander can authorize deployment");
      }

      if (room.phase !== "LOBBY") {
        throw new Error("OPERATION_ALREADY_ACTIVE: Operation is already in progress");
      }

      const n = room.players.length;
      if (n < 6 || n > 12) {
        throw new Error(`INVALID_ROSTER_COUNT: Required 6-12 operatives. Current: ${n}`);
      }

      const allReady = room.players.every((p) => p.isReady);
      if (!allReady) {
        throw new Error("NOT_READY: All operatives must declare readiness before deployment");
      }

      // 1. Shuffle players to randomize team assignments
      const shuffled = [...room.players];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Even split or 50/50 randomized split for odd player counts (e.g. 4 vs 3)
      const isRedLarger = Math.random() < 0.5;
      const redSize = n % 2 === 0 ? n / 2 : (isRedLarger ? Math.ceil(n / 2) : Math.floor(n / 2));
      const redPlayers = shuffled.slice(0, redSize);
      const bluePlayers = shuffled.slice(redSize);

      // Moles per team: 2 moles each at 12 players, otherwise 1 mole each
      const moleCount = n === 12 ? 2 : 1;

      // Assign Red Team:
      // redPlayers[0..moleCount-1] -> Mole (apparent Red, actual Blue)
      // Remaining -> Agent (loyal Red)
      for (let i = 0; i < moleCount; i++) {
        redPlayers[i].apparentTeam = "RED";
        redPlayers[i].actualTeam = "BLUE";
        redPlayers[i].role = "MOLE";
      }

      for (let i = moleCount; i < redPlayers.length; i++) {
        redPlayers[i].apparentTeam = "RED";
        redPlayers[i].actualTeam = "RED";
        redPlayers[i].role = "AGENT";
      }

      // Assign Blue Team:
      // bluePlayers[0..moleCount-1] -> Mole (apparent Blue, actual Red)
      // Remaining -> Agent (loyal Blue)
      for (let i = 0; i < moleCount; i++) {
        bluePlayers[i].apparentTeam = "BLUE";
        bluePlayers[i].actualTeam = "RED";
        bluePlayers[i].role = "MOLE";
      }

      for (let i = moleCount; i < bluePlayers.length; i++) {
        bluePlayers[i].apparentTeam = "BLUE";
        bluePlayers[i].actualTeam = "BLUE";
        bluePlayers[i].role = "AGENT";
      }

      // 2. Select Secret Theme and Draw N unique words
      const theme = getRandomTheme();
      const words = drawWordsForTheme(theme, n);
      room.selectedTheme = theme;
      room.codebook = {};

      // Assign 1 word per player
      for (let i = 0; i < room.players.length; i++) {
        const player = room.players[i];
        const word = words[i];
        player.assignedWord = word;
        player.hasBurnedBriefing = false;
        room.codebook[player.id] = word;
      }

      // 3. Operational Timers
      const now = new Date();
      room.startTime = now.toISOString();
      const durationMs = (room.durationHours || 24) * 60 * 60 * 1000;
      room.midpointTime = new Date(now.getTime() + durationMs / 2).toISOString();
      room.endTime = new Date(now.getTime() + durationMs).toISOString();
      room.phase = "INFILTRATION";
      room.suggestions = { RED: [], BLUE: [] };
      room.draftSlates = {
        RED: { words: [], updatedAt: now.toISOString() },
        BLUE: { words: [], updatedAt: now.toISOString() },
      };

      await this.save(data);
      return room;
    });
  }

  public async getClientGameState(code: string, sessionToken: string): Promise<ClientGameState> {
    let data = await this.load();
    const upperCode = code.toUpperCase();
    let room = data.rooms[upperCode];
    if (!room) throw new Error("Room not found");

    const self = room.players.find((p) => p.sessionToken === sessionToken);
    if (!self) throw new Error("Unauthorized operative session");

    const now = new Date();

    // Check if auto transitions are needed
    const needsVerdictTransition =
      room.phase === "INFILTRATION" &&
      room.endTime &&
      now.getTime() >= new Date(room.endTime).getTime();

    const needsDebriefTransition =
      room.phase === "VERDICT" &&
      room.verdictEndTime &&
      now.getTime() >= new Date(room.verdictEndTime).getTime();

    if (needsVerdictTransition || needsDebriefTransition) {
      await this.withLock(async () => {
        const freshData = await this.load();
        const freshRoom = freshData.rooms[upperCode];
        if (!freshRoom) return;
        const freshNow = new Date();

        if (
          freshRoom.phase === "INFILTRATION" &&
          freshRoom.endTime &&
          freshNow.getTime() >= new Date(freshRoom.endTime).getTime()
        ) {
          freshRoom.phase = "VERDICT";
          const verdictMs = (freshRoom.verdictDurationMinutes || 60) * 60 * 1000;
          freshRoom.verdictEndTime = new Date(freshNow.getTime() + verdictMs).toISOString();
          await this.save(freshData);
        }

        if (
          freshRoom.phase === "VERDICT" &&
          freshRoom.verdictEndTime &&
          freshNow.getTime() >= new Date(freshRoom.verdictEndTime).getTime()
        ) {
          freshRoom.phase = "DEBRIEF";
          const red = freshRoom.verdicts?.["RED"];
          const blue = freshRoom.verdicts?.["BLUE"];
          let redScore = red?.score || 0;
          let blueScore = blue?.score || 0;

          if (redScore === blueScore) {
            if (red?.moleIndictmentId) {
              const indictedByRed = freshRoom.players.find((p) => p.id === red.moleIndictmentId);
              if (indictedByRed && indictedByRed.role === "MOLE") {
                redScore += 20;
                red.score = redScore;
                red.tiebreakerBonus = 20;
              }
            }
            if (blue?.moleIndictmentId) {
              const indictedByBlue = freshRoom.players.find((p) => p.id === blue.moleIndictmentId);
              if (indictedByBlue && indictedByBlue.role === "MOLE") {
                blueScore += 20;
                blue.score = blueScore;
                blue.tiebreakerBonus = 20;
              }
            }
          }

          if (redScore > blueScore) {
            freshRoom.winner = "RED";
          } else if (blueScore > redScore) {
            freshRoom.winner = "BLUE";
          } else {
            freshRoom.winner = "DRAW";
          }

          await this.save(freshData);
        }
      });

      // Reload fresh data after transition
      data = await this.load();
      room = data.rooms[upperCode];
      if (!room) throw new Error("Room not found");
    }

    const isDebrief = room.phase === "DEBRIEF";

    const sanitizedPlayers: SanitizedPlayer[] = room.players.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      apparentTeam: p.apparentTeam,
      isReady: p.isReady,
      isHost: p.isHost,
      hasBurnedBriefing: p.hasBurnedBriefing ?? false,
      actualTeam: isDebrief ? p.actualTeam : undefined,
      role: isDebrief ? p.role : undefined,
      assignedWord: isDebrief ? p.assignedWord : undefined,
    }));

    const midpointPassed =
      room.midpointTime && now.getTime() >= new Date(room.midpointTime).getTime();

    return {
      room: {
        code: room.code,
        phase: room.phase,
        durationHours: room.durationHours,
        verdictDurationMinutes: room.verdictDurationMinutes,
        startTime: room.startTime,
        midpointTime: room.midpointTime,
        endTime: room.endTime,
        verdictEndTime: room.verdictEndTime,
        declassifiedTheme: midpointPassed ? room.selectedTheme : undefined,
        winner: room.winner,
      },
      self: {
        id: self.id,
        sessionToken: self.sessionToken,
        displayName: self.displayName,
        apparentTeam: self.apparentTeam,
        actualTeam: self.actualTeam,
        role: self.role,
        assignedWord: self.assignedWord,
        hasBurnedBriefing: self.hasBurnedBriefing ?? false,
        isReady: self.isReady,
        isHost: self.isHost,
      },
      players: sanitizedPlayers,
      verifiedAssets: (data.moleVerifications[upperCode] || [])
        .filter((v) => v.requesterId === self.id)
        .map((v) => v.moleId),
      incomingChallenges: (data.challenges[upperCode] || [])
        .filter((c) => c.targetId === self.id && c.status === "PENDING")
        .map((c) => ({
          id: c.id,
          requesterId: c.requesterId,
          requesterName: c.requesterName,
          createdAt: c.createdAt,
        })),
      challengeStatuses: (() => {
        const statuses: Record<string, "PENDING" | "ACCEPTED" | "DENIED" | "DECLINED"> = {};
        (data.challenges[upperCode] || [])
          .filter((c) => c.requesterId === self.id)
          .forEach((c) => {
            statuses[c.targetId] = c.status;
          });
        return statuses;
      })(),
      teamSuggestions:
        self.apparentTeam && room.suggestions?.[self.apparentTeam]
          ? [...room.suggestions[self.apparentTeam]].sort((a, b) => b.votes.length - a.votes.length)
          : [],
      draftSlate:
        self.apparentTeam && room.draftSlates?.[self.apparentTeam]
          ? room.draftSlates[self.apparentTeam]
          : { words: [], updatedAt: new Date().toISOString() },
      proposedVerdict:
        self.apparentTeam && room.proposedVerdicts?.[self.apparentTeam]
          ? room.proposedVerdicts[self.apparentTeam]
          : undefined,
      teamVerdict: self.apparentTeam && room.verdicts?.[self.apparentTeam]
        ? room.verdicts[self.apparentTeam]
        : undefined,
      allVerdicts: isDebrief ? room.verdicts : undefined,
      codebook: isDebrief ? room.codebook : undefined,
    };
  }

  public async sendMessage(params: {
    code: string;
    sessionToken: string;
    channelType: ChannelType;
    content: string;
    recipientId?: string;
  }): Promise<Message> {
    return this.withLock(async () => {
      const data = await this.load();
      const upperCode = params.code.toUpperCase();
      const room = data.rooms[upperCode];
      if (!room) throw new Error("Room not found");

      if (room.phase !== "INFILTRATION" && room.phase !== "VERDICT") {
        throw new Error("COMMUNICATIONS_OFFLINE: Transmissions are restricted during current operational phase");
      }

      const sender = room.players.find((p) => p.sessionToken === params.sessionToken);
      if (!sender) throw new Error("UNAUTHORIZED: Invalid operative session credentials");

      const content = params.content.trim();
      if (!content) throw new Error("INVALID_CONTENT: Message transmission cannot be empty");

      // Channel Access Control
      if (params.channelType === "TEAM_RED" && sender.apparentTeam !== "RED") {
        throw new Error("UNAUTHORIZED: Restricted to Red Team frequency");
      }
      if (params.channelType === "TEAM_BLUE" && sender.apparentTeam !== "BLUE") {
        throw new Error("UNAUTHORIZED: Restricted to Blue Team frequency");
      }
      if (params.channelType === "DM") {
        if (!params.recipientId) {
          throw new Error("INVALID_RECIPIENT: Recipient operative must be specified for direct channel");
        }
        const recipient = room.players.find((p) => p.id === params.recipientId);
        if (!recipient) {
          throw new Error("RECIPIENT_NOT_FOUND: Recipient operative not found in operation");
        }
      }

      const message: Message = {
        id: randomUUID(),
        roomId: room.id,
        channelType: params.channelType,
        senderId: sender.id,
        senderName: sender.displayName,
        senderApparentTeam: sender.apparentTeam,
        recipientId: params.recipientId,
        content,
        createdAt: new Date().toISOString(),
      };

      if (!data.messages[upperCode]) {
        data.messages[upperCode] = [];
      }
      data.messages[upperCode].push(message);

      await this.save(data);
      return message;
    });
  }

  public async getMessages(params: {
    code: string;
    sessionToken: string;
    channelType?: ChannelType;
    peerId?: string;
  }): Promise<Message[]> {
    const data = await this.load();
    const upperCode = params.code.toUpperCase();
    const room = data.rooms[upperCode];
    if (!room) throw new Error("Room not found");

    const caller = room.players.find((p) => p.sessionToken === params.sessionToken);
    if (!caller) throw new Error("UNAUTHORIZED: Invalid operative session");

    const allMessages = data.messages[upperCode] || [];

    // Filter messages to only those authorized for caller
    return allMessages.filter((m) => {
      // 1. Channel filter
      if (params.channelType && m.channelType !== params.channelType) {
        return false;
      }

      // Check if caller has burned this message
      if (m.burnedBy && m.burnedBy.includes(caller.id)) {
        return false;
      }

      // 2. Authorization check per message
      if (m.channelType === "PUBLIC") {
        return true;
      }
      if (m.channelType === "TEAM_RED") {
        return caller.apparentTeam === "RED";
      }
      if (m.channelType === "TEAM_BLUE") {
        return caller.apparentTeam === "BLUE";
      }
      if (m.channelType === "DM") {
        const isParticipant = m.senderId === caller.id || m.recipientId === caller.id;
        if (!isParticipant) return false;
        if (params.peerId) {
          return (
            (m.senderId === caller.id && m.recipientId === params.peerId) ||
            (m.senderId === params.peerId && m.recipientId === caller.id)
          );
        }
        return true;
      }
      return false;
    });
  }

  public async burnConversation(params: {
    code: string;
    sessionToken: string;
    peerId: string;
  }): Promise<{ success: boolean; count: number }> {
    return this.withLock(async () => {
      const data = await this.load();
      const upperCode = params.code.toUpperCase();
      const room = data.rooms[upperCode];
      if (!room) throw new Error("Room not found");

      const caller = room.players.find((p) => p.sessionToken === params.sessionToken);
      if (!caller) throw new Error("UNAUTHORIZED: Invalid operative session");

      const allMessages = data.messages[upperCode] || [];
      let burnedCount = 0;

      // Unilateral burn: Mark messages as burned by caller.
      // If all participants have burned the message, delete it permanently from storage.
      data.messages[upperCode] = allMessages.filter((m) => {
        if (m.channelType !== "DM") return true;
        const isBetweenPair =
          (m.senderId === caller.id && m.recipientId === params.peerId) ||
          (m.senderId === params.peerId && m.recipientId === caller.id);

        if (!isBetweenPair) return true;

        if (!m.burnedBy) {
          m.burnedBy = [];
        }
        if (!m.burnedBy.includes(caller.id)) {
          m.burnedBy.push(caller.id);
          burnedCount++;
        }

        // If both participants (sender and recipient) have burned it, prune from storage
        const otherParticipantId = m.senderId === caller.id ? m.recipientId : m.senderId;
        const bothBurned = otherParticipantId && m.burnedBy.includes(otherParticipantId);
        return !bothBurned;
      });

      await this.save(data);
      return { success: true, count: burnedCount };
    });
  }

  public async initiateMoleChallenge(params: {
    code: string;
    sessionToken: string;
    targetPlayerId: string;
  }): Promise<MoleChallenge> {
    return this.withLock(async () => {
      const data = await this.load();
      const upperCode = params.code.toUpperCase();
      const room = data.rooms[upperCode];
      if (!room) throw new Error("Room not found");

      if (room.phase !== "INFILTRATION" && room.phase !== "VERDICT") {
        throw new Error("OPERATION_NOT_ACTIVE: Challenges only permitted during active operation");
      }

      const caller = room.players.find((p) => p.sessionToken === params.sessionToken);
      if (!caller) throw new Error("UNAUTHORIZED: Invalid operative session");

      const target = room.players.find((p) => p.id === params.targetPlayerId);
      if (!target) throw new Error("TARGET_NOT_FOUND: Target operative not found");

      if (caller.id === target.id) {
        throw new Error("INVALID_TARGET: Cannot challenge self");
      }

      if (caller.apparentTeam === target.apparentTeam) {
        throw new Error("INVALID_TARGET: Mole verification challenges are only permitted between operatives on opposing factions");
      }

      if (!data.challenges[upperCode]) {
        data.challenges[upperCode] = [];
      }

      // Check if pending challenge already exists
      const existing = data.challenges[upperCode].find(
        (c) => c.requesterId === caller.id && c.targetId === target.id && c.status === "PENDING"
      );
      if (existing) {
        return existing;
      }

      const challenge: MoleChallenge = {
        id: randomUUID(),
        roomId: room.id,
        requesterId: caller.id,
        requesterName: caller.displayName,
        targetId: target.id,
        targetName: target.displayName,
        status: "PENDING",
        createdAt: new Date().toISOString(),
      };

      data.challenges[upperCode].push(challenge);
      await this.save(data);
      return challenge;
    });
  }

  public async respondMoleChallenge(params: {
    code: string;
    sessionToken: string;
    challengeId: string;
    action: "ACCEPT" | "DENY";
  }): Promise<{ success: boolean; isMole: boolean; message: string }> {
    return this.withLock(async () => {
      const data = await this.load();
      const upperCode = params.code.toUpperCase();
      const room = data.rooms[upperCode];
      if (!room) throw new Error("Room not found");

      const caller = room.players.find((p) => p.sessionToken === params.sessionToken);
      if (!caller) throw new Error("UNAUTHORIZED: Invalid operative session");

      const challenges = data.challenges[upperCode] || [];
      const challenge = challenges.find((c) => c.id === params.challengeId);
      if (!challenge) throw new Error("CHALLENGE_NOT_FOUND: Security challenge not found");

      if (challenge.targetId !== caller.id) {
        throw new Error("UNAUTHORIZED: Challenge target mismatch");
      }

      if (challenge.status !== "PENDING") {
        throw new Error("CHALLENGE_ALREADY_RESOLVED: Challenge has already been processed");
      }

      if (params.action === "DENY") {
        challenge.status = "DECLINED";
        await this.save(data);
        return { success: false, isMole: false, message: "Clearance Declined: Counter-signature declined" };
      }

      const requester = room.players.find((p) => p.id === challenge.requesterId);
      if (!requester) throw new Error("REQUESTER_NOT_FOUND: Challenging operative no longer in room");

      // The core mole check: Target must have role === "MOLE" AND target.actualTeam === requester.actualTeam
      const isAsset = caller.role === "MOLE" && caller.actualTeam === requester.actualTeam;

      if (isAsset) {
        challenge.status = "ACCEPTED";
        if (!data.moleVerifications[upperCode]) {
          data.moleVerifications[upperCode] = [];
        }
        const alreadyVerified = data.moleVerifications[upperCode].some(
          (v) => v.requesterId === requester.id && v.moleId === caller.id
        );
        if (!alreadyVerified) {
          data.moleVerifications[upperCode].push({
            requesterId: requester.id,
            moleId: caller.id,
            moleName: caller.displayName,
            verifiedAt: new Date().toISOString(),
          });
        }
        await this.save(data);
        return { success: true, isMole: true, message: "Operative Verified. Channel Secured." };
      } else {
        challenge.status = "DENIED";
        await this.save(data);
        return { success: false, isMole: false, message: "Clearance Denied: Invalid Counter-Signature" };
      }
    });
  }

  public async getMoleVerifications(code: string, sessionToken: string): Promise<MoleVerification[]> {
    const data = await this.load();
    const upperCode = code.toUpperCase();
    const room = data.rooms[upperCode];
    if (!room) throw new Error("Room not found");

    const caller = room.players.find((p) => p.sessionToken === sessionToken);
    if (!caller) throw new Error("UNAUTHORIZED: Invalid operative session");

    return (data.moleVerifications[upperCode] || []).filter((v) => v.requesterId === caller.id);
  }

  public async warpTimer(params: { code: string; target: "MIDPOINT" | "VERDICT" | "DEBRIEF"; hostSessionToken?: string }): Promise<Room> {
    return this.withLock(async () => {
      const isProduction =
        process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_MUTATORS !== "true";

      if (isProduction) {
        throw new Error("FORBIDDEN: Development mutators are disabled in production");
      }

      const data = await this.load();
      const upperCode = params.code.toUpperCase();
      const room = data.rooms[upperCode];
      if (!room) throw new Error("Room not found");

      if (params.hostSessionToken) {
        const host = room.players.find((p) => p.id === room.hostId);
        if (!host || host.sessionToken !== params.hostSessionToken) {
          throw new Error("FORBIDDEN: Host authorization required");
        }
      }

      const now = new Date();
      const durationMs = (room.durationHours || 24) * 60 * 60 * 1000;

      if (params.target === "MIDPOINT") {
        room.startTime = new Date(now.getTime() - durationMs / 2 - 2000).toISOString();
        room.midpointTime = new Date(now.getTime() - 2000).toISOString();
        room.endTime = new Date(now.getTime() + durationMs / 2 - 2000).toISOString();
      } else if (params.target === "VERDICT") {
        room.startTime = new Date(now.getTime() - durationMs - 2000).toISOString();
        room.midpointTime = new Date(now.getTime() - durationMs / 2).toISOString();
        room.endTime = new Date(now.getTime() - 2000).toISOString();
        room.phase = "VERDICT";
        const verdictMs = (room.verdictDurationMinutes || 60) * 60 * 1000;
        room.verdictEndTime = new Date(now.getTime() + verdictMs).toISOString();
      } else if (params.target === "DEBRIEF") {
        if (room.phase === "LOBBY") {
          throw new Error("CANNOT_WARP: Cannot warp to DEBRIEF before starting operation");
        }
        room.startTime = new Date(now.getTime() - durationMs - 4000).toISOString();
        room.midpointTime = new Date(now.getTime() - durationMs / 2).toISOString();
        room.endTime = new Date(now.getTime() - 4000).toISOString();
        room.verdictEndTime = new Date(now.getTime() - 2000).toISOString();
        room.phase = "DEBRIEF";

        if (!room.verdicts) {
          room.verdicts = { RED: undefined as any, BLUE: undefined as any };
        }

        const allAssignedWords = room.players.map((p) => p.assignedWord).filter(Boolean) as string[];
        const redLead = room.players.find((p) => p.apparentTeam === "RED");
        const blueLead = room.players.find((p) => p.apparentTeam === "BLUE");
        const blueMole = room.players.find((p) => p.actualTeam === "BLUE" && p.role === "MOLE");
        const redMole = room.players.find((p) => p.actualTeam === "RED" && p.role === "MOLE");

        if (!room.verdicts["RED"] && redLead) {
          const proposed = room.proposedVerdicts?.["RED"];
          room.verdicts["RED"] = {
            team: "RED",
            submittedBy: proposed?.proposedBy || redLead.id,
            submittedByName: proposed?.proposedByName || redLead.displayName,
            guesses: proposed?.guesses || allAssignedWords.slice(0, Math.min(room.players.length, allAssignedWords.length)),
            moleIndictmentId: proposed?.moleIndictmentId || redMole?.id,
            moleIndictmentName: proposed?.moleIndictmentName || redMole?.displayName,
            score: allAssignedWords.length,
            correctGuesses: [...allAssignedWords],
            submittedAt: new Date().toISOString(),
            confirmedBy: proposed?.confirmedBy || [redLead.id],
            confirmedByNames: proposed?.confirmedByNames || [redLead.displayName],
          };
        }

        if (!room.verdicts["BLUE"] && blueLead) {
          const proposed = room.proposedVerdicts?.["BLUE"];
          room.verdicts["BLUE"] = {
            team: "BLUE",
            submittedBy: proposed?.proposedBy || blueLead.id,
            submittedByName: proposed?.proposedByName || blueLead.displayName,
            guesses: proposed?.guesses || allAssignedWords.slice(0, Math.min(room.players.length, allAssignedWords.length)),
            moleIndictmentId: proposed?.moleIndictmentId || blueMole?.id,
            moleIndictmentName: proposed?.moleIndictmentName || blueMole?.displayName,
            score: allAssignedWords.length,
            correctGuesses: [...allAssignedWords],
            submittedAt: new Date().toISOString(),
            confirmedBy: proposed?.confirmedBy || [blueLead.id],
            confirmedByNames: proposed?.confirmedByNames || [blueLead.displayName],
          };
        }

        const redScore = room.verdicts["RED"]?.score || 0;
        const blueScore = room.verdicts["BLUE"]?.score || 0;
        if (redScore > blueScore) room.winner = "RED";
        else if (blueScore > redScore) room.winner = "BLUE";
        else room.winner = "DRAW";
      }

      await this.save(data);
      return room;
    });
  }

  public async devFillBots(params: { code: string; hostSessionToken?: string }): Promise<Room> {
    return this.withLock(async () => {
      const isProduction =
        process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_MUTATORS !== "true";

      if (isProduction) {
        throw new Error("FORBIDDEN: Development mutators are disabled in production");
      }

      const data = await this.load();
      const upperCode = params.code.toUpperCase();
      const room = data.rooms[upperCode];
      if (!room) throw new Error("Room not found");

      if (params.hostSessionToken) {
        const host = room.players.find((p) => p.id === room.hostId);
        if (!host || host.sessionToken !== params.hostSessionToken) {
          throw new Error("FORBIDDEN: Host authorization required");
        }
      }

      if (room.phase !== "LOBBY") {
        throw new Error("CANNOT_FILL_BOTS: Can only fill bots in LOBBY phase");
      }

      const botNames = [
        "Agent-Bravo",
        "Agent-Charlie",
        "Agent-Delta",
        "Agent-Echo",
        "Agent-Foxtrot",
        "Agent-Golf",
        "Agent-Hotel",
      ];

      const currentCount = room.players.length;
      const needed = Math.max(0, 6 - currentCount);

      for (let i = 0; i < needed; i++) {
        const existingNames = new Set(room.players.map((p) => p.displayName.toLowerCase()));
        const availableName =
          botNames.find((n) => !existingNames.has(n.toLowerCase())) || `Operative-${Date.now() % 1000}`;
        const botToken = randomUUID();
        const botId = randomUUID();
        const bot: Player = {
          id: botId,
          roomId: room.id,
          sessionToken: botToken,
          displayName: availableName,
          isReady: true,
          isHost: false,
          createdAt: new Date().toISOString(),
        };
        room.players.push(bot);
        data.sessions[botToken] = { roomCode: upperCode, playerId: botId };
      }

      await this.save(data);
      return room;
    });
  }

  public async devResetToLobby(params: { code: string; hostSessionToken?: string }): Promise<Room> {
    return this.withLock(async () => {
      const isProduction =
        process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_MUTATORS !== "true";

      if (isProduction) {
        throw new Error("FORBIDDEN: Development mutators are disabled in production");
      }

      const data = await this.load();
      const upperCode = params.code.toUpperCase();
      const room = data.rooms[upperCode];
      if (!room) throw new Error("Room not found");

      if (params.hostSessionToken) {
        const host = room.players.find((p) => p.id === room.hostId);
        if (!host || host.sessionToken !== params.hostSessionToken) {
          throw new Error("FORBIDDEN: Host authorization required");
        }
      }

      room.phase = "LOBBY";
      room.selectedTheme = undefined;
      room.codebook = undefined;
      room.startTime = undefined;
      room.midpointTime = undefined;
      room.endTime = undefined;
      room.verdictEndTime = undefined;
      room.verdicts = undefined;
      room.proposedVerdicts = undefined;
      room.draftSlates = undefined;
      room.suggestions = undefined;
      room.winner = undefined;

      for (const player of room.players) {
        player.isReady = false;
        player.apparentTeam = undefined;
        player.actualTeam = undefined;
        player.role = undefined;
        player.assignedWord = undefined;
        player.hasBurnedBriefing = false;
      }

      data.messages[upperCode] = [];
      data.challenges[upperCode] = [];
      data.moleVerifications[upperCode] = [];

      await this.save(data);
      return room;
    });
  }

  public async addWordSuggestion(params: {
    code: string;
    sessionToken: string;
    word: string;
  }): Promise<WordSuggestion> {
    return this.withLock(async () => {
      const data = await this.load();
      const upperCode = params.code.toUpperCase();
      const room = data.rooms[upperCode];
      if (!room) throw new Error("Room not found");

      if (room.phase !== "INFILTRATION" && room.phase !== "VERDICT") {
        throw new Error("OPERATION_NOT_ACTIVE: Suggestions only permitted during active operation");
      }

      const caller = room.players.find((p) => p.sessionToken === params.sessionToken);
      if (!caller || !caller.apparentTeam) throw new Error("UNAUTHORIZED: Invalid operative session");

      const cleanWord = params.word.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
      if (!cleanWord) throw new Error("INVALID_WORD: Candidate word must be alphanumeric");

      if (!room.suggestions) {
        room.suggestions = { RED: [], BLUE: [] };
      }
      if (!room.suggestions[caller.apparentTeam]) {
        room.suggestions[caller.apparentTeam] = [];
      }

      // Check if word already suggested
      const existing = room.suggestions[caller.apparentTeam].find(
        (s) => s.word.toUpperCase() === cleanWord
      );
      if (existing) {
        if (!existing.votes.includes(caller.id)) {
          existing.votes.push(caller.id);
        }
        await this.save(data);
        return existing;
      }

      const suggestion: WordSuggestion = {
        id: randomUUID(),
        word: cleanWord,
        suggestedBy: caller.displayName,
        suggestedById: caller.id,
        votes: [caller.id],
        createdAt: new Date().toISOString(),
      };

      room.suggestions[caller.apparentTeam].push(suggestion);
      await this.save(data);
      return suggestion;
    });
  }

  public async voteWordSuggestion(params: {
    code: string;
    sessionToken: string;
    suggestionId: string;
  }): Promise<WordSuggestion> {
    return this.withLock(async () => {
      const data = await this.load();
      const upperCode = params.code.toUpperCase();
      const room = data.rooms[upperCode];
      if (!room) throw new Error("Room not found");

      const caller = room.players.find((p) => p.sessionToken === params.sessionToken);
      if (!caller || !caller.apparentTeam) throw new Error("UNAUTHORIZED: Invalid operative session");

      if (!room.suggestions || !room.suggestions[caller.apparentTeam]) {
        throw new Error("SUGGESTION_NOT_FOUND: No proposals found for team");
      }

      const suggestion = room.suggestions[caller.apparentTeam].find((s) => s.id === params.suggestionId);
      if (!suggestion) throw new Error("SUGGESTION_NOT_FOUND: Proposal not found");

      const voteIdx = suggestion.votes.indexOf(caller.id);
      if (voteIdx >= 0) {
        suggestion.votes.splice(voteIdx, 1);
      } else {
        suggestion.votes.push(caller.id);
      }

      await this.save(data);
      return suggestion;
    });
  }

  public async adoptSlateWord(params: {
    code: string;
    sessionToken: string;
    word: string;
  }): Promise<TeamDraftSlate> {
    return this.withLock(async () => {
      const data = await this.load();
      const upperCode = params.code.toUpperCase();
      const room = data.rooms[upperCode];
      if (!room) throw new Error("Room not found");
      if (room.phase !== "VERDICT") {
        throw new Error("INVALID_PHASE: Draft slate is only active during VERDICT phase");
      }

      const caller = room.players.find((p) => p.sessionToken === params.sessionToken);
      if (!caller || !caller.apparentTeam) throw new Error("UNAUTHORIZED: Invalid operative session");

      const cleanWord = params.word.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
      if (!cleanWord) throw new Error("INVALID_WORD: Word must be alphanumeric");

      if (!room.draftSlates) {
        room.draftSlates = {
          RED: { words: [], updatedAt: new Date().toISOString() },
          BLUE: { words: [], updatedAt: new Date().toISOString() },
        };
      }
      if (!room.draftSlates[caller.apparentTeam]) {
        room.draftSlates[caller.apparentTeam] = { words: [], updatedAt: new Date().toISOString() };
      }

      const slate = room.draftSlates[caller.apparentTeam];
      if (!slate.words.includes(cleanWord)) {
        if (slate.words.length >= room.players.length) {
          throw new Error(`SLATE_FULL: Cannot adopt more than ${room.players.length} words`);
        }
        slate.words.push(cleanWord);
        slate.updatedAt = new Date().toISOString();
        slate.updatedByName = caller.displayName;
      }

      await this.save(data);
      return slate;
    });
  }

  public async removeSlateWord(params: {
    code: string;
    sessionToken: string;
    word: string;
  }): Promise<TeamDraftSlate> {
    return this.withLock(async () => {
      const data = await this.load();
      const upperCode = params.code.toUpperCase();
      const room = data.rooms[upperCode];
      if (!room) throw new Error("Room not found");
      if (room.phase !== "VERDICT") {
        throw new Error("INVALID_PHASE: Draft slate is only active during VERDICT phase");
      }

      const caller = room.players.find((p) => p.sessionToken === params.sessionToken);
      if (!caller || !caller.apparentTeam) throw new Error("UNAUTHORIZED: Invalid operative session");

      const cleanWord = params.word.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");

      if (!room.draftSlates || !room.draftSlates[caller.apparentTeam]) {
        return { words: [], updatedAt: new Date().toISOString() };
      }

      const slate = room.draftSlates[caller.apparentTeam];
      slate.words = slate.words.filter((w) => w.toUpperCase() !== cleanWord);
      slate.updatedAt = new Date().toISOString();
      slate.updatedByName = caller.displayName;

      await this.save(data);
      return slate;
    });
  }

  public async setSlateMoleIndictment(params: {
    code: string;
    sessionToken: string;
    moleIndictmentId?: string;
  }): Promise<TeamDraftSlate> {
    return this.withLock(async () => {
      const data = await this.load();
      const upperCode = params.code.toUpperCase();
      const room = data.rooms[upperCode];
      if (!room) throw new Error("Room not found");
      if (room.phase !== "VERDICT") {
        throw new Error("INVALID_PHASE: Draft slate is only active during VERDICT phase");
      }

      const caller = room.players.find((p) => p.sessionToken === params.sessionToken);
      if (!caller || !caller.apparentTeam) throw new Error("UNAUTHORIZED: Invalid operative session");

      if (!room.draftSlates) {
        room.draftSlates = {
          RED: { words: [], updatedAt: new Date().toISOString() },
          BLUE: { words: [], updatedAt: new Date().toISOString() },
        };
      }
      if (!room.draftSlates[caller.apparentTeam]) {
        room.draftSlates[caller.apparentTeam] = { words: [], updatedAt: new Date().toISOString() };
      }

      const slate = room.draftSlates[caller.apparentTeam];
      if (params.moleIndictmentId) {
        const target = room.players.find((p) => p.id === params.moleIndictmentId);
        if (!target) {
          throw new Error("INVALID_INDICTMENT: Indicted operative not found in room");
        }
        if (target.apparentTeam !== caller.apparentTeam) {
          throw new Error("INVALID_INDICTMENT: Can only indict suspected moles on your own team");
        }
        slate.moleIndictmentId = target.id;
        slate.moleIndictmentName = target.displayName;
      } else {
        slate.moleIndictmentId = undefined;
        slate.moleIndictmentName = undefined;
      }
      slate.updatedAt = new Date().toISOString();
      slate.updatedByName = caller.displayName;

      await this.save(data);
      return slate;
    });
  }

  public async submitTeamVerdict(params: {
    code: string;
    sessionToken: string;
    guesses?: string[];
    moleIndictmentId?: string;
    confirmOnly?: boolean;
  }): Promise<{
    verdict?: TeamVerdict;
    proposedVerdict?: ProposedVerdict;
    room: Room;
    locked: boolean;
    confirmedCount: number;
    requiredCount: number;
  }> {
    return this.withLock(async () => {
      const data = await this.load();
      const upperCode = params.code.toUpperCase();
      const room = data.rooms[upperCode];
      if (!room) throw new Error("Room not found");

      if (room.phase !== "VERDICT") {
        throw new Error("INVALID_PHASE: Verdict submissions are only permitted during the VERDICT phase");
      }

      const caller = room.players.find((p) => p.sessionToken === params.sessionToken);
      if (!caller || !caller.apparentTeam) throw new Error("UNAUTHORIZED: Invalid operative session");

      const team = caller.apparentTeam;
      const n = room.players.length;

      if (!room.proposedVerdicts) {
        room.proposedVerdicts = {};
      }
      if (!room.verdicts) {
        room.verdicts = { RED: undefined as any, BLUE: undefined as any };
      }

      if (room.verdicts[team]) {
        return {
          verdict: room.verdicts[team]!,
          room,
          locked: true,
          confirmedCount: room.verdicts[team]!.confirmedBy?.length || 2,
          requiredCount: 2,
        };
      }

      const effectiveGuesses =
        params.guesses && params.guesses.length > 0
          ? params.guesses
          : room.draftSlates?.[team]?.words || [];
      const effectiveMoleId =
        params.moleIndictmentId !== undefined
          ? params.moleIndictmentId
          : room.draftSlates?.[team]?.moleIndictmentId;

      const existing = room.proposedVerdicts[team];
      const isConfirming = Boolean(params.confirmOnly && existing);

      if (params.confirmOnly && !existing) {
        throw new Error("NO_PROPOSAL_TO_CONFIRM: No pending verdict proposal to confirm");
      }

      if (isConfirming && existing) {
        if (!existing.confirmedBy.includes(caller.id)) {
          existing.confirmedBy.push(caller.id);
          existing.confirmedByNames.push(caller.displayName);
        }

        if (existing.confirmedBy.length >= 2) {
          if (existing.guesses.length !== n) {
            throw new Error(`SLATE_INCOMPLETE: Exactly ${n} code words required for official lock-in (currently ${existing.guesses.length})`);
          }

          // Two teammates agreed: Lock the official team verdict!
          const scoring = this.calculateTeamVerdictScore(
            room,
            team,
            existing.guesses,
            existing.moleIndictmentId
          );

          const verdict: TeamVerdict = {
            team,
            submittedBy: existing.proposedBy,
            submittedByName: existing.proposedByName,
            guesses: existing.guesses,
            moleIndictmentId: existing.moleIndictmentId,
            moleIndictmentName: scoring.moleIndictmentName,
            score: scoring.score,
            enemyExtractionScore: scoring.enemyExtractionScore,
            internalDeductionScore: scoring.internalDeductionScore,
            moleBonusScore: scoring.moleBonusScore,
            correctGuesses: scoring.correctGuesses,
            submittedAt: new Date().toISOString(),
            confirmedBy: existing.confirmedBy,
            confirmedByNames: existing.confirmedByNames,
          };

          room.verdicts[team] = verdict;
          delete room.proposedVerdicts[team];

          // Check if BOTH teams have locked
          const red = room.verdicts["RED"];
          const blue = room.verdicts["BLUE"];

          if (red && blue) {
            const redBase = Math.max(0, (red.enemyExtractionScore || 0) - (red.internalDeductionScore || 0));
            const blueBase = Math.max(0, (blue.enemyExtractionScore || 0) - (blue.internalDeductionScore || 0));
            const redScore = red.score || 0;
            const blueScore = blue.score || 0;

            if (redBase === blueBase && (red.moleBonusScore || 0) !== (blue.moleBonusScore || 0)) {
              if (redScore > blueScore && (red.moleBonusScore || 0) > 0) {
                red.tiebreakerBonus = red.moleBonusScore;
              } else if (blueScore > redScore && (blue.moleBonusScore || 0) > 0) {
                blue.tiebreakerBonus = blue.moleBonusScore;
              }
            }

            if (redScore > blueScore) {
              room.winner = "RED";
            } else if (blueScore > redScore) {
              room.winner = "BLUE";
            } else {
              room.winner = "DRAW";
            }

            room.phase = "DEBRIEF";
          }

          await this.save(data);
          return {
            verdict,
            room,
            locked: true,
            confirmedCount: 2,
            requiredCount: 2,
          };
        } else {
          await this.save(data);
          return {
            proposedVerdict: existing,
            room,
            locked: false,
            confirmedCount: existing.confirmedBy.length,
            requiredCount: 2,
          };
        }
      }

      // New or updated proposal
      const cleanedGuesses: string[] = [];
      for (const g of effectiveGuesses) {
        const clean = g.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
        if (clean && !cleanedGuesses.includes(clean)) {
          cleanedGuesses.push(clean);
        }
      }

      if (cleanedGuesses.length < n) {
        throw new Error(`SLATE_INCOMPLETE: Cannot propose slate until all ${n} code words are adopted (currently ${cleanedGuesses.length})`);
      }

      if (cleanedGuesses.length > n) {
        throw new Error(`GUESS_LIMIT_EXCEEDED: Cannot submit more than ${n} code word guesses`);
      }

      let moleIndictmentName: string | undefined;
      if (effectiveMoleId) {
        const indicted = room.players.find((p) => p.id === effectiveMoleId);
        if (!indicted) {
          throw new Error("INVALID_INDICTMENT: Indicted operative not found in room");
        }
        if (indicted.apparentTeam !== team) {
          throw new Error("INVALID_INDICTMENT: Can only indict suspected moles on your own team");
        }
        moleIndictmentName = indicted.displayName;
      }

      const proposed: ProposedVerdict = {
        team,
        proposedBy: caller.id,
        proposedByName: caller.displayName,
        guesses: cleanedGuesses,
        moleIndictmentId: effectiveMoleId,
        moleIndictmentName,
        proposedAt: new Date().toISOString(),
        confirmedBy: [caller.id],
        confirmedByNames: [caller.displayName],
      };

      room.proposedVerdicts[team] = proposed;
      await this.save(data);

      return {
        proposedVerdict: proposed,
        room,
        locked: false,
        confirmedCount: 1,
        requiredCount: 2,
      };
    });
  }

  public calculateTeamVerdictScore(
    room: Room,
    team: TeamColor,
    guesses: string[],
    moleIndictmentId?: string
  ): {
    score: number;
    enemyExtractionScore: number;
    internalDeductionScore: number;
    moleBonusScore: number;
    correctGuesses: string[];
    moleIndictmentName?: string;
  } {
    const normalize = (w: string) => w.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const guessSet = new Set(guesses.map(normalize));

    const ownTeamPlayers = room.players.filter((p) => p.apparentTeam === team);
    const enemyTeamPlayers = room.players.filter((p) => p.apparentTeam !== team);

    const ownWords = ownTeamPlayers
      .map((p) => p.assignedWord)
      .filter((w): w is string => Boolean(w))
      .map(normalize);
    const enemyWords = enemyTeamPlayers
      .map((p) => p.assignedWord)
      .filter((w): w is string => Boolean(w))
      .map(normalize);

    const enemyFound = enemyWords.filter((w) => guessSet.has(w));
    const enemyExtractionScore = enemyWords.length > 0
      ? Math.round((enemyFound.length / enemyWords.length) * 100)
      : 0;

    const ownFound = ownWords.filter((w) => guessSet.has(w));
    const missedOwnCount = ownWords.length - ownFound.length;
    const internalDeductionScore = missedOwnCount * 20;

    let moleBonusScore = 0;
    let moleIndictmentName: string | undefined;
    if (moleIndictmentId) {
      const indicted = room.players.find((p) => p.id === moleIndictmentId);
      if (indicted) {
        moleIndictmentName = indicted.displayName;
        if (indicted.role === "MOLE") {
          moleBonusScore = 20;
        }
      }
    }

    const baseRating = Math.max(0, enemyExtractionScore - internalDeductionScore);
    const score = baseRating + moleBonusScore;

    const allTargetWords = [...ownWords, ...enemyWords];
    const correctGuesses = guesses.filter((g) => allTargetWords.includes(normalize(g)));

    return {
      score,
      enemyExtractionScore,
      internalDeductionScore,
      moleBonusScore,
      correctGuesses,
      moleIndictmentName,
    };
  }

  public async rematchOperation(code: string, sessionToken: string): Promise<Room> {
    return this.withLock(async () => {
      const data = await this.load();
      const upperCode = code.toUpperCase();
      const room = data.rooms[upperCode];
      if (!room) throw new Error("Room not found");

      const host = room.players.find((p) => p.id === room.hostId);
      if (!host || host.sessionToken !== sessionToken) {
        throw new Error("UNAUTHORIZED: Only the Operation Commander can authorize a rematch");
      }

      room.phase = "LOBBY";
      room.selectedTheme = undefined;
      room.codebook = undefined;
      room.startTime = undefined;
      room.midpointTime = undefined;
      room.endTime = undefined;
      room.verdictEndTime = undefined;
      room.verdicts = undefined;
      room.proposedVerdicts = undefined;
      room.draftSlates = undefined;
      room.suggestions = undefined;
      room.winner = undefined;

      for (const player of room.players) {
        player.isReady = false;
        player.apparentTeam = undefined;
        player.actualTeam = undefined;
        player.role = undefined;
        player.assignedWord = undefined;
        player.hasBurnedBriefing = false;
      }

      data.messages[upperCode] = [];
      data.challenges[upperCode] = [];
      data.moleVerifications[upperCode] = [];

      await this.save(data);
      return room;
    });
  }

  public async leaveRoom(params: {
    code: string;
    sessionToken: string;
  }): Promise<{ success: boolean; roomClosed?: boolean; newHostId?: string }> {
    return this.withLock(async () => {
      const data = await this.load();
      const upperCode = params.code.toUpperCase();
      const room = data.rooms[upperCode];
      if (!room) throw new Error("OPERATION_NOT_FOUND: Room does not exist");
      if (room.phase !== "LOBBY") throw new Error("CANNOT_LEAVE: Operation has already commenced");

      const playerIndex = room.players.findIndex((p) => p.sessionToken === params.sessionToken);
      if (playerIndex === -1) throw new Error("UNAUTHORIZED: Operative not in room");

      const leavingPlayer = room.players[playerIndex];
      room.players.splice(playerIndex, 1);

      // If leaving player was host, migrate host to oldest remaining player or delete room if empty
      if (room.hostId === leavingPlayer.id) {
        if (room.players.length > 0) {
          room.hostId = room.players[0].id;
          room.players[0].isHost = true;
          await this.save(data);
          return { success: true, newHostId: room.hostId };
        } else {
          delete data.rooms[upperCode];
          await this.save(data);
          return { success: true, roomClosed: true };
        }
      }

      await this.save(data);
      return { success: true };
    });
  }

  public async kickPlayer(params: {
    code: string;
    hostSessionToken: string;
    targetPlayerId: string;
  }): Promise<{ success: boolean }> {
    return this.withLock(async () => {
      const data = await this.load();
      const upperCode = params.code.toUpperCase();
      const room = data.rooms[upperCode];
      if (!room) throw new Error("OPERATION_NOT_FOUND: Room does not exist");
      if (room.phase !== "LOBBY") throw new Error("CANNOT_KICK: Operation has already commenced");

      const host = room.players.find((p) => p.sessionToken === params.hostSessionToken);
      if (!host || host.id !== room.hostId) {
        throw new Error("UNAUTHORIZED: Only the Operation Commander can dismiss operatives");
      }

      if (params.targetPlayerId === room.hostId) {
        throw new Error("CANNOT_KICK_HOST: Operation Commander cannot be dismissed");
      }

      const targetIndex = room.players.findIndex((p) => p.id === params.targetPlayerId);
      if (targetIndex === -1) throw new Error("OPERATIVE_NOT_FOUND: Operative not found in roster");

      room.players.splice(targetIndex, 1);
      await this.save(data);
      return { success: true };
    });
  }

  public async burnBriefing(params: {
    code: string;
    sessionToken: string;
    codeword: string;
  }): Promise<{ success: boolean; player: Player }> {
    return this.withLock(async () => {
      const data = await this.load();
      const upperCode = params.code.toUpperCase();
      const room = data.rooms[upperCode];
      if (!room) throw new Error("Room not found");

      const player = room.players.find((p) => p.sessionToken === params.sessionToken);
      if (!player) throw new Error("Unauthorized operative session");

      if (!player.assignedWord) {
        throw new Error("INVALID_STATE: Operative has no assigned code word");
      }

      const inputWord = (params.codeword || "").trim().toUpperCase();
      const assignedWord = player.assignedWord.trim().toUpperCase();

      if (!inputWord || inputWord !== assignedWord) {
        throw new Error("INVALID_CODEWORD: Entered code word does not match operative assignment");
      }

      player.hasBurnedBriefing = true;
      await this.save(data);
      return { success: true, player };
    });
  }

  public async reset(): Promise<void> {
    return this.withLock(async () => {
      const initial: StoreData = {
        rooms: {},
        sessions: {},
        messages: {},
        moleVerifications: {},
        challenges: {},
      };
      await this.save(initial);
    });
  }
}

export const gameStore = new GameStore();
