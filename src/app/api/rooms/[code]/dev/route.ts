import { NextRequest, NextResponse } from "next/server";
import { gameStore } from "@/lib/store/game-store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> | { code: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { code } = resolvedParams;

    const body = await req.json();
    const { action } = body;

    if (action === "fill_bots") {
      const room = await gameStore.devFillBots({ code });
      return NextResponse.json({ success: true, playersCount: room.players.length });
    }

    if (action === "reset_lobby") {
      const room = await gameStore.devResetToLobby({ code });
      return NextResponse.json({ success: true, phase: room.phase });
    }

    if (action === "god_mode") {
      const room = await gameStore.getRoom(code);
      if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

      const godData = room.players.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        apparentTeam: p.apparentTeam,
        actualTeam: p.actualTeam,
        role: p.role,
        assignedWord: p.assignedWord,
      }));

      return NextResponse.json({
        success: true,
        selectedTheme: room.selectedTheme,
        codebook: room.codebook,
        players: godData,
      });
    }

    return NextResponse.json({ error: "INVALID_DEV_ACTION" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
