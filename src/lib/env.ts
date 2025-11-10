import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z
      .string()
      .min(1, "Missing Supabase service role key"),
    SUPABASE_JWT_SECRET: z
      .string()
      .min(1, "Missing Supabase JWT secret"),
    SUPABASE_PROJECT_REF: z.string().min(1, "Missing Supabase project ref"),
    SUPABASE_DB_PASSWORD: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1, "Missing OpenAI API key"),
    OPENAI_CHAT_MODEL: z.string().min(1).default("gpt-4o-mini"),
    OPENAI_REALTIME_MODEL: z
      .string()
      .min(1)
      .default("gpt-4o-realtime-preview"),
    APP_ENV: z.enum(["local", "preview", "production"]).default("local"),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z
      .string()
      .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z
      .string()
      .min(1, "Missing Supabase anon key"),
  },
  runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
    SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF,
    SUPABASE_DB_PASSWORD: process.env.SUPABASE_DB_PASSWORD,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_CHAT_MODEL: process.env.OPENAI_CHAT_MODEL,
    OPENAI_REALTIME_MODEL: process.env.OPENAI_REALTIME_MODEL,
    APP_ENV: process.env.APP_ENV,
  },
  emptyStringAsUndefined: true,
});

export type AppEnvironment = typeof env.APP_ENV;
