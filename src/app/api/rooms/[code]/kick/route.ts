import { NextRequest, NextResponse } from "next/server";
import { gameStore } from "@/lib/store/game-store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await req.json();
    const { targetPlayerId } = body;

    const sessionToken =
      body.sessionToken ||
      req.headers.get("x-session-token") ||
      req.cookies.get("subterfuge_session")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: Missing host credentials" },
        { status: 401 }
      );
    }

    if (!targetPlayerId) {
      return NextResponse.json(
        { error: "Target operative ID is required" },
        { status: 400 }
      );
    }

    const result = await gameStore.kickPlayer({
      code,
      hostSessionToken: sessionToken,
      targetPlayerId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.message.includes("UNAUTHORIZED")
      ? 403
      : error.message.includes("NOT_FOUND")
      ? 404
      : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
