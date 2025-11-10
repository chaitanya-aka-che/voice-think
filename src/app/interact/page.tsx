import { redirect } from "next/navigation";

import { getPrompts } from "@/modules/config/queries";
import { submitTextMessage } from "@/modules/conversation/actions";
import { resolveUserSessionProfile } from "@/modules/profile/session";
import { createServerSupabaseClient } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/server";

import { ProfileSnapshot } from "./profile-snapshot";
import { VoicePanel } from "./voice-panel";

async function getConversationId(sessionUuid: string, promptId: string) {
  const supabase = createServiceClient();
  const existing = await supabase
    .from("conversations")
    .select("id")
    .eq("session_uuid", sessionUuid)
    .eq("prompt_id", promptId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return existing.data?.id ?? null;
}

async function getConversationTurns(conversationId: string | null) {
  if (!conversationId) return [];
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("conversation_turns")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export default async function InteractPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const prompts = await getPrompts();
  const activePrompt = prompts[0] ?? null;

  if (!activePrompt) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl flex-col items-center justify-center gap-6 px-4 py-8 text-center sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">No prompt configured</h1>
        <p className="text-sm text-muted-foreground">
          Head to <a className="underline" href="/config">/config</a> to create the assistant prompt before chatting or
          starting a voice session.
        </p>
      </div>
    );
  }

  const { sessionUuid, profileData, metrics } = await resolveUserSessionProfile(user.id);
  const conversationId = await getConversationId(sessionUuid, activePrompt.id);
  const turns = await getConversationTurns(conversationId);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Interact</h1>
        <p className="text-sm text-muted-foreground">
          Speak or type to the assistant. We&apos;ll keep your recent context in sync across chat and voice.
        </p>
      </section>

      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">{activePrompt.name}</h2>
          <p className="text-sm text-muted-foreground">{activePrompt.description ?? "No description"}</p>
        </div>

        <ProfileSnapshot profileData={profileData} metrics={metrics} />

        <VoicePanel sessionUuid={sessionUuid} userId={user.id} promptId={activePrompt.id} />

        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
            {turns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No conversation yet. Say hello!</p>
            ) : (
              turns.map((turn) => (
                <div key={turn.id} className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{turn.role}</span>
                  <p className="whitespace-pre-wrap text-sm">{turn.content}</p>
                </div>
              ))
            )}
          </div>

          <form action={submitTextMessage} className="flex flex-col gap-3">
            <input type="hidden" name="promptId" value={activePrompt.id} />
            {conversationId ? (
              <input type="hidden" name="conversationId" value={conversationId} />
            ) : null}
            <textarea
              name="message"
              rows={3}
              required
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Share how your day is going..."
            />
            <button
              type="submit"
              className="self-end rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
