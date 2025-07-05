import { Mistral } from "@mistralai/mistralai";
import { RealtimeTranscription } from "@mistralai/mistralai/extra/realtime";

export const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY ?? "",
});

export const realtimeClient = new RealtimeTranscription({
  apiKey: process.env.MISTRAL_API_KEY ?? "",
  serverURL: "wss://api.mistral.ai",
});

export const SYSTEM_PROMPT = `You are an AI desktop assistant running on macOS. You can control the user's computer using the provided tools.

When the user asks you to perform an action (open apps, manage files, control volume, etc.), use the appropriate tool. When the user asks a general question, respond with text only.

Be concise in your responses. After performing an action, briefly confirm what you did.`;

export const MAX_AGENTIC_ITERATIONS = 10;

export function parseToolCallArgs(
  args: Record<string, unknown> | string,
): Record<string, unknown> {
  if (typeof args === "string") {
    try {
      return JSON.parse(args) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return args;
}
