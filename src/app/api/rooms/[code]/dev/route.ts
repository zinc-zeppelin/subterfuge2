import { NextRequest, NextResponse } from "next/server";
import { gameStore } from "@/lib/store/game-store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const isProduction =
      process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_MUTATORS !== "true";

    if (isProduction) {
      return NextResponse.json(
        { error: "FORBIDDEN: Development routes are disabled in production" },
        { status: 403 }
      );
    }

    const { code } = await params;

    const sessionToken =
      req.headers.get("x-session-token") ||
      req.cookies.get("subterfuge_session")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: Missing session token" },
        { status: 401 }
      );
    }

    const room = await gameStore.getRoom(code);
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const host = room.players.find((p) => p.id === room.hostId);
    if (!host || host.sessionToken !== sessionToken) {
      return NextResponse.json(
        { error: "FORBIDDEN: Host authorization required for dev controls" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === "fill_bots") {
      const updatedRoom = await gameStore.devFillBots({ code, hostSessionToken: sessionToken });
      return NextResponse.json({ success: true, playersCount: updatedRoom.players.length });
    }

    if (action === "reset_lobby") {
      const updatedRoom = await gameStore.devResetToLobby({ code, hostSessionToken: sessionToken });
      return NextResponse.json({ success: true, phase: updatedRoom.phase });
    }

    if (action === "god_mode") {
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
    const status = error.message.includes("FORBIDDEN") || error.message.includes("UNAUTHORIZED")
      ? 403
      : error.message.includes("not found")
      ? 404
      : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
