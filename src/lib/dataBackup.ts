export const STOCKFISH_COACH_BACKUP_SCHEMA = 1;
export const STOCKFISH_COACH_BACKUP_KIND = 'stockfish-coach-backup';

export const BACKUP_STORAGE_KEYS = [
  'stockfish-coach.weakness-profile.v1',
  'stockfish-coach.opening-repertoire.v1',
  'stockfish-coach.spaced-repetition.v1',
  'stockfish-coach.training-analytics.v1',
  'stockfish-coach.daily-session-reports.v1',
  'stockfish-coach.weekly-coach.v1',
  'stockfish-coach.goal-plans.v1',
  'stockfish-coach.ollama-enabled',
  'stockfish-coach.ollama-model',
  'stockfish-coach.ui-font-size.v1',
] as const;

export type BackupStorageKey = typeof BACKUP_STORAGE_KEYS[number];

export interface CoachBackup {
  kind: typeof STOCKFISH_COACH_BACKUP_KIND;
  schema: typeof STOCKFISH_COACH_BACKUP_SCHEMA;
  appVersion: string;
  exportedAt: number;
  entries: Partial<Record<BackupStorageKey, string>>;
}

export interface BackupInspection {
  valid: boolean;
  backup: CoachBackup | null;
  error: string | null;
  restoredKeys: BackupStorageKey[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createCoachBackup(
  storage: StorageLike,
  appVersion = '1.0.1',
  now = Date.now(),
): CoachBackup {
  const entries: Partial<Record<BackupStorageKey, string>> = {};
  for (const key of BACKUP_STORAGE_KEYS) {
    const value = storage.getItem(key);
    if (value !== null) entries[key] = value;
  }
  return {
    kind: STOCKFISH_COACH_BACKUP_KIND,
    schema: STOCKFISH_COACH_BACKUP_SCHEMA,
    appVersion,
    exportedAt: now,
    entries,
  };
}

export function serializeCoachBackup(backup: CoachBackup): string {
  return JSON.stringify(backup, null, 2);
}

function isKnownBackupKey(key: string): key is BackupStorageKey {
  return (BACKUP_STORAGE_KEYS as readonly string[]).includes(key);
}

export function inspectCoachBackup(text: string): BackupInspection {
  try {
    const parsed = JSON.parse(text) as Partial<CoachBackup>;
    if (parsed.kind !== STOCKFISH_COACH_BACKUP_KIND) {
      return { valid: false, backup: null, error: 'This is not a Stockfish Coach backup file.', restoredKeys: [] };
    }
    if (parsed.schema !== STOCKFISH_COACH_BACKUP_SCHEMA) {
      return {
        valid: false,
        backup: null,
        error: `Unsupported backup schema ${String(parsed.schema)}. Expected schema ${STOCKFISH_COACH_BACKUP_SCHEMA}.`,
        restoredKeys: [],
      };
    }
    if (!parsed.entries || typeof parsed.entries !== 'object' || Array.isArray(parsed.entries)) {
      return { valid: false, backup: null, error: 'Backup entries are missing or invalid.', restoredKeys: [] };
    }
    if (typeof parsed.exportedAt !== 'number' || !Number.isFinite(parsed.exportedAt)) {
      return { valid: false, backup: null, error: 'Backup export timestamp is invalid.', restoredKeys: [] };
    }
    if (typeof parsed.appVersion !== 'string') {
      return { valid: false, backup: null, error: 'Backup app version is invalid.', restoredKeys: [] };
    }

    const entries: Partial<Record<BackupStorageKey, string>> = {};
    const restoredKeys: BackupStorageKey[] = [];
    for (const [key, value] of Object.entries(parsed.entries)) {
      if (!isKnownBackupKey(key)) continue;
      if (typeof value !== 'string') {
        return {
          valid: false,
          backup: null,
          error: `Backup entry ${key} is not a serialized string.`,
          restoredKeys: [],
        };
      }
      entries[key] = value;
      restoredKeys.push(key);
    }

    const backup: CoachBackup = {
      kind: STOCKFISH_COACH_BACKUP_KIND,
      schema: STOCKFISH_COACH_BACKUP_SCHEMA,
      appVersion: parsed.appVersion,
      exportedAt: parsed.exportedAt,
      entries,
    };
    return { valid: true, backup, error: null, restoredKeys };
  } catch {
    return { valid: false, backup: null, error: 'Backup file is not valid JSON.', restoredKeys: [] };
  }
}

export function restoreCoachBackup(
  storage: StorageLike,
  backup: CoachBackup,
  replaceMissing = true,
): BackupStorageKey[] {
  const restored: BackupStorageKey[] = [];
  for (const key of BACKUP_STORAGE_KEYS) {
    const value = backup.entries[key];
    if (typeof value === 'string') {
      storage.setItem(key, value);
      restored.push(key);
    } else if (replaceMissing) {
      storage.removeItem(key);
    }
  }
  return restored;
}

export function backupFileName(now = Date.now()): string {
  const date = new Date(now);
  const stamp = [
    date.getFullYear(),
    `${date.getMonth() + 1}`.padStart(2, '0'),
    `${date.getDate()}`.padStart(2, '0'),
    '-',
    `${date.getHours()}`.padStart(2, '0'),
    `${date.getMinutes()}`.padStart(2, '0'),
  ].join('');
  return `stockfish-coach-backup-${stamp}.json`;
}
