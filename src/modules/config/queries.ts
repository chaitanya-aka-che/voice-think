import { cache } from "react";

import { createAnonServerClient } from "../../lib/supabase/server";

export type PromptWithContexts = {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  is_active: boolean;
  prompt_contexts: Array<{
    id: string;
    name: string;
    description: string | null;
    context_payload: Record<string, unknown>;
    aux_schema_required: boolean;
  }>;
};

export const getPrompts = cache(async (): Promise<PromptWithContexts[]> => {
  const supabase = createAnonServerClient();
  const { data, error } = await supabase
    .from("prompts")
    .select(
      `id, name, description, system_prompt, is_active, prompt_contexts:prompt_contexts(id, name, description, context_payload, aux_schema_required)`
    )
    .order("created_at", { ascending: false })
    .returns<PromptWithContexts[]>();

  if (error) {
    console.error("Failed to load prompts", error.message);
    return [];
  }

  return data ?? [];
});
