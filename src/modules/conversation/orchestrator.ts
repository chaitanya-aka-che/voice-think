import type { ChatCompletionChunk, ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { createServiceClient } from "@/lib/supabase/server";
import type { Json, Tables } from "@/lib/supabase/types";
import { getChatModel, getOpenAIClient } from "@/lib/openai";
import {
  appendInteraction,
  buildInteractionContext,
  loadRecentInteractions,
} from "@/modules/profile/interactions";
import { updateUserProfileMetrics } from "@/modules/profile/metrics";

const MAX_HISTORY_TURNS = 20;
const MAX_FILE_CONTEXT_ENTRIES = 50;

export type ConversationRunInput = {
  userId: string;
  sessionUuid: string;
  promptId: string;
  userMessage: string;
  conversationId?: string;
};

export type ConversationRunResult = {
  conversationId: string;
  assistantMessage: string;
};

function extractGoalCategory(goalState: Json | null | undefined): string {
  if (goalState && typeof goalState === "object" && !Array.isArray(goalState)) {
    const category = (goalState as Record<string, unknown>).category;
    if (typeof category === "string" && category.trim().length > 0) {
      return category.trim();
    }
  }

  return "General";
}

function formatContext(
  prompt: {
    prompt_contexts: Array<
      Pick<
        Tables<"prompt_contexts">,
        "id" | "name" | "description" | "context_payload" | "aux_schema_required"
      >
    >;
  },
  goals: Array<
    Pick<Tables<"user_goals">, "title" | "description" | "goal_state" | "status">
  >,
  interactionContext: string,
) {
  const contextLines: string[] = [];

  if (prompt.prompt_contexts.length > 0) {
    contextLines.push("Configured contexts:");
    for (const ctx of prompt.prompt_contexts) {
      contextLines.push(
        `- ${ctx.name}: ${ctx.description ?? "no description"}. Payload: ${JSON.stringify(
          ctx.context_payload,
        )}`,
      );
    }
  }

  if (goals.length > 0) {
    const grouped = new Map<string, Array<Pick<Tables<"user_goals">, "title" | "description" | "goal_state" | "status">>>();

    for (const goal of goals) {
      const category = extractGoalCategory(goal.goal_state);
      const bucket = grouped.get(category);
      if (bucket) {
        bucket.push(goal);
      } else {
        grouped.set(category, [goal]);
      }
    }

    for (const [category, categoryGoals] of grouped.entries()) {
      contextLines.push(`Goals – ${category}:`);
      for (const goal of categoryGoals) {
        const description = goal.description ? ` — ${goal.description}` : "";
        contextLines.push(`- ${goal.title} [${goal.status}]${description}`);
      }
    }
  }
  contextLines.push(interactionContext);

  return contextLines.join("\n\n");
}

function buildMessages({
  prompt,
  goals,
  history,
  userMessage,
  interactionContext,
}: {
  prompt: {
    system_prompt: string;
    prompt_contexts: Array<
      Pick<
        Tables<"prompt_contexts">,
        "id" | "name" | "description" | "context_payload" | "aux_schema_required"
      >
    >;
  };
  goals: Array<
    Pick<Tables<"user_goals">, "title" | "description" | "goal_state" | "status">
  >;
  history: Array<Pick<Tables<"conversation_turns">, "role" | "content">>;
  userMessage: string;
  interactionContext: string;
}): ChatCompletionMessageParam[] {
  const contextBlock = formatContext(prompt, goals, interactionContext);

  const systemContent = [prompt.system_prompt.trim(), contextBlock]
    .filter(Boolean)
    .join("\n\n");

  const normalizedHistory: ChatCompletionMessageParam[] = history.map((turn) => ({
    role: turn.role === "user" ? "user" : "assistant",
    content: turn.content,
  }));

  return [
    {
      role: "system",
      content: systemContent,
    },
    ...normalizedHistory,
    {
      role: "user",
      content: userMessage,
    },
  ];
}

type PreparedConversation = {
  conversationId: string;
  messages: ChatCompletionMessageParam[];
};

export async function prepareConversation(
  input: ConversationRunInput,
): Promise<PreparedConversation> {
  const db = createServiceClient();

  const promptQuery = await db
    .from("prompts")
    .select(
      "id, system_prompt, name, prompt_contexts:prompt_contexts(id, name, description, context_payload, aux_schema_required)",
    )
    .eq("id", input.promptId)
    .single();

  if (promptQuery.error || !promptQuery.data) {
    throw new Error("Prompt not found for conversation");
  }

  const prompt = promptQuery.data as {
    system_prompt: string;
    prompt_contexts: Array<{
      id: string;
      name: string;
      description: string | null;
      context_payload: Json;
      aux_schema_required: boolean;
    }>;
  };

  const goalsQuery = await db
    .from("user_goals")
    .select("title, description, goal_state, status")
    .eq("session_uuid", input.sessionUuid)
    .in("status", ["active"]);

  const goals =
    (goalsQuery.data as Array<
      Pick<Tables<"user_goals">, "title" | "description" | "goal_state" | "status">
    >) ?? [];

  const recentInteractions = await loadRecentInteractions(
    input.userId,
    MAX_FILE_CONTEXT_ENTRIES,
  );
  const interactionContext = buildInteractionContext(recentInteractions);

  let conversationId = input.conversationId ?? undefined;

  if (!conversationId) {
    const existing = await db
      .from("conversations")
      .select("id")
      .eq("session_uuid", input.sessionUuid)
      .eq("prompt_id", input.promptId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    conversationId = existing.data?.id ?? undefined;

    if (!conversationId) {
      const created = await db
        .from("conversations")
        .insert({
          session_uuid: input.sessionUuid,
          prompt_id: input.promptId,
          status: "active",
          metadata: {},
        })
        .select("id")
        .single();

      if (created.error || !created.data) {
        throw new Error("Unable to create conversation");
      }

      conversationId = created.data.id;
    }
  }

  if (!conversationId) {
    throw new Error("Conversation unavailable");
  }

  const historyQuery = await db
    .from("conversation_turns")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(MAX_HISTORY_TURNS);

  const history =
    (historyQuery.data as Array<{
      role: Tables<"conversation_turns">["role"];
      content: string;
    }>) ?? [];

  await db.from("conversation_turns").insert({
    conversation_id: conversationId,
    session_uuid: input.sessionUuid,
    role: "user",
    content: input.userMessage,
  });

  const messages = buildMessages({
    prompt,
    goals,
    history,
    userMessage: input.userMessage,
    interactionContext,
  });

  return { conversationId, messages };
}

async function persistAssistantTurn({
  conversationId,
  sessionUuid,
  assistantText,
}: {
  conversationId: string;
  sessionUuid: string;
  assistantText: string;
}) {
  const db = createServiceClient();

  await db.from("conversation_turns").insert({
    conversation_id: conversationId,
    session_uuid: sessionUuid,
    role: "assistant",
    content: assistantText,
  });
}

export async function runConversation(
  input: ConversationRunInput,
): Promise<ConversationRunResult> {
  const prepared = await prepareConversation(input);

  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: getChatModel(),
    messages: prepared.messages,
  });

  const assistantRaw = response.choices[0]?.message?.content;
  const assistantText =
    typeof assistantRaw === "string" && assistantRaw.trim().length > 0
      ? assistantRaw.trim()
      : "I did not receive a response.";

  await persistAssistantTurn({
    conversationId: prepared.conversationId,
    sessionUuid: input.sessionUuid,
    assistantText,
  });

  await appendInteraction(input.userId, {
    timestamp: new Date().toISOString(),
    role: "assistant",
    content: assistantText,
  });

  await updateUserProfileMetrics(input.userId, input.sessionUuid);

  return {
    conversationId: prepared.conversationId,
    assistantMessage: assistantText,
  };
}

export async function streamAssistantResponse({
  input,
  onDelta,
}: {
  input: ConversationRunInput;
  onDelta: (delta: string) => void;
}): Promise<{ conversationId: string; fullText: string }> {
  const prepared = await prepareConversation(input);
  const client = getOpenAIClient();

  const completion = (await client.chat.completions.create({
    model: getChatModel(),
    messages: prepared.messages,
    stream: true,
  })) as AsyncIterable<ChatCompletionChunk>;

  const streamCompletion: AsyncIterable<ChatCompletionChunk> =
    completion as AsyncIterable<ChatCompletionChunk>;

  let assistantText = "";
  const iterator = (streamCompletion as {
    [Symbol.asyncIterator](): AsyncIterator<ChatCompletionChunk>;
  })[Symbol.asyncIterator]();

  while (true) {
    const { value, done } = await iterator.next();
    if (done) break;
    const chunk = value;

    const delta = chunk.choices[0]?.delta?.content;

    if (!delta) continue;

    if (typeof delta === "string") {
      assistantText += delta;
      onDelta(delta);
    } else if (Array.isArray(delta)) {
      const parts = delta as Array<string | { text?: string }>;
      for (const part of parts) {
        if (typeof part === "string") {
          assistantText += part;
          onDelta(part);
        } else if (part && typeof part === "object") {
          const text = (part as Record<string, unknown>).text;
          if (typeof text === "string") {
            assistantText += text;
            onDelta(text);
          }
        }
      }
    }
  }

  const finalizedText =
    assistantText.trim().length > 0 ? assistantText.trim() : "I did not receive a response.";

  await persistAssistantTurn({
    conversationId: prepared.conversationId,
    sessionUuid: input.sessionUuid,
    assistantText: finalizedText,
  });

  await appendInteraction(input.userId, {
    timestamp: new Date().toISOString(),
    role: "assistant",
    content: finalizedText,
  });

  await updateUserProfileMetrics(input.userId, input.sessionUuid);

  return { conversationId: prepared.conversationId, fullText: finalizedText };
}
