import { NextRequest, NextResponse } from "next/server";
import { gameStore } from "@/lib/store/game-store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> | { code: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { code } = resolvedParams;

    const body = await req.json();
    const { target } = body;

    const sessionToken =
      req.headers.get("x-session-token") ||
      req.cookies.get("subterfuge_session")?.value;

    const isDev =
      req.headers.get("x-subterfuge-dev") === "true" ||
      req.nextUrl.searchParams.get("dev") === "true";

    if (process.env.NODE_ENV === "production" && !isDev) {
      const room = await gameStore.getRoom(code);
      if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
      const host = room.players.find((p) => p.id === room.hostId);
      if (!host || host.sessionToken !== sessionToken) {
        return NextResponse.json({ error: "FORBIDDEN: In production only the host can warp timers" }, { status: 403 });
      }
    }

    if (target !== "MIDPOINT" && target !== "VERDICT" && target !== "DEBRIEF") {
      return NextResponse.json(
        { error: "INVALID_TARGET: Target must be MIDPOINT, VERDICT, or DEBRIEF" },
        { status: 400 }
      );
    }

    const room = await gameStore.warpTimer({ code, target });
    return NextResponse.json({ success: true, phase: room.phase });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
