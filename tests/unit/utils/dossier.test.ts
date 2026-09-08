import { describe, it, expect } from "vitest";
import { generateMissionDossierText } from "@/lib/utils/dossier";

describe("Classified Mission Dossier Generator", () => {
  it("formats victorious Red squad debriefing with unmasked moles and share link", () => {
    const text = generateMissionDossierText({
      roomCode: "H5BSZ9",
      winner: "RED",
      declassifiedTheme: "DANCE",
      operativeName: "Falcon-Commander",
      apparentTeam: "RED",
      actualTeam: "RED",
      role: "AGENT",
      redScore: 80,
      blueScore: 40,
      unmaskedMoles: [
        {
          displayName: "Ghost-Traitor",
          apparentTeam: "BLUE",
          actualTeam: "RED",
        },
      ],
    });

    expect(text).toContain("OPERATION CODE: #H5BSZ9");
    expect(text).toContain("OUTCOME: CRIMSON PACT VICTORY (RED FACTION)");
    expect(text).toContain("DECLASSIFIED THEME: DANCE");
    expect(text).toContain("OPERATIVE: Falcon-Commander (RED SQUAD COVER)");
    expect(text).toContain("STATUS: MISSION ACCOMPLISHED (VICTORY)");
    expect(text).toContain("🔴 RED SQUAD: 80%");
    expect(text).toContain("🔵 BLUE SQUAD: 40%");
    expect(text).toContain("• Ghost-Traitor (Cover: BLUE, True Loyalty: RED)");
    expect(text).toContain("https://playsubterfuge.com/room/H5BSZ9");
  });

  it("accurately attributes victory for an embedded mole whose actual team won", () => {
    // Operative wore RED cover, but actual loyalty was BLUE. BLUE won!
    const text = generateMissionDossierText({
      roomCode: "M7XP21",
      winner: "BLUE",
      declassifiedTheme: "ASTRONOMY",
      operativeName: "Specter-Infiltrator",
      apparentTeam: "RED",
      actualTeam: "BLUE",
      role: "MOLE",
      redScore: 20,
      blueScore: 90,
      unmaskedMoles: [
        {
          displayName: "Specter-Infiltrator",
          apparentTeam: "RED",
          actualTeam: "BLUE",
        },
      ],
      baseUrl: "http://localhost:3000",
    });

    expect(text).toContain("OUTCOME: COBALT SYNDICATE VICTORY (BLUE FACTION)");
    expect(text).toContain("OPERATIVE: Specter-Infiltrator (RED SQUAD COVER)");
    expect(text).toContain("TRUE ALLEGIANCE: BLUE (EMBEDDED MOLE)");
    expect(text).toContain("STATUS: MISSION ACCOMPLISHED (VICTORY)");
    expect(text).toContain("http://localhost:3000/room/M7XP21");
  });

  it("handles operational draw / stalemate without error", () => {
    const text = generateMissionDossierText({
      roomCode: "DRAW01",
      winner: "DRAW",
      declassifiedTheme: "ESPIONAGE",
      operativeName: "Viper-Agent",
      apparentTeam: "BLUE",
      actualTeam: "BLUE",
      role: "AGENT",
      redScore: 60,
      blueScore: 60,
      unmaskedMoles: [],
    });

    expect(text).toContain("https://playsubterfuge.com/room/DRAW01");
    expect(text).toContain("OUTCOME: OPERATIONAL DRAW // STALEMATE");
    expect(text).toContain("STATUS: OPERATIONAL STALEMATE");
    expect(text).toContain("None identified");
    expect(text).toContain("🔴 RED SQUAD: 60%");
    expect(text).toContain("🔵 BLUE SQUAD: 60%");
  });
});
