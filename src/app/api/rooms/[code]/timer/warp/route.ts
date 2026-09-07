import { NextRequest, NextResponse } from "next/server";
import { gameStore } from "@/lib/store/game-store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> | { code: string } }
) {
  try {
    const isProduction =
      process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_MUTATORS !== "true";

    if (isProduction) {
      return NextResponse.json(
        { error: "FORBIDDEN: Timer warp is disabled in production" },
        { status: 403 }
      );
    }

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

    const room = await gameStore.getRoom(code);
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const host = room.players.find((p) => p.id === room.hostId);
    if (!host || host.sessionToken !== sessionToken) {
      return NextResponse.json(
        { error: "FORBIDDEN: Host authorization required to warp timer" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { target } = body;

    if (target !== "MIDPOINT" && target !== "VERDICT" && target !== "DEBRIEF") {
      return NextResponse.json(
        { error: "INVALID_TARGET: Target must be MIDPOINT, VERDICT, or DEBRIEF" },
        { status: 400 }
      );
    }

    const updatedRoom = await gameStore.warpTimer({ code, target, hostSessionToken: sessionToken });
    return NextResponse.json({ success: true, phase: updatedRoom.phase });
  } catch (error: any) {
    const status = error.message.includes("FORBIDDEN") || error.message.includes("UNAUTHORIZED")
      ? 403
      : error.message.includes("not found")
      ? 404
      : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
