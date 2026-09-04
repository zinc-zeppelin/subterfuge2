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
        { error: "UNAUTHORIZED: Missing session token" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { peerId } = body;

    if (!peerId) {
      return NextResponse.json(
        { error: "INVALID_REQUEST: peerId is required" },
        { status: 400 }
      );
    }

    const result = gameStore.burnConversation({
      code,
      sessionToken,
      peerId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.message.includes("UNAUTHORIZED") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
