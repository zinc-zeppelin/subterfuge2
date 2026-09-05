import { NextRequest, NextResponse } from "next/server";
import { gameStore } from "@/lib/store/game-store";

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const body = await req.json().catch(() => ({}));
    const sessionToken =
      body.sessionToken ||
      req.headers.get("x-session-token") ||
      req.cookies.get("subterfuge_session")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: Missing session token" },
        { status: 401 }
      );
    }

    const result = await gameStore.leaveRoom({ code, sessionToken });

    const response = NextResponse.json(result);
    response.cookies.delete("subterfuge_session");
    return response;
  } catch (error: any) {
    const status = error.message.includes("UNAUTHORIZED")
      ? 403
      : error.message.includes("NOT_FOUND")
      ? 404
      : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
