import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

export function getDbPath(): string {
  const appdata = process.env['APPDATA'];
  if (!appdata) throw new Error('APPDATA environment variable not set');

  const dbPath = join(appdata, 'UpNote', 'upnote.sqlite3');
  if (!existsSync(dbPath)) {
    throw new Error(`UpNote database not found at: ${dbPath}\nEnsure UpNote is installed and has been launched at least once.`);
  }
  return dbPath;
}

export function getConfigPath(): string {
  const appdata = process.env['APPDATA'];
  if (!appdata) throw new Error('APPDATA environment variable not set');
  return join(appdata, 'UpNote', 'config.json');
}

export function getDataVersion(): number {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return -1;
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as { dataVersion?: number };
    return config.dataVersion ?? -1;
  } catch {
    return -1;
  }
}

export const EXPECTED_DATA_VERSION = 16;

export function assertDataVersion(): void {
  const version = getDataVersion();
  if (version !== -1 && version !== EXPECTED_DATA_VERSION) {
    throw new Error(
      `UpNote schema version mismatch: expected ${EXPECTED_DATA_VERSION}, got ${version}.\n` +
      `UpNote may have been updated. Please file an issue at the upnote-tools repo.`
    );
  }
}
