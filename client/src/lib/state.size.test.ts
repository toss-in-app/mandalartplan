import { describe, expect, it } from 'vitest';

import { ACTION_COUNT, MAX_TEXT, SUB_COUNT, TOTAL_ACTIONS, createEmptyBoard } from './mandalart';
import { MAX_BOARDS, MAX_CHECKIN_DAYS, createDefaultSettings, type AppState } from './state';

/** Storage 저장량 상한(6단계 성능·용량 항목): 최악의 상태도 이 바이트 수를 넘지 않아요 */
export const STORAGE_BUDGET_BYTES = 300_000;

/** 73칸 전부 40자(한글 3바이트) · 판 2개 · 400일치 64개 체크 · 백업 켜짐 */
export function worstCaseState(): AppState {
  const text = '가'.repeat(MAX_TEXT);
  const boards = Array.from({ length: MAX_BOARDS }, (_, i) => {
    const board = createEmptyBoard(1759000000000 + i);
    board.goal = text;
    board.templateId = 'healthy-year';
    board.subs = Array.from({ length: SUB_COUNT }, () => ({ title: text, actions: Array.from({ length: ACTION_COUNT }, () => text) }));
    return board;
  });
  const days: Record<string, number[]> = {};
  const all = Array.from({ length: TOTAL_ACTIONS }, (_, i) => i);
  for (let d = 0; d < MAX_CHECKIN_DAYS; d += 1) {
    const date = new Date(Date.UTC(2026, 0, 1 + d));
    days[date.toISOString().slice(0, 10)] = all;
  }
  const settings = createDefaultSettings();
  settings.backup = { enabled: true, key: `k${'f'.repeat(64)}`, lastBackupAt: 1759000000000 };
  settings.ads.lastInterstitialDate = '2026-10-08';
  return {
    boards: { version: 1, active: 1, boards },
    checkins: { version: 1, byBoard: Object.fromEntries(boards.map((b) => [b.id, { days, lastCompletedAt: 1759000000000 }])) },
    settings,
  };
}

export function storageBytes(state: AppState): number {
  const enc = new TextEncoder();
  return [state.boards, state.checkins, state.settings].reduce((sum, part) => sum + enc.encode(JSON.stringify(part)).byteLength, 0);
}

describe('Storage 저장량 상한', () => {
  const bytes = storageBytes(worstCaseState());
  it(`최악의 상태(판 2개 73칸 40자, 400일치 64개 체크) = ${bytes} 바이트, 예산 ${STORAGE_BUDGET_BYTES} 안이에요`, () => {
    expect(bytes).toBeGreaterThan(50_000); // 계산이 비어 있지 않은지
    expect(bytes).toBeLessThan(STORAGE_BUDGET_BYTES);
  });
});
