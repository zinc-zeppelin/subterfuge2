import { NextRequest, NextResponse } from "next/server";
import { gameStore } from "@/lib/store/game-store";

/**
 * Handles updating room configuration settings (such as mission duration) for the room host.
 *
 * @param req - Next.js request containing operative credentials and settings payload.
 * @param context - Route context containing the room code promise.
 * @returns JSON response with updated room settings or error message.
 */
async function handleUpdateSettings(
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

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD: JSON body required" },
        { status: 400 }
      );
    }

    const { durationHours } = body;
    if (durationHours !== undefined) {
      const parsed = Number(durationHours);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 24) {
        return NextResponse.json(
          { error: "INVALID_DURATION: Mission duration must be an integer between 1 and 24 hours" },
          { status: 400 }
        );
      }
    }

    const room = await gameStore.updateRoomSettings(code, sessionToken, {
      durationHours: durationHours !== undefined ? Number(durationHours) : undefined,
    });

    return NextResponse.json({
      success: true,
      room: {
        code: room.code,
        phase: room.phase,
        durationHours: room.durationHours,
      },
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

/**
 * PATCH handler for updating room configuration settings in the lobby.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  return handleUpdateSettings(req, context);
}

/**
 * POST handler for updating room configuration settings in the lobby.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  return handleUpdateSettings(req, context);
}
