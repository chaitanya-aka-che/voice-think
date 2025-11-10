import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "../env";
import type { Database } from "./types";

const baseOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
} as const;

type PublicSupabaseClient = SupabaseClient<Database, "public">;

export function createServiceClient(): PublicSupabaseClient {
  return createClient<Database, "public">(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    baseOptions,
  );
}

export function createAnonServerClient(): PublicSupabaseClient {
  return createClient<Database, "public">(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    baseOptions,
  );
}
