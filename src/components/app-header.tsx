import Link from "next/link";

import { createServerSupabaseClient } from "@/lib/supabase/auth";
import { signOut } from "@/modules/auth/actions";

export async function AppHeader() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = Boolean(user);

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
        <Link href="/" className="text-lg font-semibold">
          Voice Think
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm font-medium text-muted-foreground sm:justify-end">
          <Link href="/interact" className="transition-colors hover:text-foreground">
            Interact
          </Link>
          <Link href="/config" className="transition-colors hover:text-foreground">
            Config
          </Link>
          {isAuthenticated ? (
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-foreground hover:text-background"
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/auth/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
