import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-8 bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-3xl space-y-6 text-center sm:text-left">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Daily Momentum Assistant
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Shape your day with hands-free planning and reflective check-ins.
        </h1>
        <p className="text-pretty text-lg text-muted-foreground">
          Configure prompts once, speak from anywhere, and let the assistant keep your goals and context in sync.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          href="/interact"
        >
          Start a session
        </Link>
        <Link
          className="inline-flex h-11 items-center justify-center rounded-md border border-border px-6 text-sm font-medium text-foreground transition hover:bg-muted"
          href="/config"
        >
          Configure prompts
        </Link>
      </div>
    </main>
  );
}
