import { afterEach, describe, expect, it, vi } from 'vitest';

// 앱인토스 Storage 브릿지를 흉내 내요: 정상 / 거절(브릿지 없음) / 무응답(시간 초과).
const bridge = vi.hoisted(() => ({ mode: 'ok' as 'ok' | 'reject' | 'hang', store: new Map<string, string>() }));
vi.mock('@apps-in-toss/web-framework', () => ({
  Storage: {
    getItem: (key: string) => {
      if (bridge.mode === 'reject') return Promise.reject(new Error('no bridge'));
      if (bridge.mode === 'hang') return new Promise<string | null>(() => {});
      return Promise.resolve(bridge.store.get(key) ?? null);
    },
    setItem: (key: string, value: string) => {
      if (bridge.mode === 'reject') return Promise.reject(new Error('no bridge'));
      if (bridge.mode === 'hang') return new Promise<void>(() => {});
      bridge.store.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      bridge.store.delete(key);
      return bridge.mode === 'reject' ? Promise.reject(new Error('no bridge')) : Promise.resolve();
    },
  },
}));

import { createEmptyBoard } from './mandalart';
import { KEYS, createDefaultSettings } from './state';
import { loadState, saveBoards } from './storage';

const NOW = 1759000000000;
const boardsJson = (goal: string) => JSON.stringify({ version: 1, active: 0, boards: [{ ...createEmptyBoard(NOW), goal }] });

describe('storage (브릿지 → localStorage 대체, 선행 프로토타입 이전)', () => {
  afterEach(() => {
    bridge.mode = 'ok';
    bridge.store.clear();
    vi.useRealTimers();
  });

  it('선행 프로토타입의 단일 판(mandalart.board.v1)은 boards.v1 로 옮기고 지워요', async () => {
    bridge.store.set(KEYS.legacyBoard, JSON.stringify({ ...createEmptyBoard(NOW), goal: '옛 목표', version: 1 }));
    const state = await loadState(NOW);
    expect(state.boards.boards).toHaveLength(1);
    expect(state.boards.boards[0].goal).toBe('옛 목표');
    expect(bridge.store.has(KEYS.legacyBoard)).toBe(false);
    expect(JSON.parse(bridge.store.get(KEYS.boards)!).boards[0].goal).toBe('옛 목표');
    expect(state.settings).toEqual(createDefaultSettings());
  });

  it('브릿지가 없으면(일반 브라우저) localStorage 를 읽고, 저장도 localStorage 에는 남아요', async () => {
    bridge.mode = 'reject';
    window.localStorage.setItem(KEYS.boards, boardsJson('브라우저 목표'));
    const state = await loadState(NOW);
    expect(state.boards.boards[0].goal).toBe('브라우저 목표');
    await saveBoards({ ...state.boards, boards: [{ ...state.boards.boards[0], goal: '바뀐 목표' }] });
    expect(JSON.parse(window.localStorage.getItem(KEYS.boards)!).boards[0].goal).toBe('바뀐 목표');
  });

  it('브릿지가 1.5초 안에 답하지 않으면 localStorage 로 넘어가요', async () => {
    vi.useFakeTimers();
    bridge.mode = 'hang';
    window.localStorage.setItem(KEYS.boards, boardsJson('기다리다 받은 목표'));
    const pending = loadState(NOW);
    await vi.advanceTimersByTimeAsync(1600);
    const state = await pending;
    expect(state.boards.boards[0].goal).toBe('기다리다 받은 목표');
  });

  it('저장된 값이 깨져 있으면 빈 판·빈 기록·기본 설정으로 시작해요', async () => {
    bridge.store.set(KEYS.boards, '{not json');
    bridge.store.set(KEYS.checkins, JSON.stringify({ version: 9 }));
    bridge.store.set(KEYS.settings, JSON.stringify({ version: 1, notification: 'weird', unlocks: { extraBoard: 'yes' } }));
    const state = await loadState(NOW);
    expect(state.boards.boards).toHaveLength(1);
    expect(state.boards.boards[0].goal).toBe('');
    expect(state.checkins).toEqual({ version: 1, byBoard: {} });
    expect(state.settings.notification).toBe('unknown');
    expect(state.settings.unlocks.extraBoard).toBe(false);
  });
});
