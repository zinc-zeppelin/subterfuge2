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
    const { guesses, moleIndictmentId } = body;

    if (!Array.isArray(guesses)) {
      return NextResponse.json(
        { error: "INVALID_REQUEST: guesses must be an array of code words" },
        { status: 400 }
      );
    }

    const result = await gameStore.submitTeamVerdict({
      code,
      sessionToken,
      guesses,
      moleIndictmentId,
    });

    const isDebrief = result.room.phase === "DEBRIEF";
    const sanitizedVerdict = {
      team: result.verdict.team,
      submittedByName: result.verdict.submittedByName,
      guesses: result.verdict.guesses,
      submittedAt: result.verdict.submittedAt,
      score: isDebrief ? result.verdict.score : undefined,
      correctGuesses: isDebrief ? result.verdict.correctGuesses : undefined,
    };

    return NextResponse.json({ success: true, verdict: sanitizedVerdict });
  } catch (error: any) {
    const status = error.message.includes("UNAUTHORIZED") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
