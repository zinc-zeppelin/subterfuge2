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

    // Parse body explicitly — JSON parse failures or non-object payloads return 400
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_REQUEST: Request body must be valid JSON" },
        { status: 400 }
      );
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: "INVALID_REQUEST: Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const { moleIndictmentId } = body as Record<string, unknown>;

    if (
      moleIndictmentId !== undefined &&
      moleIndictmentId !== null &&
      typeof moleIndictmentId !== "string"
    ) {
      return NextResponse.json(
        { error: "INVALID_INDICTMENT: moleIndictmentId must be a string or omitted" },
        { status: 400 }
      );
    }

    const cleanId = typeof moleIndictmentId === "string" ? moleIndictmentId.trim() : undefined;

    const draftSlate = await gameStore.setSlateMoleIndictment({
      code,
      sessionToken,
      moleIndictmentId: cleanId || undefined,
    });

    return NextResponse.json({ success: true, draftSlate });
  } catch (error: any) {
    const status = error.message.includes("UNAUTHORIZED")
      ? 403
      : error.message.includes("not found")
      ? 404
      : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
