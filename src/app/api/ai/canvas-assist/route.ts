import { NextRequest, NextResponse } from "next/server";
import { complete } from "@/lib/openrouter";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { action, text } = await req.json();
    if (!action || !text) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const prompts: Record<string, string> = {
      summarize:    `Summarise the following document content into concise bullet points. Use markdown:\n\n${text}`,
      expand:       `Expand and enrich the following text with more detail, context, and examples. Use markdown:\n\n${text}`,
      professional: `Rewrite the following in a polished, professional tone. Use markdown:\n\n${text}`,
      casual:       `Rewrite the following in a friendly, casual conversational tone. Use markdown:\n\n${text}`,
    };

    const prompt = prompts[action];
    if (!prompt) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

    const result = await complete(prompt);
    return NextResponse.json({ result });
  } catch (err: any) {
    console.error("Canvas assist error:", err);
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}
