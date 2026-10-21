import { describe, expect, it } from 'vitest';

import { actionIndex, createEmptyBoard, type Board } from './mandalart';
import {
  bestMonth,
  bestRun,
  compareWithPrevious,
  cumulativeSummary,
  dayWord,
  lastMonthReview,
  lastWeekReport,
  milestoneName,
  monthTotals,
  nextStreakMilestone,
  periodBars,
  recentDays,
  relativeLevel,
  restDaysThisMonth,
  scoreSummary,
  streakRuns,
  streakSummary,
  weekdaySummary,
  yearGrass,
} from './records';
import type { CheckinRecord } from './state';
import { addDays, monthRange, weekRange, yearRange } from './stats';

/** 2026-10-21 은 수요일 */
const TODAY = '2026-10-21';

function rec(days: Record<string, number[]>): CheckinRecord {
  return { days, lastCompletedAt: 1 };
}

/** start 부터 n일 동안 날마다 같은 실천들 */
function run(start: string, n: number, indices: number[]): Record<string, number[]> {
  return Object.fromEntries(Array.from({ length: n }, (_, i) => [addDays(start, i), indices]));
}

const board: Board = {
  ...createEmptyBoard(1),
  goal: '건강한 한 해',
  subs: createEmptyBoard(1).subs.map((sub, s) => ({ title: `가지${s + 1}`, actions: sub.actions.map((_, a) => `실천${s + 1}-${a + 1}`) })),
};

describe('연속', () => {
  const record = rec({ ...run('2026-10-01', 2, [0]), ...run('2026-10-05', 3, [0]), ...run('2026-10-10', 12, [0, 8]) });

  it('이어진 구간·가장 긴 구간(같으면 최근)', () => {
    expect(streakRuns(record).map((r) => r.length)).toEqual([2, 3, 12]);
    expect(bestRun(record)).toEqual({ start: '2026-10-10', end: '2026-10-21', length: 12 });
    expect(bestRun(rec({ ...run('2026-10-01', 3, [0]), ...run('2026-10-10', 3, [0]) }))?.start).toBe('2026-10-10');
    expect(bestRun(undefined)).toBeNull();
  });

  it('다음 고비와 이름, 하루·이틀', () => {
    expect([0, 3, 12, 14, 365, 420].map(nextStreakMilestone)).toEqual([3, 7, 14, 30, 400, 500]);
    expect([7, 14, 30].map(milestoneName)).toEqual(['1주 연속', '2주 연속', '30일 연속']);
    expect([1, 2, 3, 4, 5].map(dayWord)).toEqual(['하루', '이틀', '사흘', '나흘', '5일']);
  });

  it('오늘 했으면 오늘부터 세고, 아직이면 오늘 하면 닿는 날로', () => {
    expect(streakSummary(record, TODAY)).toMatchObject({ current: 12, todayDone: true, next: 14, nextDate: '2026-10-23' });
    const notYet = rec(run('2026-10-10', 11, [0]));
    expect(streakSummary(notYet, TODAY)).toMatchObject({ current: 11, todayDone: false, next: 14, nextDate: '2026-10-23' });
  });

  it('최근 n일: 처음 기록하기 전 날은 before(빠진 날이 아니에요)', () => {
    const days = recentDays(rec(run('2026-10-19', 3, [1])), TODAY, 5);
    expect(days.map((d) => [d.date.slice(8), d.count, d.before])).toEqual([
      ['17', 0, true],
      ['18', 0, true],
      ['19', 1, false],
      ['20', 1, false],
      ['21', 1, false],
    ]);
  });

  it('이번 달 쉰 날: 처음 기록한 날부터 어제까지 도장이 없는 날(오늘은 세지 않아요)', () => {
    expect(restDaysThisMonth(record, TODAY)).toBe(4); // 3·4·8·9일
    expect(restDaysThisMonth(rec({ '2026-10-15': [0] }), TODAY)).toBe(5); // 16~20일
    expect(restDaysThisMonth(undefined, TODAY)).toBe(0);
  });
});

describe('기간', () => {
  it('지난 기간 이맘때와 비교: 같은 요일까지, 처음 기록이 그 자리보다 뒤면 known 이 아니에요', () => {
    const record = rec({ ...run('2026-10-12', 7, [0, 1]), ...run('2026-10-19', 3, [0]) });
    // 이번 주 월~수 3개, 지난주 월~수 6개
    expect(compareWithPrevious(record, 'week', TODAY)).toEqual({ now: 3, before: 6, known: true, label: '지난주' });
    expect(compareWithPrevious(rec(run('2026-10-19', 3, [0])), 'week', TODAY).known).toBe(false);
    expect(compareWithPrevious(record, 'month', TODAY)).toMatchObject({ now: 17, before: 0, known: false, label: '지난달' });
  });

  it('막대: 주 = 요일, 월 = 그 달 안의 주(2026년 10월은 5주), 년 = 12달', () => {
    const record = rec({ '2026-10-19': [0, 1], '2026-10-21': [0], '2026-10-02': [5] });
    const week = periodBars(record, weekRange(TODAY, 0), TODAY);
    expect(week.map((b) => b.label).join('')).toBe('월화수목금토일');
    expect(week.map((b) => b.value)).toEqual([2, 0, 1, 0, 0, 0, 0]);
    expect(week.filter((b) => b.future)).toHaveLength(4);
    expect(week[2].current).toBe(true);
    const month = periodBars(record, monthRange(TODAY, 0), TODAY);
    expect(month.map((b) => [b.label, b.value, b.current])).toEqual([
      ['1주', 1, false],
      ['2주', 0, false],
      ['3주', 0, false],
      ['4주', 3, true],
      ['5주', 0, false],
    ]);
    const year = periodBars(record, yearRange(TODAY, 0), TODAY);
    expect(year).toHaveLength(12);
    expect(year[9]).toMatchObject({ label: '10월', value: 4, current: true });
    expect(year[10].future).toBe(true);
  });

  it('진하기는 가장 많은 값 대비 4단계', () => {
    expect([0, 1, 3, 5, 8].map((v) => relativeLevel(v, 8))).toEqual([0, 1, 2, 3, 4]);
    expect(relativeLevel(3, 0)).toBe(0);
  });
});

describe('지난주 리포트', () => {
  it('이번 주에 처음 썼으면 다음 월요일, 지난주에 도장이 없으면 쉼, 있으면 리포트', () => {
    expect(lastWeekReport(board, rec(run('2026-10-19', 3, [0])), TODAY)).toEqual({ kind: 'first', nextMonday: '2026-10-26' });
    expect(lastWeekReport(board, undefined, TODAY)).toEqual({ kind: 'first', nextMonday: '2026-10-26' });
    expect(lastWeekReport(board, rec({ '2026-10-01': [0], '2026-10-20': [0] }), TODAY)).toEqual({ kind: 'rest' });
    const state = lastWeekReport(board, rec({ ...run('2026-10-05', 7, [0]), ...run('2026-10-12', 7, [0, actionIndex(2, 0)]) }), TODAY);
    expect(state.kind).toBe('ready');
    if (state.kind !== 'ready') return;
    expect(state.report).toMatchObject({ checks: 14, activeDays: 7, previousChecks: 7, previousKnown: true, subsTouched: 2 });
    expect(state.report.daily).toEqual([2, 2, 2, 2, 2, 2, 2]);
    expect(state.report.subDays.slice(0, 3)).toEqual([7, 0, 7]);
    expect(state.report.top[0]).toMatchObject({ index: 0, count: 7, text: '실천1-1' });
  });
});

describe('꾸준함 점수', () => {
  it('하면 오르고, 오늘 아직이면 떨어지지 않고, 하루 쉬어도 0 이 되지 않아요', () => {
    expect(scoreSummary(undefined, TODAY)).toBeNull();
    const steady = scoreSummary(rec(run('2026-09-22', 30, [0])), TODAY)!;
    expect(steady.score).toBeGreaterThan(70);
    expect(steady.score).toBeLessThan(80);
    expect(steady.score).toBeGreaterThan(steady.weekAgo);
    const notYetToday = scoreSummary(rec(run('2026-09-22', 29, [0])), TODAY)!;
    const yesterday = scoreSummary(rec(run('2026-09-22', 29, [0])), '2026-10-20')!;
    expect(notYetToday.score).toBe(yesterday.score);
    const rested = scoreSummary(rec({ ...run('2026-09-22', 28, [0]), '2026-10-21': [0] }), TODAY)!; // 20일 하루 쉼
    expect(rested.score).toBeGreaterThan(60);
    expect(steady.weekly).toHaveLength(5); // 처음 기록(9/22) 뒤의 주 끝만
    expect(steady.bySub[0]).toBe(steady.score);
    expect(steady.bySub[1]).toBe(0);
  });
});

describe('요일별 평균', () => {
  it('기간 안 그 요일 수로 나누고, 오늘은 도장이 있을 때만 넣어요', () => {
    // 10/12(월)~10/20(화): 월 4개, 나머지 1개
    const days = Object.fromEntries(Array.from({ length: 9 }, (_, i) => {
      const date = addDays('2026-10-12', i);
      return [date, i % 7 === 0 ? [0, 1, 2, actionIndex(3, 0)] : [actionIndex(1, 0)]];
    }));
    const summary = weekdaySummary(rec(days), TODAY, '8w');
    expect(summary.from).toBe('2026-10-12');
    expect(summary.stats[0]).toMatchObject({ weekday: 0, average: 4, days: 2, topSub: 0, topSubAverage: 3 });
    expect(summary.stats[2]).toMatchObject({ weekday: 2, average: 1, days: 1 }); // 오늘(수)은 아직이라 14일만
    expect(summary.best).toBe(0);
    expect(summary.worst).not.toBe(0);
    expect(weekdaySummary(undefined, TODAY, 'all')).toMatchObject({ from: null, best: null, worst: null });
  });
});

describe('지난달 회고·누적·달력', () => {
  const record = rec({ ...run('2026-08-30', 5, [0]), ...run('2026-09-10', 20, [0, 1]), ...run('2026-10-01', 21, [0, 1, 2, 3, 4]) });

  it('지난달 회고: 가장 많이 한 달인지는 이번 달을 빼고 봐요', () => {
    const review = lastMonthReview(board, record, TODAY)!;
    expect(review).toMatchObject({ activeDays: 23, checks: 43, best: true });
    expect(review.range.label).toBe('2026년 9월');
    expect(lastMonthReview(board, rec({ '2026-10-02': [0] }), TODAY)).toBeNull();
  });

  it('누적: 달마다 누적, 닿은 고비와 그날, 다음 고비까지와 지금 속도', () => {
    const summary = cumulativeSummary(record, TODAY);
    expect(summary.total).toBe(2 + 43 + 105);
    expect(summary.first).toBe('2026-08-30');
    expect(summary.months.map((m) => [m.label, m.total])).toEqual([
      ['8월', 2],
      ['9월', 45],
      ['10월', 150],
    ]);
    expect(summary.reached.map((r) => r.count)).toEqual([1, 100]);
    expect(summary).toMatchObject({ next: 300, left: 150 });
    expect(summary.eta).toMatch(/^1[01]월 (초|중순|말)$/);
    expect(cumulativeSummary(undefined, TODAY)).toMatchObject({ total: 0, first: null, months: [], next: 100, eta: null });
  });

  it('1년 잔디: 월요일 시작 주, 그해 밖은 out, 오늘 뒤는 future, 달 이름은 1일이 든 주', () => {
    const grass = yearGrass(record, yearRange(TODAY, 0), TODAY);
    expect(grass.weeks.every((w) => w.length === 7)).toBe(true);
    expect(grass.weeks[0][0].out).toBe(true); // 2026-01-01 은 목요일
    expect(grass.months).toHaveLength(12);
    expect(grass.months[0]).toEqual({ week: 0, label: '1월' });
    const cell = grass.weeks.flat().find((c) => c.date === '2026-10-21')!;
    expect(cell).toMatchObject({ count: 5, out: false, future: false });
    expect(grass.weeks.flat().find((c) => c.date === '2026-10-22')?.future).toBe(true);
    expect(monthTotals(record, '2026').slice(7, 10)).toEqual([2, 43, 105]);
    expect(bestMonth(record)).toBe('2026-10');
    expect(bestMonth(undefined)).toBeNull();
  });
});
