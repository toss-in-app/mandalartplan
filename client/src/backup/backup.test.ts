import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEmptyBoard } from '../lib/mandalart';
import { createDefaultSettings, createEmptyCheckins, normalizeSettings } from '../lib/state';
import { BACKUP_KEY_RE, deriveBackupKey, sha256Hex } from './key';
import { buildPayload, cellsFilled, normalizePayload } from './payload';

vi.mock('./config', () => ({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_0123456789',
  isBackupConfigured: () => true,
}));

const NOW = 1759000000000;

describe('백업 키', () => {
  it('sha256 으로 가공한 k+hex64 예요', async () => {
    const expected = createHash('sha256').update('mandalartplan:abc').digest('hex');
    expect(await sha256Hex('mandalartplan:abc')).toBe(expected);
    const key = await deriveBackupKey('abc');
    expect(key).toBe(`k${expected}`);
    expect(key).toMatch(BACKUP_KEY_RE);
    expect(await deriveBackupKey('abc')).toBe(key); // 같은 입력 → 같은 키
  });
});

describe('페이로드', () => {
  it('판·체크 기록·잠금만 담고, 다시 읽으면 같아요', () => {
    const board = createEmptyBoard(NOW);
    board.goal = '목표';
    const state = {
      boards: { version: 1 as const, active: 0, boards: [board] },
      checkins: { version: 1 as const, byBoard: { [board.id]: { days: { '2026-10-04': [1, 2] }, lastCompletedAt: NOW } } },
      settings: { ...createDefaultSettings(), unlocks: { extraBoard: true }, notification: 'agreed' as const },
    };
    const payload = buildPayload(state, NOW);
    expect(Object.keys(payload).sort()).toEqual(['boards', 'checkins', 'exportedAt', 'unlocks', 'version']);
    expect(normalizePayload(JSON.parse(JSON.stringify(payload)), NOW)).toEqual(payload);
    expect(cellsFilled(payload.boards)).toBe(1);
    expect(normalizePayload({ version: 2 })).toBeNull();
    expect(normalizePayload({ version: 1, boards: null, checkins: null })).toBeNull();
  });

  it('settings.backup 은 없으면 기본값, 키 형식이 틀리면 꺼짐으로 읽어요', () => {
    expect(normalizeSettings({ version: 1 })?.backup).toEqual({ enabled: false, key: null, lastBackupAt: null });
    const key = `k${'a'.repeat(64)}`;
    expect(normalizeSettings({ version: 1, backup: { enabled: true, key, lastBackupAt: 5 } })?.backup).toEqual({ enabled: true, key, lastBackupAt: 5 });
    expect(normalizeSettings({ version: 1, backup: { enabled: true, key: 'bad', lastBackupAt: 5 } })?.backup.enabled).toBe(false);
  });
});

describe('Supabase RPC 호출', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('backup_get 은 행이 없으면 null, 있으면 페이로드를 검증해서 돌려줘요', async () => {
    const { backupGet } = await import('./api');
    const key = `k${'b'.repeat(64)}`;
    const board = createEmptyBoard(NOW);
    const payload = buildPayload({ boards: { version: 1, active: 0, boards: [board] }, checkins: createEmptyCheckins(), settings: createDefaultSettings() }, NOW);
    const calls: Array<{ url: string; body: unknown; headers: Record<string, string> }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> });
      const body = calls.length === 1 ? [] : [{ payload, payload_version: 1, client_version: '0.1.0', cells_filled: 3, updated_at: '2026-10-04T00:00:00.000Z' }];
      return new Response(JSON.stringify(body), { status: 200 });
    }));
    expect(await backupGet(key)).toBeNull();
    const remote = await backupGet(key);
    expect(remote?.cellsFilled).toBe(3);
    expect(remote?.updatedAt).toBe(Date.parse('2026-10-04T00:00:00.000Z'));
    expect(remote?.payload).toEqual(payload);
    expect(calls[0].url).toBe('https://example.supabase.co/rest/v1/rpc/backup_get');
    expect(calls[0].body).toEqual({ p_key: key });
    expect(calls[0].headers.apikey).toBe('sb_publishable_test_0123456789');
    expect(calls[0].headers.Authorization).toBeUndefined();
  });

  it('upsert 는 서버 시각을 돌려주고, 실패는 BackupApiError 예요', async () => {
    const { BackupApiError, backupDelete, backupUpsert } = await import('./api');
    const key = `k${'c'.repeat(64)}`;
    const payload = buildPayload({ boards: { version: 1, active: 0, boards: [createEmptyBoard(NOW)] }, checkins: createEmptyCheckins(), settings: createDefaultSettings() }, NOW);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify('2026-10-04T01:02:03.000Z'), { status: 200 })));
    expect(await backupUpsert(key, payload, '0.1.0', 0)).toBe(Date.parse('2026-10-04T01:02:03.000Z'));

    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 403 })));
    await expect(backupDelete(key)).rejects.toMatchObject({ name: 'BackupApiError', stage: 'delete', code: 'http_403' });

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    await expect(backupUpsert(key, payload, '0.1.0', 0)).rejects.toBeInstanceOf(BackupApiError);
  });
});
