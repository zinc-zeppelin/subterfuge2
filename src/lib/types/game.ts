export type GamePhase =
  | "LOBBY"
  | "SETUP"
  | "INFILTRATION"
  | "VERDICT"
  | "DEBRIEF";

export type TeamColor = "RED" | "BLUE";

export type PlayerRole = "SPYMASTER" | "AGENT" | "MOLE";

export type ChannelType = "PUBLIC" | "TEAM_RED" | "TEAM_BLUE" | "DM";

export interface Message {
  id: string;
  roomId: string;
  channelType: ChannelType;
  senderId: string;
  senderName: string;
  senderApparentTeam?: TeamColor;
  recipientId?: string; // Only for DMs
  content: string;
  createdAt: string;
}

export interface Player {
  id: string;
  roomId: string;
  sessionToken: string;
  displayName: string;
  apparentTeam?: TeamColor;
  actualTeam?: TeamColor;
  role?: PlayerRole;
  assignedWord?: string;
  isReady: boolean;
  isHost: boolean;
  createdAt: string;
}

/**
 * Public/Sanitized view of a player sent to clients
 * Prevents client-side state inspection of opposing roles or moles!
 */
export interface SanitizedPlayer {
  id: string;
  displayName: string;
  apparentTeam?: TeamColor;
  isReady: boolean;
  isHost: boolean;
  // Revealed only in DEBRIEF phase
  actualTeam?: TeamColor;
  role?: PlayerRole;
}

export interface MoleChallenge {
  id: string;
  roomId: string;
  requesterId: string;
  requesterName: string;
  targetId: string;
  targetName: string;
  status: "PENDING" | "ACCEPTED" | "DENIED";
  createdAt: string;
}

export interface MoleVerification {
  requesterId: string;
  moleId: string;
  moleName: string;
  verifiedAt: string;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  phase: GamePhase;
  durationHours: number;
  verdictDurationMinutes: number;
  selectedTheme?: string;
  startTime?: string;
  midpointTime?: string;
  endTime?: string;
  verdictEndTime?: string;
  createdAt: string;
  players: Player[];
  codebook?: Record<string, string>; // playerId -> assignedWord
}

export interface ClientGameState {
  room: {
    code: string;
    phase: GamePhase;
    durationHours: number;
    verdictDurationMinutes: number;
    startTime?: string;
    midpointTime?: string;
    endTime?: string;
    verdictEndTime?: string;
    declassifiedTheme?: string; // only populated after midpoint
  };
  self: {
    id: string;
    displayName: string;
    apparentTeam?: TeamColor;
    actualTeam?: TeamColor;
    role?: PlayerRole;
    assignedWord?: string;
    isReady: boolean;
    isHost: boolean;
  };
  players: SanitizedPlayer[];
  verifiedAssets?: string[]; // IDs of operatives verified as moles by self
  incomingChallenges?: {
    id: string;
    requesterId: string;
    requesterName: string;
    createdAt: string;
  }[];
  challengeStatuses?: Record<string, "PENDING" | "ACCEPTED" | "DENIED">; // targetId -> status
}
