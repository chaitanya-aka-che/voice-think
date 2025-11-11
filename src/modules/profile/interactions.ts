import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const INTERACTIONS_DIR = join(process.cwd(), "data", "interactions");
const MAX_STORED_ENTRIES = 200;

export type InteractionRole = "user" | "assistant";

export type InteractionEntry = {
  timestamp: string;
  role: InteractionRole;
  content: string;
};

type InteractionLog = {
  userId: string;
  entries: InteractionEntry[];
  updatedAt: string;
};

function getFilePath(userId: string) {
  return join(INTERACTIONS_DIR, `${userId}.json`);
}

export function getRelativeFilePath(userId: string) {
  return join("interactions", `${userId}.json`);
}

async function readLog(userId: string): Promise<InteractionLog | null> {
  try {
    const filePath = getFilePath(userId);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as InteractionLog;
    if (Array.isArray(parsed.entries)) {
      return parsed;
    }
    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeLog(userId: string, log: InteractionLog) {
  await mkdir(INTERACTIONS_DIR, { recursive: true });
  const filePath = getFilePath(userId);
  await writeFile(filePath, JSON.stringify(log, null, 2), "utf8");
}

export async function appendInteraction(userId: string, entry: InteractionEntry) {
  const existing = (await readLog(userId)) ?? {
    userId,
    entries: [],
    updatedAt: entry.timestamp,
  };

  const nextEntries = [...existing.entries, entry].slice(-MAX_STORED_ENTRIES);

  const nextLog: InteractionLog = {
    userId,
    entries: nextEntries,
    updatedAt: entry.timestamp,
  };

  await writeLog(userId, nextLog);
}

export async function loadRecentInteractions(userId: string, limit = 50) {
  const log = await readLog(userId);
  if (!log) return [];
  return log.entries.slice(-limit);
}

export function buildInteractionContext(entries: InteractionEntry[]) {
  if (entries.length === 0) {
    return "No prior interactions recorded.";
  }

  return [
    "Recent interaction log (most recent last):",
    ...entries.map((entry) => {
      const timestamp = new Date(entry.timestamp).toISOString();
      return `- [${entry.role}] ${timestamp}: ${entry.content}`;
    }),
  ].join("\n");
}

export async function loadInteractionLog(userId: string) {
  const log = await readLog(userId);
  return log?.entries ?? [];
}
