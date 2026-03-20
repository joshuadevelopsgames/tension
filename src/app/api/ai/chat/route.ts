import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { TENSION_AI_USER_ID } from "@/lib/types";

// Extend Vercel function timeout to 60s (Pro plan) — silently ignored on hobby tier
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { message, dmId, workspaceId, userId, history } = await req.json();

    if (!message || !dmId || !workspaceId || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Fetch all context in parallel — one round trip to the DB
    const [channelsResult, membersResult, userDmsResult, knowledgeResult] = await Promise.all([
      supabaseAdmin.from("channels").select("id, name").eq("workspace_id", workspaceId),
      supabaseAdmin.from("workspace_members").select("users(full_name)").eq("workspace_id", workspaceId),
      supabaseAdmin.from("dm_participants").select("dm_conversation_id").eq("user_id", userId),
      supabaseAdmin.from("tension_knowledge").select("title, content"),
    ]);

    const channelNames = (channelsResult.data ?? []).map(c => c.name).join(", ");
    const memberNames = (membersResult.data ?? []).map(m => (m.users as unknown as { full_name: string | null } | null)?.full_name).filter(Boolean).join(", ");
    const channelIds = (channelsResult.data ?? []).map(c => c.id);
    const authorizedDmIds = (userDmsResult.data ?? []).map(d => d.dm_conversation_id);
    const knowledgeText = (knowledgeResult.data ?? [])
      .map((k: { title: string; content: string }) => `## ${k.title}\n${k.content}`)
      .join("\n\n");

    // Fetch recent activity in parallel
    const [channelMsgs, dmMsgs] = await Promise.all([
      channelIds.length > 0
        ? supabaseAdmin.from("messages")
            .select("body, channel_id, sender_id, channels(name), users(full_name)")
            .in("channel_id", channelIds)
            .order("created_at", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [] }),
      authorizedDmIds.length > 0
        ? supabaseAdmin.from("messages")
            .select("body, dm_conversation_id, sender_id, users(full_name)")
            .in("dm_conversation_id", authorizedDmIds)
            .order("created_at", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [] }),
    ]);

    type ChannelMsg = { body: string; channels: { name: string } | null; users: { full_name: string | null } | null };
    type DmMsg = { body: string; users: { full_name: string | null } | null };

    const recentActivity = [
      ...(channelMsgs.data ?? []).reverse().map(m => `[#${(m as unknown as ChannelMsg).channels?.name}] ${(m as unknown as ChannelMsg).users?.full_name}: ${m.body}`),
      ...(dmMsgs.data ?? []).reverse().map(m => `[DM] ${(m as unknown as DmMsg).users?.full_name}: ${m.body}`),
    ].join("\n");

    // Single Gemini call — classify + respond in one shot using gemini-2.0-flash (fast)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: `You are Tension AI, a helpful assistant built into the Tension team chat app.

--- WORKSPACE CONTEXT ---
Channels: ${channelNames || "none"}
Team members: ${memberNames || "none"}

--- RECENT WORKSPACE ACTIVITY ---
${recentActivity || "No recent activity"}

--- TENSION KNOWLEDGE BASE ---
${knowledgeText || "No knowledge base entries"}

Answer the user's message helpfully and concisely. If they ask about Tension features, workspace info, or recent conversations, use the context above. For general questions, answer from your knowledge.`,
    });

    // Gemini only accepts "user" or "model" roles — map "assistant" → "model" defensively
    const contents = [
      ...(history ?? []).map((h: { role: string; content: string }) => ({
        role: (h.role === "user" ? "user" : "model") as "user" | "model",
        parts: [{ text: h.content }],
      })),
      { role: "user" as const, parts: [{ text: message }] },
    ];

    const result = await model.generateContent({ contents });
    const aiResponse = result.response.text();

    if (!aiResponse) {
      return NextResponse.json({ error: "Empty response from AI" }, { status: 500 });
    }

    const { error } = await supabaseAdmin.from("messages").insert({
      workspace_id: workspaceId,
      sender_id: TENSION_AI_USER_ID,
      dm_conversation_id: dmId,
      body: aiResponse,
      ai_source: "tension",
    });

    if (error) {
      const msg = error.message || error.details || JSON.stringify(error);
      console.error("Failed to insert AI message:", error);
      return NextResponse.json({ error: msg || "Insert failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err) || "Unknown error";
    console.error("AI chat error:", msg, err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
