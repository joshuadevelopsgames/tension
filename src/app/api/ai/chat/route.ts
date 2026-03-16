import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

// Extend Vercel function timeout to 60s (Pro plan) — silently ignored on hobby tier
export const maxDuration = 60;

const TENSION_AI_USER_ID = "00000000-0000-0000-0000-000000000001";

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
    const memberNames = (membersResult.data ?? []).map((m: any) => m.users?.full_name).filter(Boolean).join(", ");
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

    const recentActivity = [
      ...(channelMsgs.data ?? []).reverse().map(m => `[#${(m as any).channels?.name}] ${(m as any).users?.full_name}: ${m.body}`),
      ...(dmMsgs.data ?? []).reverse().map(m => `[DM] ${(m as any).users?.full_name}: ${m.body}`),
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

    const contents = [
      ...(history ?? []).map((h: { role: string; content: string }) => ({
        role: h.role as "user" | "model",
        parts: [{ text: h.content }],
      })),
      { role: "user" as const, parts: [{ text: message }] },
    ];

    const result = await model.generateContent({ contents });
    const aiResponse = result.response.text();

    if (!aiResponse) {
      return NextResponse.json({ error: "Empty response from AI" }, { status: 500 });
    }

    // Insert AI response into the conversation
    const { error } = await supabaseAdmin.from("messages").insert({
      workspace_id: workspaceId,
      sender_id: TENSION_AI_USER_ID,
      dm_conversation_id: dmId,
      body: aiResponse,
      ai_source: "gemini",
    });

    if (error) {
      console.error("Failed to insert AI message:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("AI chat error:", err);
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
