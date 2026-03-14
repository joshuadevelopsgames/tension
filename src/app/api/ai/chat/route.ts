import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const TENSION_AI_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(req: NextRequest) {
  try {
    const { message, dmId, workspaceId } = await req.json();

    if (!message || !dmId || !workspaceId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    // Instantiate lazily at request time so build doesn't fail without env vars
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Step 1: Classify the message
    const classifyModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const classifyResult = await classifyModel.generateContent({
      contents: [{
        role: "user",
        parts: [{ text: `Classify the following message. Is it specifically asking about the "Tension" app (a team communication/messaging tool), its features, how it works, or anything directly related to using Tension? Reply with only "YES" or "NO".\n\nMessage: "${message}"` }]
      }]
    });
    const tensionRelated = classifyResult.response.text().trim().toUpperCase().startsWith("YES");

    // Step 2: Generate the appropriate response
    let aiResponse: string;

    if (tensionRelated) {
      // Fetch knowledge base
      const { data: knowledge } = await supabaseAdmin
        .from("tension_knowledge")
        .select("title, content");
      const knowledgeText = (knowledge ?? [])
        .map((k: { title: string; content: string }) => `## ${k.title}\n${k.content}`)
        .join("\n\n");

      const tensionModel = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: `You are Tension AI, the built-in assistant for the Tension team communication app. You ONLY answer questions using the knowledge base provided below. If the answer isn't in the knowledge base, say you don't have that information yet but the user can reach out to the Tension team. Be concise, helpful, and friendly.\n\n--- TENSION KNOWLEDGE BASE ---\n${knowledgeText}`
      });
      const tensionResult = await tensionModel.generateContent({
        contents: [{ role: "user", parts: [{ text: message }] }]
      });
      aiResponse = tensionResult.response.text();
    } else {
      const geminiModel = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: "You are a helpful, concise AI assistant. Answer the user's question clearly and helpfully."
      });
      const geminiResult = await geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: message }] }]
      });
      aiResponse = geminiResult.response.text();
    }

    // Step 3: Insert AI response as a DM from the bot user
    const { error } = await supabaseAdmin.from("messages").insert({
      workspace_id: workspaceId,
      sender_id: TENSION_AI_USER_ID,
      dm_conversation_id: dmId,
      body: aiResponse,
    });

    if (error) {
      console.error("Failed to insert AI message:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, mode: tensionRelated ? "tension" : "gemini" });
  } catch (err: any) {
    console.error("AI chat error:", err);
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
