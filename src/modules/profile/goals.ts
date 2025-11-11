import { getChatModel, getOpenAIClient } from "@/lib/openai";
import { createServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

function safeParseJson(content: string) {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}$/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

function normaliseStatus(input?: string | null) {
  if (!input) return "active";
  const normalised = input.toLowerCase();
  if (["active", "completed", "archived"].includes(normalised)) {
    return normalised;
  }
  return "active";
}

export async function syncGoalsFromConversation({
  conversationId,
  sessionUuid,
}: {
  conversationId: string;
  sessionUuid: string;
}) {
  const supabase = createServiceClient();

  const transcriptQuery = await supabase
    .from("conversation_turns")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (transcriptQuery.error || !transcriptQuery.data) {
    return;
  }

  const transcriptLines = transcriptQuery.data
    .map((turn) => `${turn.role}: ${turn.content}`)
    .join("\n");

  if (!transcriptLines.trim()) {
    return;
  }

  const openai = getOpenAIClient();

  const completion = await openai.chat.completions.create({
    model: getChatModel(),
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You extract user goals from a conversation transcript. Respond ONLY with JSON matching the schema {\"goals\": [{\"title\": string, \"description\": string|null, \"category\": string|null, \"status\": string|null}]}. If no goals, return {\"goals\":[]}. Use concise titles. Category should capture the primary theme (e.g., Health, Career). Status should be active unless the user clearly completed or archived the goal.",
      },
      {
        role: "user",
        content: `Conversation transcript:\n${transcriptLines}`,
      },
    ],
  });

  const extractedRaw = completion.choices[0]?.message?.content ?? "";
  const parsed = safeParseJson(extractedRaw);

  if (!parsed || !Array.isArray(parsed.goals)) {
    return;
  }

  const goals = parsed.goals
    .filter((goal: Record<string, unknown>) => typeof goal?.title === "string")
    .map((goal: Record<string, unknown>) => ({
      title: String(goal.title).trim(),
      description: typeof goal.description === "string" ? goal.description.trim() : null,
      category: typeof goal.category === "string" && goal.category.trim().length > 0 ? goal.category.trim() : "General",
      status: normaliseStatus(typeof goal.status === "string" ? goal.status : null),
    }))
    .filter((goal) => goal.title.length > 0)
    .slice(0, 10);

  if (goals.length === 0) {
    return;
  }

  const existingQuery = await supabase
    .from("user_goals")
    .select("id, title")
    .eq("session_uuid", sessionUuid);

  if (existingQuery.error) {
    return;
  }

  const existing = existingQuery.data ?? [];

  type GoalInsert = Database["public"]["Tables"]["user_goals"]["Insert"];
  const updates: Array<{ id: string; description: string | null; goal_state: { category: string }; status: string }> = [];
  const inserts: GoalInsert[] = [];

  for (const goal of goals) {
    const match = existing.find((record) => record.title.toLowerCase() === goal.title.toLowerCase());

    if (match) {
      updates.push({
        id: match.id,
        description: goal.description,
        goal_state: { category: goal.category },
        status: goal.status,
      });
    } else {
      inserts.push({
        session_uuid: sessionUuid,
        title: goal.title,
        description: goal.description,
        status: goal.status,
        goal_state: { category: goal.category },
        target_date: null,
      });
    }
  }

  if (inserts.length > 0) {
    await supabase.from("user_goals").insert(inserts);
  }

  for (const update of updates) {
    await supabase
      .from("user_goals")
      .update({
        description: update.description,
        goal_state: update.goal_state,
        status: update.status,
      })
      .eq("id", update.id);
  }
}
