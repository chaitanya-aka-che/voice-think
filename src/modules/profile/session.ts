import { randomUUID } from "crypto";

import { createServiceClient } from "@/lib/supabase/server";

import { getRelativeFilePath } from "./interactions";
import type { ProfileData, ProfileMetrics } from "./types";

export type UserSessionProfile = {
  sessionUuid: string;
  interactionFile: string;
  profileData: ProfileData | null;
  metrics: ProfileMetrics | null;
};

type UserProfileRow = {
  session_uuid: string | null;
  interaction_file: string | null;
  profile_data: unknown;
  metrics: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normaliseProfileData(data: unknown): ProfileData | null {
  if (!isRecord(data)) {
    return null;
  }

  const goalsRaw = data.goals;
  const goals = Array.isArray(goalsRaw) ? (goalsRaw as ProfileData["goals"]) : [];

  return { goals };
}

function normaliseProfileMetrics(data: unknown): ProfileMetrics | null {
  if (!isRecord(data)) {
    return null;
  }

  const interactions = data.interactions;
  const goalCounts = data.goalCounts;
  const goalChanges = data.goalChanges;

  if (!isRecord(interactions) || !isRecord(goalCounts) || !isRecord(goalChanges)) {
    return null;
  }

  return data as ProfileMetrics;
}

async function ensureSessionRecord(db: ReturnType<typeof createServiceClient>, sessionUuid: string, userId: string) {
  const existing = await db
    .from("sessions")
    .select("session_uuid")
    .eq("session_uuid", sessionUuid)
    .maybeSingle();

  if (existing.data) {
    await db
      .from("sessions")
      .update({
        last_seen_at: new Date().toISOString(),
        metadata: { user_id: userId },
      })
      .eq("session_uuid", sessionUuid);
    return;
  }

  await db.from("sessions").insert({
    session_uuid: sessionUuid,
    metadata: { user_id: userId },
  });
}

export async function resolveUserSessionProfile(userId: string): Promise<UserSessionProfile> {
  const db = createServiceClient();

  const profileQuery = await db
    .from("user_profiles")
    .select("session_uuid, interaction_file, profile_data, metrics")
    .eq("user_id", userId)
    .maybeSingle();

  const profile = (profileQuery.data as UserProfileRow | null) ?? null;

  const sessionUuid = profile?.session_uuid ?? randomUUID();
  const interactionFile = profile?.interaction_file ?? getRelativeFilePath(userId);
  const profileData = normaliseProfileData(profile?.profile_data ?? null);
  const metrics = normaliseProfileMetrics(profile?.metrics ?? null);

  await ensureSessionRecord(db, sessionUuid, userId);

  await db.from("user_profiles").upsert(
    {
      user_id: userId,
      session_uuid: sessionUuid,
      interaction_file: interactionFile,
    },
    { onConflict: "user_id" },
  );

  return {
    sessionUuid,
    interactionFile,
    profileData,
    metrics,
  };
}
