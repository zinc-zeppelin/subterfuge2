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
        { error: "UNAUTHORIZED: Missing operative session token" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { playerId } = body;

    const player = await gameStore.toggleReady(code, playerId, sessionToken);
    return NextResponse.json({ success: true, isReady: player.isReady });
  } catch (error: any) {
    const status = error.message.includes("UNAUTHORIZED")
      ? 403
      : error.message.includes("not found")
      ? 404
      : 500;

    return NextResponse.json({ error: error.message }, { status });
  }
}
