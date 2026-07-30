import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { migrateSave, type GameSave } from "@everloom/core";

interface BackupRecord {
  readonly id: string;
  readonly createdAt: number;
  readonly reason: string;
  readonly save: GameSave;
}

interface EverloomDatabase extends DBSchema {
  saves: {
    key: string;
    value: GameSave;
  };
  backups: {
    key: string;
    value: BackupRecord;
    indexes: { "by-created-at": number };
  };
}

const DATABASE_NAME = "everloom-local";
const CURRENT_SAVE_KEY = "current";
const MAX_BACKUPS = 5;
let databasePromise: Promise<IDBPDatabase<EverloomDatabase>> | null = null;

function database(): Promise<IDBPDatabase<EverloomDatabase>> {
  databasePromise ??= openDB<EverloomDatabase>(DATABASE_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("saves")) db.createObjectStore("saves");
      if (!db.objectStoreNames.contains("backups")) {
        const backups = db.createObjectStore("backups", { keyPath: "id" });
        backups.createIndex("by-created-at", "createdAt");
      }
    },
  });
  return databasePromise;
}

export async function loadSave(): Promise<GameSave | null> {
  const value = await (await database()).get("saves", CURRENT_SAVE_KEY);
  return value ? migrateSave(value) : null;
}

export async function writeSave(save: GameSave, reason: string, createBackup = false): Promise<void> {
  const db = await database();
  const previous = await db.get("saves", CURRENT_SAVE_KEY);
  const transaction = db.transaction(["saves", "backups"], "readwrite");
  if (previous && createBackup) {
    const createdAt = Date.now();
    await transaction.objectStore("backups").put({
      id: `${createdAt}-${previous.activitySequence}`,
      createdAt,
      reason,
      save: previous,
    });
  }
  await transaction.objectStore("saves").put(save, CURRENT_SAVE_KEY);
  await transaction.done;

  const backups = (await db.getAllFromIndex("backups", "by-created-at"))
    .sort((left, right) => right.createdAt - left.createdAt);
  for (const backup of backups.slice(MAX_BACKUPS)) await db.delete("backups", backup.id);
}

export async function listBackups(): Promise<readonly BackupRecord[]> {
  return (await (await database()).getAllFromIndex("backups", "by-created-at"))
    .sort((left, right) => right.createdAt - left.createdAt);
}

export async function clearSaves(): Promise<void> {
  const db = await database();
  const transaction = db.transaction(["saves", "backups"], "readwrite");
  await transaction.objectStore("saves").clear();
  await transaction.objectStore("backups").clear();
  await transaction.done;
}
