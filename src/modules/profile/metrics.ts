import { getRelativeFilePath, loadInteractionLog } from "./interactions";
import type {
  GoalChangeMetrics,
  GoalCounts,
  GoalSnapshot,
  InteractionMetrics,
  InteractionWindowStats,
  ProfileData,
  ProfileMetrics,
} from "./types";
import { createServiceClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

const DAY_MS = 24 * 60 * 60 * 1000;

type GoalRecord = Pick<
  Tables<"user_goals">,
  "id" | "title" | "description" | "goal_state" | "status" | "updated_at" | "created_at"
>;

function computeWindowStats(entries: readonly string[], now: number, days: number): InteractionWindowStats {
  const windowMs = days * DAY_MS;
  const currentStart = now - windowMs;
  const previousStart = now - windowMs * 2;

  let currentCount = 0;
  let previousCount = 0;

  for (const entry of entries) {
    const timestamp = Date.parse(entry);
    if (Number.isNaN(timestamp)) continue;

    if (timestamp >= currentStart) {
      currentCount += 1;
    } else if (timestamp >= previousStart) {
      previousCount += 1;
    }
  }

  return {
    count: currentCount,
    previousCount,
    delta: currentCount - previousCount,
  };
}

function calculateInteractionMetrics(timestamps: readonly string[]): InteractionMetrics {
  const now = Date.now();

  return {
    last3Days: computeWindowStats(timestamps, now, 3),
    last7Days: computeWindowStats(timestamps, now, 7),
    last30Days: computeWindowStats(timestamps, now, 30),
  };
}

function summarizeGoalCounts(goals: readonly GoalRecord[]): GoalCounts {
  return goals.reduce(
    (acc, goal) => {
      switch (goal.status) {
        case "active":
          acc.active += 1;
          break;
        case "completed":
          acc.completed += 1;
          break;
        case "paused":
          acc.paused += 1;
          break;
        default:
          break;
      }
      return acc;
    },
    { active: 0, completed: 0, paused: 0 } satisfies GoalCounts,
  );
}

function countGoalChanges(goals: readonly GoalRecord[], days: number): number {
  const now = Date.now();
  const threshold = now - days * DAY_MS;

  return goals.filter((goal) => {
    const updatedAt = goal.updated_at ?? goal.created_at;
    if (!updatedAt) return false;
    const timestamp = Date.parse(updatedAt as string);
    if (Number.isNaN(timestamp)) return false;
    return timestamp >= threshold;
  }).length;
}

function summarizeGoalChanges(goals: readonly GoalRecord[]): GoalChangeMetrics {
  return {
    last3Days: countGoalChanges(goals, 3),
    last7Days: countGoalChanges(goals, 7),
    last30Days: countGoalChanges(goals, 30),
  };
}

function serializeGoals(goals: readonly GoalRecord[]): GoalSnapshot[] {
  return goals.map((goal) => ({
    id: goal.id,
    title: goal.title,
    description: goal.description,
    status: goal.status,
    goalState: goal.goal_state,
    updatedAt: goal.updated_at,
    createdAt: goal.created_at,
  }));
}

export async function updateUserProfileMetrics(userId: string, sessionUuid: string) {
  const db = createServiceClient();

  const interactionEntries = await loadInteractionLog(userId);
  const interactionTimestamps = interactionEntries.map((entry) => entry.timestamp);
  const interactionMetrics = calculateInteractionMetrics(interactionTimestamps);

  const goalsQuery = await db
    .from("user_goals")
    .select("id, title, description, goal_state, status, updated_at, created_at")
    .eq("session_uuid", sessionUuid);

  if (goalsQuery.error) {
    throw new Error(goalsQuery.error.message);
  }

  const goals = (goalsQuery.data as GoalRecord[]) ?? [];

  const goalMetrics = summarizeGoalCounts(goals);
  const goalChanges = summarizeGoalChanges(goals);

  const profileData: ProfileData = {
    goals: serializeGoals(goals),
  };

  const metrics: ProfileMetrics = {
    interactions: interactionMetrics,
    goalCounts: goalMetrics,
    goalChanges,
  };

  await db.from("user_profiles").upsert(
    {
      user_id: userId,
      session_uuid: sessionUuid,
      interaction_file: getRelativeFilePath(userId),
      profile_data: profileData,
      metrics,
    },
    { onConflict: "user_id" },
  );
}
