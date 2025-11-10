"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { appendInteraction } from "@/modules/profile/interactions";
import { resolveUserSessionProfile } from "@/modules/profile/session";

import { runConversation } from "./orchestrator";

const SUBMIT_SCHEMA = z.object({
  promptId: z.string().uuid({ message: "Prompt ID invalid" }),
  message: z.string().min(1, "Message cannot be empty"),
  conversationId: z.string().uuid().optional().nullable(),
});

async function seedSessionMetadata(sessionUuid: string, userId: string) {
  const supabase = createServiceClient();

  await supabase
    .from("sessions")
    .upsert(
      {
        session_uuid: sessionUuid,
        metadata: { user_id: userId },
      },
      { onConflict: "session_uuid" },
    );
}

export async function submitTextMessage(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = SUBMIT_SCHEMA.safeParse({
    ...raw,
    conversationId: raw.conversationId ?? raw.conversation_id,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join(", "));
  }

  const { promptId, message, conversationId } = parsed.data;
  const userClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    throw new Error("Authentication required");
  }

  const { sessionUuid } = await resolveUserSessionProfile(user.id);
  await seedSessionMetadata(sessionUuid, user.id);

  const cookieStore = await cookies();
  cookieStore.set("voice_think_session", sessionUuid, {
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: false,
    sameSite: "lax",
  });

  await appendInteraction(user.id, {
    timestamp: new Date().toISOString(),
    role: "user",
    content: message,
  });

  await runConversation({
    userId: user.id,
    sessionUuid,
    promptId,
    userMessage: message,
    conversationId: conversationId ?? undefined,
  });

  revalidatePath("/interact");
}
