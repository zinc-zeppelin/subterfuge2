import { NextRequest, NextResponse } from "next/server";
import { gameStore } from "@/lib/store/game-store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const sessionToken =
      req.headers.get("x-session-token") ||
      req.cookies.get("subterfuge_session")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: Missing operative session credentials" },
        { status: 401 }
      );
    }

    let durationHours: number | undefined = undefined;
    try {
      const body = await req.json();
      if (body && body.durationHours !== undefined) {
        const parsed = Number(body.durationHours);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 24) {
          return NextResponse.json(
            { error: "INVALID_DURATION: Mission duration must be an integer between 1 and 24 hours" },
            { status: 400 }
          );
        }
        durationHours = parsed;
      }
    } catch {
      // Empty or non-JSON body is valid
    }

    const room = await gameStore.startOperation(code, sessionToken, { durationHours });
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
