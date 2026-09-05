import { NextRequest, NextResponse } from "next/server";
import { gameStore } from "@/lib/store/game-store";

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const sessionToken =
      req.headers.get("x-session-token") ||
      req.nextUrl.searchParams.get("token") ||
      req.cookies.get("subterfuge_session")?.value;

    if (!sessionToken) {
      const room = await gameStore.getRoom(code);
      if (room) {
        return NextResponse.json(
          {
            error: "NO_SESSION: Missing session credentials",
            phase: room.phase,
            playerCount: room.players.length,
            roomCode: room.code,
          },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: "NO_SESSION: Missing session credentials" },
        { status: 401 }
      );
    }

    const state = await gameStore.getClientGameState(code, sessionToken);
    return NextResponse.json(state);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 : 401;
    return NextResponse.json({ error: error.message }, { status });
  }
}
