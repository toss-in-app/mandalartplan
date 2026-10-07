import { describe, expect, it } from 'vitest';

import { createEmptyBoard } from './mandalart';
import {
  MAX_CHECKIN_DAYS,
  addBoard,
  boardLabel,
  createDefaultSettings,
  createEmptyBoards,
  dateKey,
  normalizeBoards,
  normalizeCheckins,
  normalizeSettings,
  streak,
  switchBoard,
} from './state';

const NOW = 1759000000000;

describe('boards', () => {
  it('빈 상태는 판 하나예요', () => {
    const s = createEmptyBoards(NOW);
    expect(s.boards).toHaveLength(1);
    expect(s.active).toBe(0);
  });

  it('판이 3개 이상이면 2개까지만, active 는 범위 안으로', () => {
    const b = createEmptyBoard(NOW);
    const s = normalizeBoards({ version: 1, active: 5, boards: [b, b, b] }, NOW);
    expect(s?.boards).toHaveLength(2);
    expect(s?.active).toBe(0);
  });

  it('버전이 다르거나 판이 하나도 없으면 null', () => {
    expect(normalizeBoards({ version: 2, active: 0, boards: [createEmptyBoard(NOW)] })).toBeNull();
    expect(normalizeBoards({ version: 1, active: 0, boards: ['x'] })).toBeNull();
  });
});

describe('boards 추가·전환 (두 번째 판)', () => {
  it('판을 더하면 새 빈 판이 뒤에 붙고 그 판을 보게 돼요. 같은 ms 라도 id 가 겹치지 않아요', () => {
    const one = createEmptyBoards(NOW);
    const two = addBoard(one, NOW);
    expect(two.boards).toHaveLength(2);
    expect(two.active).toBe(1);
    expect(two.boards[1].id).not.toBe(two.boards[0].id);
    expect(two.boards[1].goal).toBe('');
    expect(one.boards).toHaveLength(1); // 원본은 그대로
  });

  it('이미 2개면 더하지 않고 같은 객체를 돌려줘요', () => {
    const two = addBoard(createEmptyBoards(NOW), NOW + 1);
    expect(addBoard(two, NOW + 2)).toBe(two);
  });

  it('판 전환은 범위 안에서만, 같은 판이면 그대로', () => {
    const two = addBoard(createEmptyBoards(NOW), NOW + 1);
    expect(switchBoard(two, 0).active).toBe(0);
    expect(switchBoard(two, 1)).toBe(two);
    expect(switchBoard(two, 2)).toBe(two);
    expect(switchBoard(two, -1)).toBe(two);
    expect(switchBoard(two, 0.5)).toBe(two);
    expect([boardLabel(0), boardLabel(1)]).toEqual(['첫 번째 판', '두 번째 판']);
  });
});

describe('checkins', () => {
  it('날짜 형식·실천 번호를 걸러요', () => {
    const s = normalizeCheckins({
      version: 1,
      byBoard: { b1: { days: { '2026-09-28': [3, 3, 64, -1, 'x', 0], bad: [1] }, lastCompletedAt: 10 } },
    });
    expect(s?.byBoard.b1.days).toEqual({ '2026-09-28': [0, 3] });
    expect(s?.byBoard.b1.lastCompletedAt).toBe(10);
  });

  it('최근 400일만 남겨요', () => {
    const days: Record<string, number[]> = {};
    for (let i = 0; i < MAX_CHECKIN_DAYS + 20; i += 1) {
      const d = new Date(2026, 0, 1 + i);
      days[dateKey(d)] = [];
    }
    const s = normalizeCheckins({ version: 1, byBoard: { b1: { days, lastCompletedAt: null } } });
    expect(Object.keys(s!.byBoard.b1.days)).toHaveLength(MAX_CHECKIN_DAYS);
    expect(s!.byBoard.b1.days['2026-01-01']).toBeUndefined();
  });

  it('연속 일수는 오늘 또는 어제부터 거꾸로 세요', () => {
    const rec = { days: { '2026-09-25': [], '2026-09-26': [1], '2026-09-27': [2] }, lastCompletedAt: null };
    expect(streak(rec, '2026-09-27')).toBe(3);
    expect(streak(rec, '2026-09-28')).toBe(3); // 오늘 아직 안 했으면 어제까지
    expect(streak(rec, '2026-09-29')).toBe(0);
    expect(streak(undefined, '2026-09-29')).toBe(0);
  });
});

describe('settings', () => {
  it('기본값과 정규화', () => {
    expect(createDefaultSettings().notification).toBe('unknown');
    const s = normalizeSettings({ version: 1, notification: 'agreed', unlocks: { extraBoard: 'yes' }, seenContentVersion: 3, firstCheckinAt: 5 });
    expect(s).toEqual({
      version: 1,
      notification: 'agreed',
      unlocks: { extraBoard: false },
      seenContentVersion: 3,
      firstCheckinAt: 5,
      backup: { enabled: false, key: null, lastBackupAt: null },
      ads: { lastInterstitialDate: null },
    });
    expect(normalizeSettings({ version: 0 })).toBeNull();
  });
});
