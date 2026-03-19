import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { channelId, userId } = await req.json();
    if (!channelId || !userId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [msgsResult, channelResult, profileResult] = await Promise.all([
      supabaseAdmin
        .from("messages")
        .select("body, sender_id, users:sender_id(full_name)")
        .eq("channel_id", channelId)
        .is("parent_id", null)
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin.from("channels").select("name, topic, client_tag, campaign_tag").eq("id", channelId).single(),
      supabaseAdmin.from("users").select("full_name").eq("id", userId).single(),
    ]);

    const messages = (msgsResult.data ?? []).reverse();
    const channel = channelResult.data;
    const myName = profileResult.data?.full_name || "me";

    if (messages.length === 0) return NextResponse.json({ draft: "" });

    const transcript = messages
      .map((m: any) => {
        const name = Array.isArray(m.users) ? m.users[0]?.full_name : m.users?.full_name;
        return `${name || "Unknown"}: ${m.body}`;
      })
      .join("\n");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const clientCtx = channel?.client_tag ? ` (Client: ${channel.client_tag})` : "";
    const result = await model.generateContent(
      `You are ${myName} in a team messaging app for a marketing agency.\n\nChannel: #${channel?.name || ""}${clientCtx}\n\nRecent conversation:\n${transcript}\n\nWrite a natural, helpful reply as ${myName}. Match the tone (casual for internal, professional for client-related). Return ONLY the reply text with no quotes or preamble.`
    );

    return NextResponse.json({ draft: result.response.text().trim() });
  } catch (err: any) {
    console.error("Draft error:", err);
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}
