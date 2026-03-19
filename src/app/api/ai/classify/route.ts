import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 15;

export async function POST(req: NextRequest) {
  try {
    const { messageId, body } = await req.json();
    if (!messageId || !body) return NextResponse.json({ urgent: false });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(
      `Classify this team message as urgent or not. Urgent means it requires immediate attention: missed deadline, client emergency, critical blocker, negative client feedback, system outage, or explicit time-pressure language. Reply with only "urgent" or "normal".\n\nMessage: ${body.slice(0, 400)}`
    );

    const isUrgent = result.response.text().trim().toLowerCase().startsWith("urgent");

    if (isUrgent) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await supabaseAdmin.from("messages").update({ urgent: true }).eq("id", messageId);
    }

    return NextResponse.json({ urgent: isUrgent });
  } catch (err: any) {
    console.error("Classify error:", err);
    return NextResponse.json({ urgent: false });
  }
}
