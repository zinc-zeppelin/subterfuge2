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

    if (playerName.trim().length > 20) {
      return NextResponse.json(
        { error: "Operative call-sign cannot exceed 20 characters" },
        { status: 400 }
      );
    }

    let sessionToken = req.headers.get("x-session-token");
    if (!sessionToken) {
      sessionToken = randomUUID();
    }

    const { room, player } = await gameStore.joinRoom({
      code,
      playerName,
      sessionToken,
    });

    const response = NextResponse.json({
      roomCode: room.code,
      playerId: player.id,
      sessionToken: player.sessionToken,
    });

    response.cookies.set("subterfuge_session", player.sessionToken, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    const status = error.message.includes("NOT_FOUND")
      ? 404
      : error.message.includes("OPERATIVE_EXISTS")
      ? 409
      : error.message.includes("LOCKED") || error.message.includes("CAPACITY")
      ? 400
      : 500;

    return NextResponse.json({ error: error.message }, { status });
  }
}
