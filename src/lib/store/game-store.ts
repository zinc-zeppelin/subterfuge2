import { Room, Player, ClientGameState, SanitizedPlayer, Message, ChannelType } from "../types/game";
import { getRandomTheme, drawWordsForTheme } from "../data/word-bank";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

interface StoreData {
  rooms: Record<string, Room>;
  sessions: Record<string, { roomCode: string; playerId: string }>;
  messages: Record<string, Message[]>;
}

// File-backed game store for local development & multi-worker test execution
class GameStore {
  private dataDir: string;
  private filePath: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), ".data");
    this.filePath = path.join(this.dataDir, "game-store.json");
    this.ensureFile();
  }

  private ensureFile(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      const initial: StoreData = { rooms: {}, sessions: {}, messages: {} };
      fs.writeFileSync(this.filePath, JSON.stringify(initial, null, 2), "utf-8");
    }
  }

  private load(): StoreData {
    this.ensureFile();
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (!parsed.messages) parsed.messages = {};
      return parsed;
    } catch {
      return { rooms: {}, sessions: {}, messages: {} };
    }
  }

  private save(data: StoreData): void {
    this.ensureFile();
    const tmpPath = `${this.filePath}.tmp.${randomUUID()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmpPath, this.filePath);
  }

  public generateRoomCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public createRoom(params: {
    hostName: string;
    sessionToken: string;
    durationHours?: number;
    verdictDurationMinutes?: number;
  }): { room: Room; host: Player } {
    const data = this.load();

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

    this.save(data);
    return { room, host };
  }

  public getRoom(code: string): Room | undefined {
    const data = this.load();
    return data.rooms[code.toUpperCase()];
  }

  public joinRoom(params: {
    code: string;
    playerName: string;
    sessionToken: string;
  }): { room: Room; player: Player } {
    const data = this.load();
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
    const existing = room.players.find((p) => p.sessionToken === params.sessionToken);
    if (existing) {
      return { room, player: existing };
    }

    const playerId = randomUUID();
    const player: Player = {
      id: playerId,
      roomId: room.id,
      sessionToken: params.sessionToken,
      displayName: params.playerName.trim(),
      isReady: false,
      isHost: false,
      createdAt: new Date().toISOString(),
    };

    room.players.push(player);
    data.sessions[params.sessionToken] = { roomCode: upperCode, playerId };

    this.save(data);
    return { room, player };
  }

  public toggleReady(code: string, playerId?: string, sessionToken?: string): Player {
    const data = this.load();
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
    this.save(data);
    return player;
  }

  public startOperation(code: string, sessionToken: string): Room {
    const data = this.load();
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
    if (n < 4 || n > 12 || n % 2 !== 0) {
      throw new Error(`INVALID_ROSTER_COUNT: Required 4-12 even players. Current: ${n}`);
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

    const half = n / 2;
    const redPlayers = shuffled.slice(0, half);
    const bluePlayers = shuffled.slice(half);

    // Moles per team: 2 moles each at 12 players, otherwise 1 mole each
    const moleCount = n === 12 ? 2 : 1;

    // Assign Red Team:
    // redPlayers[0] -> Spymaster (loyal)
    // redPlayers[1..moleCount] -> Mole (apparent Red, actual Blue)
    // Remaining -> Agent (loyal)
    redPlayers[0].apparentTeam = "RED";
    redPlayers[0].actualTeam = "RED";
    redPlayers[0].role = "SPYMASTER";

    for (let i = 1; i <= moleCount; i++) {
      redPlayers[i].apparentTeam = "RED";
      redPlayers[i].actualTeam = "BLUE";
      redPlayers[i].role = "MOLE";
    }

    for (let i = 1 + moleCount; i < redPlayers.length; i++) {
      redPlayers[i].apparentTeam = "RED";
      redPlayers[i].actualTeam = "RED";
      redPlayers[i].role = "AGENT";
    }

    // Assign Blue Team:
    // bluePlayers[0] -> Spymaster (loyal)
    // bluePlayers[1..moleCount] -> Mole (apparent Blue, actual Red)
    // Remaining -> Agent (loyal)
    bluePlayers[0].apparentTeam = "BLUE";
    bluePlayers[0].actualTeam = "BLUE";
    bluePlayers[0].role = "SPYMASTER";

    for (let i = 1; i <= moleCount; i++) {
      bluePlayers[i].apparentTeam = "BLUE";
      bluePlayers[i].actualTeam = "RED";
      bluePlayers[i].role = "MOLE";
    }

    for (let i = 1 + moleCount; i < bluePlayers.length; i++) {
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
      room.codebook[player.id] = word;
    }

    // 3. Operational Timers
    const now = new Date();
    room.startTime = now.toISOString();
    const durationMs = (room.durationHours || 24) * 60 * 60 * 1000;
    room.midpointTime = new Date(now.getTime() + durationMs / 2).toISOString();
    room.endTime = new Date(now.getTime() + durationMs).toISOString();
    room.phase = "INFILTRATION";

    this.save(data);
    return room;
  }

  public getClientGameState(code: string, sessionToken: string): ClientGameState {
    const data = this.load();
    const upperCode = code.toUpperCase();
    const room = data.rooms[upperCode];
    if (!room) throw new Error("Room not found");

    const self = room.players.find((p) => p.sessionToken === sessionToken);
    if (!self) throw new Error("Unauthorized operative session");

    const isDebrief = room.phase === "DEBRIEF";

    const sanitizedPlayers: SanitizedPlayer[] = room.players.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      apparentTeam: p.apparentTeam,
      isReady: p.isReady,
      isHost: p.isHost,
      actualTeam: isDebrief ? p.actualTeam : undefined,
      role: isDebrief ? p.role : undefined,
    }));

    const now = new Date();
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
        declassifiedTheme: midpointPassed ? room.selectedTheme : undefined,
      },
      self: {
        id: self.id,
        displayName: self.displayName,
        apparentTeam: self.apparentTeam,
        actualTeam: self.actualTeam,
        role: self.role,
        assignedWord: self.assignedWord,
        isReady: self.isReady,
        isHost: self.isHost,
      },
      players: sanitizedPlayers,
    };
  }

  public sendMessage(params: {
    code: string;
    sessionToken: string;
    channelType: ChannelType;
    content: string;
    recipientId?: string;
  }): Message {
    const data = this.load();
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

    this.save(data);
    return message;
  }

  public getMessages(params: {
    code: string;
    sessionToken: string;
    channelType?: ChannelType;
    peerId?: string;
  }): Message[] {
    const data = this.load();
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

  public burnConversation(params: {
    code: string;
    sessionToken: string;
    peerId: string;
  }): { success: boolean; count: number } {
    const data = this.load();
    const upperCode = params.code.toUpperCase();
    const room = data.rooms[upperCode];
    if (!room) throw new Error("Room not found");

    const caller = room.players.find((p) => p.sessionToken === params.sessionToken);
    if (!caller) throw new Error("UNAUTHORIZED: Invalid operative session");

    const allMessages = data.messages[upperCode] || [];
    const initialCount = allMessages.length;

    data.messages[upperCode] = allMessages.filter((m) => {
      if (m.channelType !== "DM") return true;
      const isBetweenPair =
        (m.senderId === caller.id && m.recipientId === params.peerId) ||
        (m.senderId === params.peerId && m.recipientId === caller.id);
      return !isBetweenPair;
    });

    const deletedCount = initialCount - data.messages[upperCode].length;
    this.save(data);
    return { success: true, count: deletedCount };
  }

  public reset(): void {
    const initial: StoreData = { rooms: {}, sessions: {}, messages: {} };
    this.save(initial);
  }
}

export const gameStore = new GameStore();
