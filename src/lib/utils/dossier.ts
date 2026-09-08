/**
 * Utility functions for generating shareable classified mission dossiers.
 */

export interface DossierShareParams {
  roomCode: string;
  winner?: "RED" | "BLUE" | "DRAW";
  declassifiedTheme?: string;
  operativeName: string;
  apparentTeam: "RED" | "BLUE";
  actualTeam?: "RED" | "BLUE";
  role?: "AGENT" | "MOLE";
  redScore: number;
  blueScore: number;
  unmaskedMoles: Array<{
    displayName: string;
    apparentTeam: "RED" | "BLUE";
    actualTeam: "RED" | "BLUE";
  }>;
  baseUrl?: string;
}

export function generateMissionDossierText(params: DossierShareParams): string {
  const hostUrl = params.baseUrl || "https://playsubterfuge.com";
  const winnerText =
    params.winner === "RED"
      ? "CRIMSON PACT VICTORY (RED FACTION)"
      : params.winner === "BLUE"
      ? "COBALT SYNDICATE VICTORY (BLUE FACTION)"
      : "OPERATIONAL DRAW // STALEMATE";

  const isVictorious =
    params.winner !== "DRAW" && params.actualTeam === params.winner;
  const statusText =
    params.winner === "DRAW"
      ? "OPERATIONAL STALEMATE"
      : isVictorious
      ? "MISSION ACCOMPLISHED (VICTORY)"
      : "MISSION COMPROMISED (DEFEAT)";

  const unmaskedMolesText =
    params.unmaskedMoles.length > 0
      ? params.unmaskedMoles
          .map(
            (m) =>
              `• ${m.displayName} (Cover: ${m.apparentTeam}, True Loyalty: ${m.actualTeam})`
          )
          .join("\n")
      : "None identified";

  return [
    "🕵️ PROJECT SUBTERFUGE // CLASSIFIED MISSION DEBRIEF",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `OPERATION CODE: #${params.roomCode}`,
    `OUTCOME: ${winnerText}`,
    `DECLASSIFIED THEME: ${params.declassifiedTheme || "CLASSIFIED"}`,
    "",
    `OPERATIVE: ${params.operativeName} (${params.apparentTeam} SQUAD COVER)`,
    `TRUE ALLEGIANCE: ${params.actualTeam || params.apparentTeam} (${
      params.role === "MOLE" ? "EMBEDDED MOLE" : "FIELD AGENT"
    })`,
    `STATUS: ${statusText}`,
    "",
    "FINAL EFFICIENCY SCORES:",
    `🔴 RED SQUAD: ${params.redScore}%`,
    `🔵 BLUE SQUAD: ${params.blueScore}%`,
    "",
    "UNMASKED TRAITORS:",
    unmaskedMolesText,
    "",
    "Can your squad crack the Cold War code?",
    `Play free with 6-12 friends: ${hostUrl}/room/${params.roomCode}`,
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");
}
