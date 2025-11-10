"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServiceClient } from "../../lib/supabase/server";
import type { Json } from "../../lib/supabase/types";
import { promptContextSchema, promptSchema } from "./schemas";

const formDataToObject = (formData: FormData) =>
  Object.fromEntries(formData.entries());

const deleteSchema = z.object({
  id: z.string().uuid(),
});

export async function savePrompt(formData: FormData) {
  const parsed = promptSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join(", "));
  }

  const { id, name, description, systemPrompt, isActive } = parsed.data;
  const supabase = createServiceClient();

  const existing = await supabase
    .from("prompts")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  const existingId = existing.data?.[0]?.id;
  const targetId = existingId ?? id ?? undefined;

  const { error } = await supabase.from("prompts").upsert(
    {
      id: targetId,
      name,
      description: description ?? null,
      system_prompt: systemPrompt,
      is_active: isActive,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/config");
}

export async function deletePrompt(formData: FormData) {
  const parsed = deleteSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join(", "));
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("prompts")
    .delete()
    .eq("id", parsed.data.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/config");
}

export async function savePromptContext(formData: FormData) {
  const raw = formDataToObject(formData);

  const parsed = promptContextSchema.safeParse({
    ...raw,
    promptId: raw.promptId ?? raw.prompt_id,
    auxSchemaRequired: raw.auxSchemaRequired ?? raw.aux_schema_required,
    contextPayload: raw.contextPayload ?? raw.context_payload,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }

  const { id, promptId, name, description, contextPayload, auxSchemaRequired } =
    parsed.data;

  let payload: Json;
  if (typeof contextPayload === "string") {
    if (!contextPayload.trim()) {
      payload = {};
    } else {
      try {
        payload = JSON.parse(contextPayload) as Json;
      } catch {
        throw new Error("Context payload must be valid JSON");
      }
    }
  } else {
    payload = contextPayload as Json;
  }

  const supabase = createServiceClient();

  const { error } = await supabase.from("prompt_contexts").upsert(
    {
      id: id ?? undefined,
      prompt_id: promptId,
      name,
      description: description ?? null,
      context_payload: payload,
      aux_schema_required: auxSchemaRequired,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/config");
}

export async function deletePromptContext(formData: FormData) {
  const parsed = deleteSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join(", "));
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("prompt_contexts")
    .delete()
    .eq("id", parsed.data.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/config");
}
