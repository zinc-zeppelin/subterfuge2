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
    const { suggestionId } = body;

    if (!suggestionId) {
      return NextResponse.json(
        { error: "INVALID_REQUEST: suggestionId required" },
        { status: 400 }
      );
    }

    const suggestion = await gameStore.voteWordSuggestion({
      code,
      sessionToken,
      suggestionId,
    });

    return NextResponse.json({ success: true, suggestion });
  } catch (error: any) {
    const status = error.message.includes("UNAUTHORIZED") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
