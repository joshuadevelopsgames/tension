import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { channelId } = await req.json();
    if (!channelId) return NextResponse.json({ error: "Missing channelId" }, { status: 400 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [msgsResult, channelResult] = await Promise.all([
      supabaseAdmin
        .from("messages")
        .select("body, sender_id, created_at, users:sender_id(full_name)")
        .eq("channel_id", channelId)
        .is("parent_id", null)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("channels")
        .select("name, topic, client_tag, campaign_tag")
        .eq("id", channelId)
        .single(),
    ]);

    const messages = (msgsResult.data ?? []).reverse();
    const channel = channelResult.data;

    if (messages.length === 0) {
      return NextResponse.json({ summary: "No messages to summarize yet." });
    }

    const transcript = messages
      .map((m: any) => {
        const name = Array.isArray(m.users) ? m.users[0]?.full_name : m.users?.full_name;
        return `${name || "Unknown"}: ${m.body}`;
      })
      .join("\n");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const contextLines = [
      `Channel: #${channel?.name || channelId}`,
      channel?.topic ? `Topic: ${channel.topic}` : "",
      channel?.client_tag ? `Client: ${channel.client_tag}` : "",
      channel?.campaign_tag ? `Campaign: ${channel.campaign_tag}` : "",
    ].filter(Boolean).join("\n");

    const result = await model.generateContent(
      `You are summarizing a team channel for a marketing agency.\n\n${contextLines}\n\nRecent messages:\n${transcript}\n\nProvide a concise summary with these sections (use markdown):\n\n**Key Decisions** — What was decided or agreed on\n**Key Points** — Main topics discussed\n**Open Questions** — Unresolved items needing follow-up\n**Action Items** — Clear next steps mentioned\n\nKeep each section to bullet points. Be concise.`
    );

    return NextResponse.json({ summary: result.response.text() });
  } catch (err: any) {
    console.error("Summarize error:", err);
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}
