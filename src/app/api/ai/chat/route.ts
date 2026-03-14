import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const TENSION_AI_USER_ID = "00000000-0000-0000-0000-000000000001";

// Use service role to insert bot messages
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function isTensionRelated(message: string): Promise<boolean> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent({
    contents: [{
      role: "user",
      parts: [{ text: `Classify the following message. Is it specifically asking about the "Tension" app (a team communication/messaging tool), its features, how it works, or anything directly related to using Tension? Reply with only "YES" or "NO".\n\nMessage: "${message}"` }]
    }]
  });
  const reply = result.response.text().trim().toUpperCase();
  return reply.startsWith("YES");
}

async function fetchKnowledge(): Promise<string> {
  const { data } = await supabaseAdmin
    .from("tension_knowledge")
    .select("title, content");
  
  if (!data || data.length === 0) return "";
  return data.map((k) => `## ${k.title}\n${k.content}`).join("\n\n");
}

async function getTensionAnswer(message: string, knowledge: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: `You are Tension AI, the built-in assistant for the Tension team communication app. You ONLY answer questions using the knowledge base provided below. If the answer isn't in the knowledge base, say you don't have that information yet but the user can reach out to the Tension team. Be concise, helpful, and friendly.\n\n--- TENSION KNOWLEDGE BASE ---\n${knowledge}`
  });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: message }] }]
  });
  return result.response.text();
}

async function getGeminiAnswer(message: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: "You are a helpful, concise AI assistant. Answer the user's question clearly and helpfully."
  });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: message }] }]
  });
  return result.response.text();
}

export async function POST(req: NextRequest) {
  try {
    const { message, dmId, workspaceId } = await req.json();

    if (!message || !dmId || !workspaceId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    // Route: Tension-specific or general?
    const tensionRelated = await isTensionRelated(message);

    let aiResponse: string;
    if (tensionRelated) {
      const knowledge = await fetchKnowledge();
      aiResponse = await getTensionAnswer(message, knowledge);
    } else {
      aiResponse = await getGeminiAnswer(message);
    }

    // Insert AI response as a message from the bot user
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
