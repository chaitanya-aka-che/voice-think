import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";
import type { Json, Tables } from "@/lib/supabase/types";
import {
  buildInteractionContext,
  loadRecentInteractions,
} from "@/modules/profile/interactions";

const REALTIME_SESSION_URL = "https://api.openai.com/v1/realtime/sessions";
const MAX_FILE_CONTEXT_ENTRIES = 50;
const MAX_CONVERSATION_HISTORY_ENTRIES = 40;

const RequestSchema = z.object({
  sessionUuid: z.string().min(1, "Missing sessionUuid"),
  userId: z.string().min(1, "Missing userId"),
  promptId: z.string().uuid("Invalid promptId"),
});

function respond(
  status: number,
  message: string,
  details?: Record<string, unknown> | string,
) {
  if (status >= 400) {
    console.error("[realtime-token] error", { status, message, details });
  }

  return NextResponse.json(
    {
      error: message,
      details,
    },
    { status },
  );
}

function extractGoalCategory(goalState: Json | null | undefined): string {
  if (goalState && typeof goalState === "object" && !Array.isArray(goalState)) {
    const category = (goalState as Record<string, unknown>).category;
    if (typeof category === "string" && category.trim().length > 0) {
      return category.trim();
    }
  }

  return "General";
}

function formatConversationHistory(
  turns: Array<Pick<Tables<"conversation_turns">, "role" | "content">>,
) {
  if (turns.length === 0) {
    return [];
  }

  return [
    "Previous conversation transcript:",
    ...turns.map((turn) => `- ${turn.role}: ${turn.content}`),
  ];
}

function buildContextBlock({
  prompt,
  goals,
  interactions,
  conversationHistory,
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
  interactions: string;
  conversationHistory: string[];
}) {
  const sections: string[] = [];

  if (prompt.prompt_contexts.length > 0) {
    sections.push("Configured contexts:");
    for (const ctx of prompt.prompt_contexts) {
      sections.push(
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
      sections.push(`Goals – ${category}:`);
      for (const goal of categoryGoals) {
        const description = goal.description ? ` — ${goal.description}` : "";
        sections.push(`- ${goal.title} [${goal.status}]${description}`);
      }
    }
  }

  sections.push(...conversationHistory);
  sections.push(interactions);

  return [prompt.system_prompt.trim(), sections.join("\n\n")]
    .filter((value) => value && value.length > 0)
    .join("\n\n");
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const parsed = RequestSchema.safeParse(payload);

    if (!parsed.success) {
      return respond(400, "Invalid request payload", parsed.error.flatten().fieldErrors);
    }

    const { sessionUuid, userId, promptId } = parsed.data;
    const supabase = createServiceClient();

    const conversationRecord = await supabase
      .from("conversations")
      .select("id")
      .eq("session_uuid", sessionUuid)
      .eq("prompt_id", promptId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const conversationId = conversationRecord.data?.id as string | undefined;

    const conversationTurns = conversationId
      ? (
          (
            await supabase
              .from("conversation_turns")
              .select("role, content")
              .eq("conversation_id", conversationId)
              .order("created_at", { ascending: true })
              .limit(MAX_CONVERSATION_HISTORY_ENTRIES)
          ).data ?? []
        )
      : [];

    const promptQuery = await supabase
      .from("prompts")
      .select(
        "id, system_prompt, prompt_contexts:prompt_contexts(id, name, description, context_payload, aux_schema_required)",
      )
      .eq("id", promptId)
      .single();

    if (promptQuery.error || !promptQuery.data) {
      return respond(404, "Prompt not found");
    }

    const promptRecord = promptQuery.data as {
      system_prompt: string;
      prompt_contexts: Array<{
        id: string;
        name: string;
        description: string | null;
        context_payload: Json;
        aux_schema_required: boolean;
      }>;
    };

    const goalsQuery = await supabase
      .from("user_goals")
      .select("title, description, goal_state, status")
      .eq("session_uuid", sessionUuid)
      .in("status", ["active"]);

    const goals =
      (goalsQuery.data as Array<
        Pick<Tables<"user_goals">, "title" | "description" | "goal_state" | "status">
      >) ?? [];

    const recentInteractions = await loadRecentInteractions(userId, MAX_FILE_CONTEXT_ENTRIES);
    const interactionContext = buildInteractionContext(recentInteractions);

    const conversationHistoryLines = formatConversationHistory(
      (conversationTurns as Array<Pick<Tables<"conversation_turns">, "role" | "content">>) ?? [],
    );

    const instructions = buildContextBlock({
      prompt: promptRecord,
      goals,
      interactions: interactionContext,
      conversationHistory: conversationHistoryLines,
    });

    const response = await fetch(REALTIME_SESSION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "realtime=v1",
      },
      body: JSON.stringify({
        model: env.OPENAI_REALTIME_MODEL,
        voice: "alloy",
        instructions,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const upstreamMessage =
        errorBody?.error?.message ??
        errorBody?.error ??
        errorBody?.message ??
        "Failed to create realtime session";
      return respond(response.status, upstreamMessage, errorBody);
    }

    const realtimePayload = await response.json();
    return NextResponse.json(realtimePayload);
  } catch (error) {
    return respond(500, "Unexpected error creating realtime session", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
