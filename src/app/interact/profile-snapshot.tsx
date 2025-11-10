import type { ProfileData, ProfileMetrics } from "@/modules/profile/types";

function formatDelta(delta: number): string {
  if (delta === 0) return "no change";
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}

type ProfileSnapshotProps = {
  profileData: ProfileData | null;
  metrics: ProfileMetrics | null;
};

export function ProfileSnapshot({ profileData, metrics }: ProfileSnapshotProps) {
  const interactionStats = metrics?.interactions;
  const goalCounts = metrics?.goalCounts;
  const goalChanges = metrics?.goalChanges;

  const goals = profileData?.goals ?? [];
  const activeGoals = goals.filter((goal) => goal.status === "active");

  const interactionCards = interactionStats
    ? [
        {
          label: "3-day check-ins",
          value: interactionStats.last3Days.count,
          delta: interactionStats.last3Days.delta,
        },
        {
          label: "7-day check-ins",
          value: interactionStats.last7Days.count,
          delta: interactionStats.last7Days.delta,
        },
        {
          label: "30-day check-ins",
          value: interactionStats.last30Days.count,
          delta: interactionStats.last30Days.delta,
        },
      ]
    : [];

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Progress snapshot</h2>
        <p className="text-xs text-muted-foreground">
          Automatic stats based on your recent goals and conversations. Updates after every interaction.
        </p>
      </div>

      {metrics ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {interactionCards.map((card) => (
            <div key={card.label} className="rounded-md border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold">{card.value}</p>
              <p className="text-xs text-muted-foreground">vs previous window {formatDelta(card.delta)}</p>
            </div>
          ))}
          <div className="rounded-md border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Goal status</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Active: {goalCounts?.active ?? 0}</li>
              <li>Completed: {goalCounts?.completed ?? 0}</li>
              <li>Paused: {goalCounts?.paused ?? 0}</li>
            </ul>
          </div>
          <div className="rounded-md border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Goal changes</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>3-day updates: {goalChanges?.last3Days ?? 0}</li>
              <li>7-day updates: {goalChanges?.last7Days ?? 0}</li>
              <li>30-day updates: {goalChanges?.last30Days ?? 0}</li>
            </ul>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Start a conversation to generate your first set of insights.
        </p>
      )}

      <div className="mt-6 space-y-2">
        <h3 className="text-sm font-semibold">Active goals</h3>
        {activeGoals.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {activeGoals.map((goal) => (
              <li key={goal.id} className="rounded border border-border bg-background p-3">
                <p className="font-medium">{goal.title}</p>
                {goal.description ? (
                  <p className="text-xs text-muted-foreground">{goal.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No active goals yet. Capture one during your next interaction.</p>
        )}
      </div>
    </section>
  );
}
