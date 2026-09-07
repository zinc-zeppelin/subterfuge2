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
        { error: "UNAUTHORIZED: Missing session token" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { targetPlayerId } = body;

    if (!targetPlayerId) {
      return NextResponse.json(
        { error: "INVALID_REQUEST: targetPlayerId required" },
        { status: 400 }
      );
    }

    const challenge = await gameStore.initiateMoleChallenge({
      code,
      sessionToken,
      targetPlayerId,
    });

    return NextResponse.json({ success: true, challenge });
  } catch (error: any) {
    const status = error.message.includes("UNAUTHORIZED") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
