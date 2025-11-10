import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Access your voice coach configuration and interactions.",
};

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[]>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const redirectParam = resolvedParams.redirectTo;
  const redirectTo = Array.isArray(redirectParam)
    ? redirectParam[0]
    : redirectParam;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="flex max-w-3xl flex-col items-center gap-8 text-center">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome back to Voice Think
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in or create an account to keep your goals, contexts, and daily reflections in sync
            across both voice and chat experiences.
          </p>
        </div>
        <LoginForm redirectTo={redirectTo} />
      </div>
    </main>
  );
}
