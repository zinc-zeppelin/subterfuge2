export type GamePhase =
  | "LOBBY"
  | "SETUP"
  | "INFILTRATION"
  | "VERDICT"
  | "DEBRIEF";

export type TeamColor = "RED" | "BLUE";

export type PlayerRole = "AGENT" | "MOLE";

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
  burnedBy?: string[]; // Player IDs who have burned this message
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
  hasBurnedBriefing?: boolean;
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
  hasBurnedBriefing?: boolean;
  // Revealed only in DEBRIEF phase
  actualTeam?: TeamColor;
  role?: PlayerRole;
  assignedWord?: string;
}

export interface MoleChallenge {
  id: string;
  roomId: string;
  requesterId: string;
  requesterName: string;
  targetId: string;
  targetName: string;
  status: "PENDING" | "ACCEPTED" | "DENIED" | "DECLINED";
  createdAt: string;
}

export interface MoleVerification {
  requesterId: string;
  moleId: string;
  moleName: string;
  verifiedAt: string;
}

export interface WordSuggestion {
  id: string;
  word: string;
  suggestedBy: string;
  suggestedById: string;
  votes: string[]; // player IDs who upvoted
  createdAt: string;
}

export interface ProposedVerdict {
  team: TeamColor;
  proposedBy: string;
  proposedByName: string;
  guesses: string[];
  moleIndictmentId?: string;
  moleIndictmentName?: string;
  proposedAt: string;
  confirmedBy: string[]; // IDs of players who agreed (minimum 2 to lock)
  confirmedByNames: string[];
}

export interface TeamVerdict {
  team: TeamColor;
  submittedBy: string;
  submittedByName: string;
  guesses: string[];
  moleIndictmentId?: string;
  moleIndictmentName?: string;
  score?: number; // Final Mission Rating % (0 - 120%)
  enemyExtractionScore?: number; // % from enemy words
  internalDeductionScore?: number; // % deducted for missed own words
  moleBonusScore?: number; // % bonus from mole indictment (+20%)
  correctGuesses?: string[];
  tiebreakerBonus?: number;
  submittedAt: string;
  confirmedBy?: string[];
  confirmedByNames?: string[];
}

export interface TeamDraftSlate {
  words: string[];
  moleIndictmentId?: string;
  moleIndictmentName?: string;
  updatedAt: string;
  updatedByName?: string;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  phase: GamePhase;
  /**
   * Total mission duration in hours (1-24, default 12).
   */
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
  suggestions?: Record<TeamColor, WordSuggestion[]>;
  draftSlates?: Record<TeamColor, TeamDraftSlate>;
  proposedVerdicts?: Partial<Record<TeamColor, ProposedVerdict>>;
  verdicts?: Partial<Record<TeamColor, TeamVerdict>>;
  winner?: TeamColor | "DRAW";
}

export interface UpdateRoomSettingsParams {
  durationHours?: number;
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
    winner?: TeamColor | "DRAW";
  };
  self: {
    id: string;
    sessionToken: string;
    displayName: string;
    apparentTeam?: TeamColor;
    actualTeam?: TeamColor;
    role?: PlayerRole;
    assignedWord?: string;
    hasBurnedBriefing?: boolean;
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
  challengeStatuses?: Record<string, "PENDING" | "ACCEPTED" | "DENIED" | "DECLINED">; // targetId -> status
  teamSuggestions?: WordSuggestion[];
  draftSlate?: TeamDraftSlate;
  proposedVerdict?: ProposedVerdict;
  teamVerdict?: TeamVerdict;
  allVerdicts?: Partial<Record<TeamColor, TeamVerdict>>; // only in DEBRIEF
  codebook?: Record<string, string>; // only in DEBRIEF
}
