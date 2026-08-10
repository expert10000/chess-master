import { describe, expect, it } from 'vitest';
import {
  BACKUP_STORAGE_KEYS,
  createCoachBackup,
  inspectCoachBackup,
  restoreCoachBackup,
  serializeCoachBackup,
} from '../src/lib/dataBackup';

class MemoryStorage {
  values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('v1.0.0 data backup', () => {
  it('exports only known local coach data keys', () => {
    const storage = new MemoryStorage();
    storage.setItem('stockfish-coach.weakness-profile.v1', '{"version":1}');
    storage.setItem('unrelated-key', 'secret');

    const backup = createCoachBackup(storage, '1.0.0', 123);
    expect(backup.appVersion).toBe('1.0.0');
    expect(backup.exportedAt).toBe(123);
    expect(backup.entries['stockfish-coach.weakness-profile.v1']).toBe('{"version":1}');
    expect(Object.keys(backup.entries)).not.toContain('unrelated-key');
  });

  it('round-trips valid backups and ignores unknown injected fields', () => {
    const source = new MemoryStorage();
    source.setItem('stockfish-coach.opening-repertoire.v1', '{"version":1}');
    source.setItem('stockfish-coach.ollama-model', 'qwen3:8b');

    const text = serializeCoachBackup(createCoachBackup(source, '1.0.0', 456));
    const parsed = JSON.parse(text);
    parsed.entries['unknown.future.key'] = 'ignored';

    const inspection = inspectCoachBackup(JSON.stringify(parsed));
    expect(inspection.valid).toBe(true);
    expect(inspection.restoredKeys).toContain('stockfish-coach.opening-repertoire.v1');
    expect(inspection.restoredKeys).not.toContain('unknown.future.key');

    const target = new MemoryStorage();
    restoreCoachBackup(target, inspection.backup!);
    expect(target.getItem('stockfish-coach.opening-repertoire.v1')).toBe('{"version":1}');
    expect(target.getItem('stockfish-coach.ollama-model')).toBe('qwen3:8b');
  });

  it('rejects non-coach JSON and unsupported schema versions', () => {
    expect(inspectCoachBackup('{"hello":"world"}').valid).toBe(false);
    const invalid = JSON.stringify({
      kind: 'stockfish-coach-backup',
      schema: 2,
      appVersion: '2.0.0',
      exportedAt: Date.now(),
      entries: {},
    });
    expect(inspectCoachBackup(invalid).valid).toBe(false);
  });

  it('removes missing known entries when restoring a full replacement backup', () => {
    const target = new MemoryStorage();
    for (const key of BACKUP_STORAGE_KEYS) target.setItem(key, 'old');

    const source = new MemoryStorage();
    source.setItem('stockfish-coach.goal-plans.v1', '{"version":1}');
    const backup = createCoachBackup(source, '1.0.0', 789);
    restoreCoachBackup(target, backup, true);

    expect(target.getItem('stockfish-coach.goal-plans.v1')).toBe('{"version":1}');
    expect(target.getItem('stockfish-coach.weekly-coach.v1')).toBeNull();
  });

  it('rejects malformed entry payload types', () => {
    const malformed = JSON.stringify({
      kind: 'stockfish-coach-backup',
      schema: 1,
      appVersion: '1.0.0',
      exportedAt: 123,
      entries: {
        'stockfish-coach.goal-plans.v1': { version: 1 },
      },
    });
    const inspection = inspectCoachBackup(malformed);
    expect(inspection.valid).toBe(false);
  });
});
