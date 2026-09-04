import { NextRequest, NextResponse } from "next/server";
import { gameStore } from "@/lib/store/game-store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> | { code: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { code } = resolvedParams;

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
    const { challengeId, action } = body;

    if (!challengeId) {
      return NextResponse.json(
        { error: "INVALID_REQUEST: challengeId required" },
        { status: 400 }
      );
    }

    const result = gameStore.respondMoleChallenge({
      code,
      sessionToken,
      challengeId,
      action: action === "DENY" ? "DENY" : "ACCEPT",
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.message.includes("UNAUTHORIZED") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
