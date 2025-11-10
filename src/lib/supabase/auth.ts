import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { env } from "../env";
import type { Database } from "./types";

type CookieStoreLike = {
  getAll?: () => Array<{ name: string; value: string }>;
};

type HeaderSource = {
  get: (name: string) => string | null;
};

function parseCookieHeader(headerValue: string | null) {
  if (!headerValue) return [] as Array<{ name: string; value: string }>;

  return headerValue
    .split(/;\s*/)
    .filter(Boolean)
    .map((chunk) => {
      const [name, ...rest] = chunk.split("=");
      return {
        name,
        value: rest.join("="),
      };
    });
}

function getAllCookies(store: CookieStoreLike | undefined, fallbackHeader?: string | null) {
  if (store?.getAll) {
    return store.getAll();
  }

  return fallbackHeader ? parseCookieHeader(fallbackHeader) : [];
}

export async function createServerSupabaseClient() {
  const cookieStore = (await cookies()) as CookieStoreLike;

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return getAllCookies(cookieStore);
        },
        setAll() {
          // Server Components cannot mutate cookies; rely on route handlers/server actions instead.
        },
      },
    },
  );
}

export function createMiddlewareSupabaseClient(
  request: NextRequest,
  response: NextResponse,
) {
  const headerSource: HeaderSource = request.headers;
  const requestCookies = request.cookies as CookieStoreLike;

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return getAllCookies(requestCookies, headerSource.get("cookie"));
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set({
              name,
              value,
              ...options,
            });
          });
        },
      },
    },
  );
}
