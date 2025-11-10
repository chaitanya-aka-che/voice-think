import OpenAI from "openai";

import { env } from "./env";

let client: OpenAI | null = null;

export function getOpenAIClient() {
  if (!client) {
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return client;
}

export const DEFAULT_CHAT_MODEL = "gpt-4o-mini";

export function getChatModel() {
  return env.OPENAI_CHAT_MODEL || DEFAULT_CHAT_MODEL;
}
