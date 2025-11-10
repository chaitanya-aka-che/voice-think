import { z } from "zod";

export const promptSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, "Name is required"),
  description: z.string().max(500).optional().nullable(),
  systemPrompt: z.string().min(1, "System prompt cannot be empty"),
  isActive: z
    .union([
      z.boolean(),
      z.string().transform((value) => value === "true" || value === "on"),
    ])
    .default(true),
});

export type PromptInput = z.infer<typeof promptSchema>;

const jsonRecord = z.record(z.string(), z.any());

export const promptContextSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  promptId: z.string().uuid({ message: "Prompt ID is required" }),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  contextPayload: z.union([z.string(), jsonRecord]).default(""),
  auxSchemaRequired: z
    .union([
      z.boolean(),
      z.string().transform((value) => value === "true" || value === "on"),
    ])
    .default(false),
});

export type PromptContextInput = z.infer<typeof promptContextSchema>;
