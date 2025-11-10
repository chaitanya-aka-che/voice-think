"use client";

import { createBrowserClient, type SupabaseClient } from "@supabase/ssr";

import { env } from "../env";
import type { Database } from "./types";

type PublicSupabaseClient = SupabaseClient<Database, "public">;

let browserClient: PublicSupabaseClient | null = null;
let authListenerAttached = false;

export function getBrowserClient(): PublicSupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  }

  if (!authListenerAttached) {
    browserClient.auth.onAuthStateChange((_event, session) => {
      fetch("/auth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event: _event, session }),
        credentials: "include",
      }).catch(() => {
        // ignore network errors; middleware will detect lack of session
      });
    });
    authListenerAttached = true;
  }

  return browserClient;
}
