import { Room, Player, ClientGameState, SanitizedPlayer } from "../types/game";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

interface StoreData {
  rooms: Record<string, Room>;
  sessions: Record<string, { roomCode: string; playerId: string }>;
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
      const initial: StoreData = { rooms: {}, sessions: {} };
      fs.writeFileSync(this.filePath, JSON.stringify(initial, null, 2), "utf-8");
    }
  }

  private load(): StoreData {
    this.ensureFile();
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return { rooms: {}, sessions: {} };
    }
  }

  private save(data: StoreData): void {
    this.ensureFile();
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
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

    return {
      room: {
        code: room.code,
        phase: room.phase,
        durationHours: room.durationHours,
        verdictDurationMinutes: room.verdictDurationMinutes,
        startTime: room.startTime,
        midpointTime: room.midpointTime,
        endTime: room.endTime,
        declassifiedTheme: undefined,
      },
      self: {
        id: self.id,
        displayName: self.displayName,
        apparentTeam: self.apparentTeam,
        actualTeam: self.actualTeam,
        role: self.role,
        isReady: self.isReady,
        isHost: self.isHost,
      },
      players: sanitizedPlayers,
    };
  }

  public reset(): void {
    const initial: StoreData = { rooms: {}, sessions: {} };
    this.save(initial);
  }
}

export const gameStore = new GameStore();
