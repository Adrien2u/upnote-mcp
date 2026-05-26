import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'path';

// Set up a fake APPDATA before importing
const FAKE_APPDATA = 'C:\\FakeUsers\\TestUser\\AppData\\Roaming';

vi.stubEnv('APPDATA', FAKE_APPDATA);

// Mock fs to control file existence
vi.mock('fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('fs')>();
  return {
    ...original,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

import { existsSync, readFileSync } from 'fs';
import { getDbPath, getConfigPath, getDataVersion, assertDataVersion, EXPECTED_DATA_VERSION } from '../paths.js';

const mockExists = existsSync as ReturnType<typeof vi.fn>;
const mockRead = readFileSync as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockExists.mockReset();
  mockRead.mockReset();
});

describe('getDbPath', () => {
  it('returns path inside APPDATA/UpNote', () => {
    mockExists.mockReturnValue(true);
    const p = getDbPath();
    expect(p).toContain('UpNote');
    expect(p).toContain('upnote.sqlite3');
  });

  it('uses APPDATA environment variable', () => {
    mockExists.mockReturnValue(true);
    const p = getDbPath();
    expect(p.startsWith(FAKE_APPDATA)).toBe(true);
  });

  it('throws when database file does not exist', () => {
    mockExists.mockReturnValue(false);
    expect(() => getDbPath()).toThrow(/not found/);
  });

  it('throws when APPDATA is not set', () => {
    vi.stubEnv('APPDATA', '');
    mockExists.mockReturnValue(false);
    expect(() => getDbPath()).toThrow();
    vi.stubEnv('APPDATA', FAKE_APPDATA); // restore
  });
});

describe('getConfigPath', () => {
  it('returns path to config.json inside UpNote folder', () => {
    const p = getConfigPath();
    expect(p).toContain('config.json');
    expect(p).toContain('UpNote');
  });
});

describe('getDataVersion', () => {
  it('returns dataVersion from config.json', () => {
    mockExists.mockReturnValue(true);
    mockRead.mockReturnValue(JSON.stringify({ dataVersion: 16 }));
    expect(getDataVersion()).toBe(16);
  });

  it('returns -1 when config.json does not exist', () => {
    mockExists.mockReturnValue(false);
    expect(getDataVersion()).toBe(-1);
  });

  it('returns -1 when config.json has no dataVersion', () => {
    mockExists.mockReturnValue(true);
    mockRead.mockReturnValue(JSON.stringify({ isDarkTheme: true }));
    expect(getDataVersion()).toBe(-1);
  });

  it('returns -1 on JSON parse error', () => {
    mockExists.mockReturnValue(true);
    mockRead.mockReturnValue('not-valid-json{{{');
    expect(getDataVersion()).toBe(-1);
  });
});

describe('assertDataVersion', () => {
  it('does not throw when version matches', () => {
    mockExists.mockReturnValue(true);
    mockRead.mockReturnValue(JSON.stringify({ dataVersion: EXPECTED_DATA_VERSION }));
    expect(() => assertDataVersion()).not.toThrow();
  });

  it('does not throw when config is missing (-1)', () => {
    mockExists.mockReturnValue(false);
    expect(() => assertDataVersion()).not.toThrow();
  });

  it('throws when version does not match', () => {
    mockExists.mockReturnValue(true);
    mockRead.mockReturnValue(JSON.stringify({ dataVersion: 99 }));
    expect(() => assertDataVersion()).toThrow(/schema version mismatch/);
  });

  it('includes version numbers in error message', () => {
    mockExists.mockReturnValue(true);
    mockRead.mockReturnValue(JSON.stringify({ dataVersion: 99 }));
    try {
      assertDataVersion();
    } catch (e) {
      expect((e as Error).message).toContain('99');
      expect((e as Error).message).toContain(String(EXPECTED_DATA_VERSION));
    }
  });

  it('EXPECTED_DATA_VERSION is 16', () => {
    expect(EXPECTED_DATA_VERSION).toBe(16);
  });
});
