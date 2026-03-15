import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const TENSION_AI_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(req: NextRequest) {
  try {
    const { message, dmId, workspaceId, history } = await req.json();

    if (!message || !dmId || !workspaceId) {
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

    // Fetch Global Workspace Context
    const [channelsResult, membersResult] = await Promise.all([
      supabaseAdmin.from("channels").select("name").eq("workspace_id", workspaceId),
      supabaseAdmin.from("workspace_members").select("users(full_name)").eq("workspace_id", workspaceId)
    ]);

    const channelNames = (channelsResult.data ?? []).map(c => c.name).join(", ");
    const memberNames = (membersResult.data ?? []).map((m: any) => m.users?.full_name).filter(Boolean).join(", ");

    const appContext = `
--- WORKSPACE CONTEXT ---
Channels available: ${channelNames || "none"}
Team members: ${memberNames || "none"}
`;

    // Context string for history
    const historyText = (history ?? [])
      .map((h: { role: string; content: string }) => `${h.role === "user" ? "User" : "AI"}: ${h.content}`)
      .join("\n");

    // Step 1: Classify the message (with context)
    const classifyModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const classifyResult = await classifyModel.generateContent({
      contents: [{
        role: "user",
        parts: [{ text: `You are an assistant for the "Tension" communication app. Given the workspace context, conversation history, and the new message, determine if the new message is asking about Tension, its features, how it works, or information about the specific workspace (channels, members, etc).

${appContext}

CONVERSATION HISTORY:
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
        systemInstruction: `You are Tension AI, the built-in assistant for the Tension team communication app. You answer questions about Tension using the knowledge base AND workspace context provided below. If a user asks about channels or members, use the workspace context. Be concise, helpful, and friendly.

${appContext}

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
        systemInstruction: "You are a helpful, concise AI assistant. Answer the user's question clearly and helpfully."
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
