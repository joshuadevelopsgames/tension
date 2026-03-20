import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { complete } from "@/lib/openrouter";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { dmId, userId } = await req.json();
    if (!dmId || !userId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    if (!process.env.OPENROUTER_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const [msgsResult, profileResult] = await Promise.all([
      supabaseAdmin
        .from("messages")
        .select("body, sender_id, users:sender_id(full_name)")
        .eq("dm_conversation_id", dmId)
        .order("created_at", { ascending: false })
        .limit(8),
      supabaseAdmin.from("users").select("full_name").eq("id", userId).single(),
    ]);

    const messages = (msgsResult.data ?? []).reverse();
    const myName = profileResult.data?.full_name || "me";

    if (messages.length === 0) return NextResponse.json({ suggestions: [] });

    const transcript = messages
      .map((m) => {
        const name = (Array.isArray(m.users) ? m.users[0]?.full_name : (m.users as { full_name: string | null } | null)?.full_name) ?? "Unknown";
        return `${name}: ${m.body}`;
      })
      .join("\n");

    const text = await complete(
      `You are ${myName} in a team chat. Given this recent conversation, suggest 3 very short reply options (max 8 words each, no punctuation, casual tone).\n\nConversation:\n${transcript}\n\nReturn exactly 3 suggestions, one per line, no numbering, no quotes.`
    );

    const lines = text.trim().split("\n").filter(Boolean).slice(0, 3);
    return NextResponse.json({ suggestions: lines });
  } catch (err) {
    console.error("Suggest replies error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
