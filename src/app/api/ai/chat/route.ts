import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

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

    // Instantiate lazily at request time
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch Global Workspace Context (Static Info)
    const [channelsResult, membersResult, userDmsResult] = await Promise.all([
      supabaseAdmin.from("channels").select("id, name").eq("workspace_id", workspaceId),
      supabaseAdmin.from("workspace_members").select("users(full_name)").eq("workspace_id", workspaceId),
      supabaseAdmin.from("dm_participants").select("dm_conversation_id").eq("user_id", userId)
    ]);

    const channelNames = (channelsResult.data ?? []).map(c => c.name).join(", ");
    const memberNames = (membersResult.data ?? []).map((m: any) => m.users?.full_name).filter(Boolean).join(", ");
    const channelIds = (channelsResult.data ?? []).map(c => c.id);
    const authorizedDmIds = (userDmsResult.data ?? []).map(d => d.dm_conversation_id);

    // FETCH GLOBAL MEMORY: Recent messages across all authorized channels and DMs
    // Only fetch if we have authorized IDs to avoid broad scans or errors
    const [channelMsgs, dmMsgs] = await Promise.all([
      channelIds.length > 0 
        ? supabaseAdmin.from("messages")
            .select("body, channel_id, sender_id, channels(name), users(full_name)")
            .in("channel_id", channelIds)
            .order("created_at", { ascending: false })
            .limit(15) 
        : Promise.resolve({ data: [] }),
      authorizedDmIds.length > 0
        ? supabaseAdmin.from("messages")
            .select("body, dm_conversation_id, sender_id, users(full_name)")
            .in("dm_conversation_id", authorizedDmIds)
            .order("created_at", { ascending: false })
            .limit(15)
        : Promise.resolve({ data: [] })
    ]);

    const staticAppContext = `
--- WORKSPACE CONTEXT ---
Channels available: ${channelNames || "none"}
Team members: ${memberNames || "none"}
`;

    const recentActivity = `
--- GLOBAL MEMORY: RECENT WORKSPACE ACTIVITY ---
${(channelMsgs.data ?? []).reverse().map(m => `[#${(m as any).channels?.name}] ${(m as any).users?.full_name}: ${m.body}`).join("\n")}
${(dmMsgs.data ?? []).reverse().map(m => `[DM] ${(m as any).users?.full_name}: ${m.body}`).join("\n")}
`;

    // Context string for history (current DM)
    const historyText = (history ?? [])
      .map((h: { role: string; content: string }) => `${h.role === "user" ? "User" : "AI"}: ${h.content}`)
      .join("\n");

    // Step 1: Classify the message (with Global Memory context)
    const classifyModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const classifyResult = await classifyModel.generateContent({
      contents: [{
        role: "user",
        parts: [{ text: `You are an assistant for "Tension". Determine if the message is asking about Tension's features, workspace info, or something found in recent conversations.

${staticAppContext}
${recentActivity}

CONVERSATION HISTORY (CURRENT):
${historyText}

NEW MESSAGE: "${message}"

Reply with only "YES" or "NO".` }]
      }]
    });
    const tensionRelated = classifyResult.response.text().trim().toUpperCase().startsWith("YES");

    // Step 2: Generate the appropriate response
    let aiResponse: string;
    const aiSource = tensionRelated ? "tension" : "gemini";

    if (tensionRelated) {
      // Fetch knowledge base
      const { data: knowledge } = await supabaseAdmin
        .from("tension_knowledge")
        .select("title, content");
      const knowledgeText = (knowledge ?? [])
        .map((k: { title: string; content: string }) => `## ${k.title}\n${k.content}`)
        .join("\n\n");

      const tensionModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: `You are Tension AI. Answer using the knowledge base AND workspace context/memory below. If a user asks about previous discussions, refer to the activity log.

${staticAppContext}
${recentActivity}

--- TENSION KNOWLEDGE BASE ---
${knowledgeText}`
      });
      
      const tensionResult = await tensionModel.generateContent({
        contents: [
          ...(history ?? []).map((h: { role: string; content: string }) => ({
            role: h.role,
            parts: [{ text: h.content }]
          })),
          { role: "user", parts: [{ text: message }] }
        ]
      });
      aiResponse = tensionResult.response.text();
    } else {
      const geminiModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: `You are a helpful, concise AI assistant for Tension. You have access to the user's recent workspace activity for context.

${recentActivity}`
      });
      const geminiResult = await geminiModel.generateContent({
        contents: [
          ...(history ?? []).map((h: { role: string; content: string }) => ({
            role: h.role,
            parts: [{ text: h.content }]
          })),
          { role: "user", parts: [{ text: message }] }
        ]
      });
      aiResponse = geminiResult.response.text();
    }

    // Step 3: Insert AI response as a DM from the bot user
    const { error } = await supabaseAdmin.from("messages").insert({
      workspace_id: workspaceId,
      sender_id: TENSION_AI_USER_ID,
      dm_conversation_id: dmId,
      body: aiResponse,
      ai_source: aiSource,
    });

    if (error) {
      console.error("Failed to insert AI message:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, mode: aiSource });
  } catch (err: any) {
    console.error("AI chat error:", err);
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
