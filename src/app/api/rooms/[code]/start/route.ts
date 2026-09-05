import { NextRequest, NextResponse } from "next/server";
import { gameStore } from "@/lib/store/game-store";

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const sessionToken =
      req.headers.get("x-session-token") ||
      req.cookies.get("subterfuge_session")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: Missing operative session credentials" },
        { status: 401 }
      );
    }

    const room = await gameStore.startOperation(code, sessionToken);
    const clientState = await gameStore.getClientGameState(code, sessionToken);

    return NextResponse.json({
      success: true,
      phase: room.phase,
      gameState: clientState,
    });
  } catch (error: any) {
    const status = error.message.includes("UNAUTHORIZED")
      ? 403
      : error.message.includes("not found")
      ? 404
      : 400;

    return NextResponse.json({ error: error.message }, { status });
  }
}
