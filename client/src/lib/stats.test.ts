import { describe, expect, it } from 'vitest';

import { actionIndex, createEmptyBoard, type Board } from './mandalart';
import type { CheckinRecord } from './state';
import {
  addDays,
  canGoNext,
  canGoPrev,
  computeStats,
  heatLevel,
  monthCells,
  monthRange,
  weekRange,
  weekdayIndex,
  weekdayLabel,
} from './stats';

function board(): Board {
  const b = createEmptyBoard(1);
  b.goal = '건강한 한 해';
  b.subs[0].title = '수면';
  b.subs[0].actions = ['일찍 자기', '일찍 일어나기', '', '', '', '', '', ''];
  b.subs[1].title = '운동';
  b.subs[1].actions = ['걷기', '', '', '', '', '', '', ''];
  return b;
}

const record = (days: Record<string, number[]>): CheckinRecord => ({ days, lastCompletedAt: 1 });

describe('날짜 계산', () => {
  it('월요일이 0, 일요일이 6 이고, 달·해를 넘겨 더하고 빼요', () => {
    expect(weekdayIndex('2026-10-12')).toBe(0); // 월
    expect(weekdayIndex('2026-10-18')).toBe(6); // 일
    expect(weekdayLabel('2026-10-16')).toBe('금');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29'); // 윤년
  });
});

describe('weekRange', () => {
  it('오늘이 든 주(월~일)와 앞뒤 주, 달·해를 넘는 주의 이름', () => {
    const week = weekRange('2026-10-16', 0);
    expect([week.start, week.end, week.label]).toEqual(['2026-10-12', '2026-10-18', '10월 12일 ~ 18일']);
    expect(week.dates).toHaveLength(7);
    expect(weekRange('2026-10-16', -2).label).toBe('9월 28일 ~ 10월 4일');
    expect(weekRange('2026-01-01', 0).label).toBe('2025년 12월 29일 ~ 2026년 1월 4일');
  });
});

describe('monthRange · monthCells', () => {
  it('달의 첫날·마지막 날, 해를 넘는 offset, 월요일부터 7칸씩 채운 달력', () => {
    const oct = monthRange('2026-10-16', 0);
    expect([oct.start, oct.end, oct.label, oct.dates.length]).toEqual(['2026-10-01', '2026-10-31', '2026년 10월', 31]);
    expect(monthRange('2026-01-10', -1).label).toBe('2025년 12월');
    expect(monthRange('2028-03-05', -1).end).toBe('2028-02-29');
    const cells = monthCells(oct); // 2026-10-01 은 목요일
    expect(cells.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(cells.length % 7).toBe(0);
    expect(cells.filter(Boolean)).toHaveLength(31);
  });
});

describe('computeStats', () => {
  const b = board();
  const r = record({
    '2026-10-12': [actionIndex(0, 0), actionIndex(1, 0)],
    '2026-10-13': [actionIndex(0, 0)],
    '2026-10-15': [actionIndex(0, 0), actionIndex(0, 1)],
    '2026-10-16': [actionIndex(0, 0)],
    '2026-10-05': [actionIndex(1, 0)], // 지난주
  });

  it('날마다 체크 수, 실천한 날, 합계, 기간 안 최장 연속, 미래 날 표시', () => {
    const stats = computeStats(b, r, weekRange('2026-10-16', 0), '2026-10-16');
    expect(stats.daily.map((d) => d.count)).toEqual([2, 1, 0, 2, 1, 0, 0]);
    expect(stats.daily.map((d) => d.future)).toEqual([false, false, false, false, false, true, true]);
    expect([stats.activeDays, stats.checks, stats.longestStreak]).toEqual([4, 6, 2]);
  });

  it('세부 목표별 합(적은 것만, 1~8 순서), 많이 한 실천 3개, 안 한 실천', () => {
    const stats = computeStats(b, r, weekRange('2026-10-16', 0), '2026-10-16');
    expect(stats.bySub).toEqual([
      { subIndex: 0, title: '수면', count: 5 },
      { subIndex: 1, title: '운동', count: 1 },
    ]);
    expect(stats.top.map((a) => [a.text, a.count])).toEqual([
      ['일찍 자기', 4],
      ['일찍 일어나기', 1],
      ['걷기', 1],
    ]);
    expect(stats.untouched).toEqual([]);
    const last = computeStats(b, r, weekRange('2026-10-16', -1), '2026-10-16');
    expect(last.untouched.map((a) => a.text)).toEqual(['일찍 자기', '일찍 일어나기']);
  });

  it('지운 실천의 기록은 "실천 n" 으로 남고, 기록이 없으면 전부 0', () => {
    const erased = board();
    erased.subs[0].actions[0] = '';
    expect(computeStats(erased, r, weekRange('2026-10-16', 0), '2026-10-16').top[0].text).toBe('실천 1');
    const empty = computeStats(b, undefined, monthRange('2026-10-16', 0), '2026-10-16');
    expect([empty.activeDays, empty.checks, empty.longestStreak, empty.top.length]).toEqual([0, 0, 0, 0]);
  });
});

describe('기간 이동 · 달력 진하기', () => {
  it('이번 기간 뒤로는 못 가고, 기록이 있는 기간 앞까지만 돌아가요', () => {
    const r = record({ '2026-10-05': [0] });
    expect(canGoNext(weekRange('2026-10-16', 0))).toBe(false);
    expect(canGoNext(weekRange('2026-10-16', -1))).toBe(true);
    expect(canGoPrev(weekRange('2026-10-16', 0), r)).toBe(true);
    expect(canGoPrev(weekRange('2026-10-16', -1), r)).toBe(false);
    expect(canGoPrev(weekRange('2026-10-16', 0), undefined)).toBe(false);
  });

  it('0 / 1~2 / 3~5 / 6+ 네 단계', () => {
    expect([0, 1, 2, 3, 5, 6, 64].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
});
