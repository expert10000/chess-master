import { app } from 'electron';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface AppSettings {
  stockfishPath?: string;
}

export class SettingsStore {
  private get filePath(): string {
    return join(app.getPath('userData'), 'settings.json');
  }

  async read(): Promise<AppSettings> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      return JSON.parse(raw) as AppSettings;
    } catch {
      return {};
    }
  }

  async write(settings: AppSettings): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  }

  async setStockfishPath(stockfishPath: string): Promise<void> {
    const current = await this.read();
    await this.write({ ...current, stockfishPath });
  }
}
