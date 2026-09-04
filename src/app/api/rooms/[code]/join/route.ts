import { NextRequest, NextResponse } from "next/server";
import { gameStore } from "@/lib/store/game-store";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const body = await req.json();
    const { playerName } = body;

    if (!playerName || typeof playerName !== "string" || playerName.trim().length === 0) {
      return NextResponse.json(
        { error: "Operative call-sign is required" },
        { status: 400 }
      );
    }

    let sessionToken = req.headers.get("x-session-token");
    if (!sessionToken) {
      sessionToken = req.cookies.get("subterfuge_session")?.value || randomUUID();
    }

    const { room, player } = gameStore.joinRoom({
      code,
      playerName,
      sessionToken,
    });

    const response = NextResponse.json({
      roomCode: room.code,
      playerId: player.id,
      sessionToken,
    });

    response.cookies.set("subterfuge_session", sessionToken, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    const status = error.message.includes("NOT_FOUND")
      ? 404
      : error.message.includes("LOCKED") || error.message.includes("CAPACITY")
      ? 400
      : 500;

    return NextResponse.json({ error: error.message }, { status });
  }
}
