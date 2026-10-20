import { afterEach, describe, expect, it, vi } from 'vitest';

import { AiDraftError, requestActions, requestSubs } from './api';
import { deriveAiKey } from './key';

const KEY = `k${'a'.repeat(64)}`;
const SUBS = ['체력 강화', '제구력', '구위', '멘탈', '구속 향상', '변화구', '몸 관리', '인성과 태도'];

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'resolved';
  } catch (error) {
    return error instanceof AiDraftError ? error.code : 'other';
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AI 서버 호출', () => {
  it('세부 목표: apikey 헤더로 계약대로 보내고 8칸을 받아요', async () => {
    const fetchMock = respond(200, { ok: true, mode: 'subs', subs: SUBS, model: 'claude-haiku-5-5', promptVersion: 1 });
    vi.stubGlobal('fetch', fetchMock);
    const res = await requestSubs(KEY, '8구단 드래프트 1순위', Array(8).fill(''));
    expect(res).toEqual({ subs: SUBS, model: 'claude-haiku-5-5', promptVersion: 1 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/functions\/v1\/mandalart-draft$/);
    expect((init.headers as Record<string, string>).apikey).toBeDefined();
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(JSON.parse(String(init.body))).toEqual({ mode: 'subs', key: KEY, goal: '8구단 드래프트 1순위', subs: Array(8).fill('') });
  });

  it('실천: 세부 목표 하나(only)씩', async () => {
    const actions = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const fetchMock = respond(200, { ok: true, mode: 'actions', only: 2, actions, filled: 8, model: 'claude-haiku-5-5', promptVersion: 1 });
    vi.stubGlobal('fetch', fetchMock);
    const res = await requestActions(KEY, '목표', SUBS, 2, Array(8).fill(''));
    expect(res).toMatchObject({ only: 2, actions, filled: 8 });
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toMatchObject({ mode: 'actions', only: 2 });
  });

  it('서버 오류 코드를 그대로, 모르는 응답은 상태 코드로 나눠요', async () => {
    vi.stubGlobal('fetch', respond(200, { ok: false, error: 'refused' }));
    expect(await codeOf(requestSubs(KEY, '목표', SUBS))).toBe('refused');
    vi.stubGlobal('fetch', respond(200, { ok: false, error: 'limited' }));
    expect(await codeOf(requestSubs(KEY, '목표', SUBS))).toBe('limited');
    vi.stubGlobal('fetch', respond(400, { ok: false, error: 'invalid' }));
    expect(await codeOf(requestSubs(KEY, '목표', SUBS))).toBe('invalid');
    vi.stubGlobal('fetch', respond(503, { message: 'down' }));
    expect(await codeOf(requestSubs(KEY, '목표', SUBS))).toBe('busy');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    expect(await codeOf(requestSubs(KEY, '목표', SUBS))).toBe('network');
  });

  it('형식이 다른 성공 응답은 invalid_output', async () => {
    vi.stubGlobal('fetch', respond(200, { ok: true, mode: 'subs', subs: ['하나뿐'], model: 'm', promptVersion: 1 }));
    expect(await codeOf(requestSubs(KEY, '목표', SUBS))).toBe('invalid_output');
    vi.stubGlobal('fetch', respond(200, { ok: true, mode: 'subs', subs: SUBS }));
    expect(await codeOf(requestSubs(KEY, '목표', SUBS))).toBe('invalid_output');
  });
});

it('AI 키는 k + 64자리 hex 이고 백업 키와 달라요', async () => {
  const key = await deriveAiKey('anon-hash');
  expect(key).toMatch(/^k[0-9a-f]{64}$/);
  const { deriveBackupKey } = await import('../backup/key');
  expect(await deriveBackupKey('anon-hash')).not.toBe(key);
});
