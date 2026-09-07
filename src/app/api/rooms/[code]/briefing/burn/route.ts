import { NextRequest, NextResponse } from "next/server";
import { gameStore } from "@/lib/store/game-store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> | { code: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { code } = resolvedParams;

    const body = await req.json().catch(() => ({}));
    const sessionToken =
      req.headers.get("x-session-token") ||
      body.sessionToken ||
      req.cookies.get("subterfuge_session")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: Missing operative session token" },
        { status: 401 }
      );
    }

    await gameStore.burnBriefing({ code, sessionToken });
    return NextResponse.json({ success: true, hasBurnedBriefing: true });
  } catch (error: any) {
    const status = error.message.includes("UNAUTHORIZED")
      ? 403
      : error.message.includes("not found")
      ? 404
      : 500;

    return NextResponse.json({ error: error.message }, { status });
  }
}
