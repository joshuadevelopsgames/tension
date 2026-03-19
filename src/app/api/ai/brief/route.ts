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
        .limit(100),
      supabaseAdmin.from("channels").select("name, topic, client_tag, campaign_tag").eq("id", channelId).single(),
    ]);

    const messages = (msgsResult.data ?? []).reverse();
    const channel = channelResult.data;

    if (messages.length < 3) {
      return NextResponse.json({ brief: "Not enough conversation history to generate a brief. Keep chatting and try again." });
    }

    const transcript = messages
      .map((m: any) => {
        const name = Array.isArray(m.users) ? m.users[0]?.full_name : m.users?.full_name;
        return `${name || "Unknown"}: ${m.body}`;
      })
      .join("\n");

    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const contextLines = [
      `Channel: #${channel?.name || ""}`,
      channel?.client_tag ? `Client: ${channel.client_tag}` : "",
      channel?.campaign_tag ? `Campaign: ${channel.campaign_tag}` : "",
      channel?.topic ? `Context: ${channel.topic}` : "",
    ].filter(Boolean).join("\n");

    const result = await model.generateContent(
      `You are a senior account manager at a marketing agency. Based on the team conversation below, generate a structured campaign/creative brief.\n\n${contextLines}\n\nConversation:\n${transcript}\n\nGenerate a professional brief using this exact markdown structure:\n\n## Campaign Brief\n\n**Client:** [inferred or TBD]\n**Campaign:** [inferred or TBD]\n**Date:** ${today}\n\n### Objective\n[What this campaign aims to achieve]\n\n### Target Audience\n[Who we're targeting]\n\n### Key Messages\n- [main message 1]\n- [main message 2]\n\n### Deliverables\n- [deliverable 1 with owner if mentioned]\n\n### Timeline\n[Key dates and milestones — use TBD if not mentioned]\n\n### Open Items / Next Steps\n- [unresolved question or action]\n\nWrite "TBD" rather than guessing when information isn't in the conversation.`
    );

    return NextResponse.json({ brief: result.response.text() });
  } catch (err: any) {
    console.error("Brief error:", err);
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}
