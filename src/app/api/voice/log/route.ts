import { NextResponse } from "next/server";
import { z } from "zod";

import { appendInteraction } from "@/modules/profile/interactions";
import { updateUserProfileMetrics } from "@/modules/profile/metrics";
import { syncGoalsFromConversation } from "@/modules/profile/goals";
import { createServiceClient } from "@/lib/supabase/server";

const BodySchema = z.object({
  userId: z.string().min(1, "userId is required"),
  sessionUuid: z.string().uuid("sessionUuid must be a valid UUID"),
  promptId: z.string().uuid("promptId must be a valid UUID"),
  entries: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1, "content cannot be empty"),
      }),
    )
    .min(1, "entries cannot be empty"),
});

async function ensureConversation(
  supabase: ReturnType<typeof createServiceClient>,
  sessionUuid: string,
  promptId: string,
) {
  const existing = await supabase
    .from("conversations")
    .select("id")
    .eq("session_uuid", sessionUuid)
    .eq("prompt_id", promptId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.data?.id) {
    return existing.data.id as string;
  }

  const created = await supabase
    .from("conversations")
    .insert({
      session_uuid: sessionUuid,
      prompt_id: promptId,
      status: "active",
      metadata: { source: "voice" },
    })
    .select("id")
    .single();

  if (created.error || !created.data) {
    throw new Error(created.error?.message ?? "Unable to create conversation");
  }

  return created.data.id as string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { userId, sessionUuid, promptId, entries } = parsed.data;
    const supabase = createServiceClient();

    const conversationId = await ensureConversation(supabase, sessionUuid, promptId);

    const now = Date.now();
    const turnPayloads = entries.map((entry, index) => ({
      conversation_id: conversationId,
      session_uuid: sessionUuid,
      role: entry.role,
      content: entry.content,
      metadata: { source: "voice" },
      created_at: new Date(now + index).toISOString(),
    }));

    await supabase.from("conversation_turns").insert(turnPayloads);

    for (const [index, entry] of entries.entries()) {
      await appendInteraction(userId, {
        timestamp: new Date(now + index).toISOString(),
        role: entry.role,
        content: entry.content,
      });
    }

    await syncGoalsFromConversation({
      conversationId,
      sessionUuid,
    });

    await updateUserProfileMetrics(userId, sessionUuid);

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to record voice interaction",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
