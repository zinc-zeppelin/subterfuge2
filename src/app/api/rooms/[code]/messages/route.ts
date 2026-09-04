import { NextRequest, NextResponse } from "next/server";
import { gameStore } from "@/lib/store/game-store";
import { ChannelType } from "@/lib/types/game";

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const sessionToken =
      req.headers.get("x-session-token") ||
      req.cookies.get("subterfuge_session")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: Missing session token" },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const channelType = searchParams.get("channel") as ChannelType | null;
    const peerId = searchParams.get("peerId") || undefined;

    const messages = gameStore.getMessages({
      code,
      sessionToken,
      channelType: channelType || undefined,
      peerId,
    });

    return NextResponse.json({ messages });
  } catch (error: any) {
    const status = error.message.includes("UNAUTHORIZED") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
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
    const { channelType, content, recipientId } = body;

    const message = gameStore.sendMessage({
      code,
      sessionToken,
      channelType,
      content,
      recipientId,
    });

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    const status = error.message.includes("UNAUTHORIZED") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
