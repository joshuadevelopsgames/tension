import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export async function POST(req: NextRequest) {
  try {
    const { roomName, participantName, userId } = await req.json();

    if (!roomName || !participantName || !userId) {
      return NextResponse.json({ error: "Missing roomName, participantName, or userId" }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: "LiveKit not configured" }, { status: 500 });
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: participantName,
      ttl: "4h",
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return NextResponse.json({ token: await token.toJwt() });
  } catch (err: any) {
    console.error("LiveKit token error:", err);
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}
