"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getBrowserClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";

type LoginFormProps = {
  redirectTo?: string;
};

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserClient(), []);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === "sign-in" ? "sign-up" : "sign-in"));
    setError(null);
    setInfo(null);
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setLoading(true);
      setError(null);
      setInfo(null);

      try {
        if (mode === "sign-in") {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInError) {
            throw signInError;
          }
        } else {
          const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
          });

          if (signUpError) {
            throw signUpError;
          }

          if (!data.session) {
            setInfo("Check your email to confirm the account before signing in.");
            setMode("sign-in");
            return;
          }
        }

        router.replace(redirectTo ?? "/interact");
        router.refresh();
      } catch (authError) {
        const message =
          authError instanceof Error
            ? authError.message
            : "Unable to authenticate. Please try again.";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [email, mode, password, redirectTo, router, supabase],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm"
    >
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "sign-in" ? "Sign in" : "Create an account"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === "sign-in"
            ? "Access your personalised coach dashboard."
            : "Start building daily momentum with a new account."}
        </p>
      </div>

      <div className="space-y-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="••••••••"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            minLength={8}
          />
        </label>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {info ? <p className="text-sm text-muted-foreground">{info}</p> : null}

      <button
        type="submit"
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
        disabled={loading}
      >
        {loading ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}
      </button>

      <button
        type="button"
        className="w-full text-center text-sm text-primary underline-offset-4 hover:underline"
        onClick={toggleMode}
      >
        {mode === "sign-in"
          ? "Need an account? Sign up"
          : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
