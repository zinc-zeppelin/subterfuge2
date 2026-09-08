import { NextRequest, NextResponse } from "next/server";
import { gameStore } from "@/lib/store/game-store";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { hostName, durationHours, verdictDurationMinutes } = body;

    if (!hostName || typeof hostName !== "string" || hostName.trim().length === 0) {
      return NextResponse.json(
        { error: "Operative call-sign is required" },
        { status: 400 }
      );
    }

    if (hostName.trim().length > 20) {
      return NextResponse.json(
        { error: "Operative call-sign cannot exceed 20 characters" },
        { status: 400 }
      );
    }

    let parsedDuration = 12;
    if (durationHours !== undefined) {
      const num = Number(durationHours);
      if (!Number.isInteger(num) || num < 1 || num > 24) {
        return NextResponse.json(
          { error: "INVALID_DURATION: Mission duration must be an integer between 1 and 24 hours" },
          { status: 400 }
        );
      }
      parsedDuration = num;
    }

    // Extract or generate session token
    let sessionToken = req.headers.get("x-session-token");
    if (!sessionToken) {
      sessionToken = randomUUID();
    }

    const { room, host } = await gameStore.createRoom({
      hostName,
      sessionToken,
      durationHours: parsedDuration,
      verdictDurationMinutes: Number(verdictDurationMinutes) || 60,
    });

    const response = NextResponse.json({
      roomCode: room.code,
      hostId: host.id,
      sessionToken,
    });

    // Set persistent session cookie
    response.cookies.set("subterfuge_session", sessionToken, {
      path: "/",
      httpOnly: false, // Accessible to client-side session handlers
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    const status = error.message?.includes("INVALID_DURATION") ? 400 : 500;
    return NextResponse.json(
      { error: error.message || "Failed to create operation" },
      { status }
    );
  }
}
