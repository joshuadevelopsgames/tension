import OpenAI from "openai";

/**
 * Shared OpenRouter client — drop-in OpenAI-compatible API.
 * Model can be overridden via OPENROUTER_MODEL env var.
 * Defaults to google/gemini-2.0-flash-001 (fast, cheap, same family as before).
 */
export const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? "google/gemini-2.0-flash-001";

export function createOpenRouter(): OpenAI {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://tension.app",
      "X-Title": "Tension",
    },
  });
}

/** Convenience: single non-streaming completion */
export async function complete(prompt: string, systemPrompt?: string): Promise<string> {
  const client = createOpenRouter();
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const res = await client.chat.completions.create({
    model: OPENROUTER_MODEL,
    messages,
  });
  return res.choices[0]?.message?.content ?? "";
}
