/**
 * 기록 위젯 판·대시보드의 숫자 (3.0, plans/3.0-records-widgets-design.md '숫자 정의').
 * 모두 지금 쌓이는 체크 기록(checkins.byBoard[판].days['YYYY-MM-DD'] = 그날 체크한 실천 번호)에서 계산해요 — 새로 남기는 기록은 없어요.
 * 도장 = 체크 1개, 실천한 날 = 체크가 1개 이상인 날. 날짜는 lib/stats.ts 처럼 'YYYY-MM-DD' 문자열끼리 계산해요.
 */
import { ACTION_COUNT, SUB_COUNT, TOTAL_ACTIONS, type Board } from './mandalart';
import { streak, type CheckinRecord } from './state';
import {
  WEEKDAY_LABELS,
  addDays,
  computeStats,
  datesBetween,
  firstRecordDate,
  monthRange,
  periodRange,
  weekRange,
  weekdayIndex,
  type ActionCount,
  type PeriodRange,
  type StatsPeriod,
} from './stats';

// ───────────────────────── 기본 ─────────────────────────

/** 그날 체크한 실천 번호(0~63만) */
export function checksOn(record: CheckinRecord | undefined, date: string): number[] {
  return (record?.days[date] ?? []).filter((n) => Number.isInteger(n) && n >= 0 && n < TOTAL_ACTIONS);
}

/** 실천 번호 → 세부 목표 번호(0~7) */
export function subOf(index: number): number {
  return Math.floor(index / ACTION_COUNT);
}

/** 그날 도장을 찍은 세부 목표 수(0~8) */
export function subsTouched(indices: readonly number[]): number {
  return new Set(indices.map(subOf)).size;
}

/** 기록이 있는 날(오래된 순) */
export function recordDates(record: CheckinRecord | undefined): string[] {
  return record ? Object.keys(record.days).filter((date) => checksOn(record, date).length > 0).sort() : [];
}

export function totalChecks(record: CheckinRecord | undefined): number {
  return recordDates(record).reduce((sum, date) => sum + checksOn(record, date).length, 0);
}

/** '10월 21일' */
export function monthDay(key: string): string {
  const [, m, d] = key.split('-').map(Number);
  return `${m}월 ${d}일`;
}

/** 하루·이틀·사흘·나흘, 그 뒤는 'n일' */
export function dayWord(n: number): string {
  return ['', '하루', '이틀', '사흘', '나흘'][n] ?? `${n}일`;
}

/** 기간 안 실천별 도장 수(64칸) */
export function actionCounts(record: CheckinRecord | undefined, dates: readonly string[]): number[] {
  const counts = new Array<number>(TOTAL_ACTIONS).fill(0);
  for (const date of dates) for (const n of checksOn(record, date)) counts[n] += 1;
  return counts;
}

/** 실천별 수 → 세부 목표별 합(8개) */
export function subTotals(counts: readonly number[]): number[] {
  return Array.from({ length: SUB_COUNT }, (_, s) => counts.slice(s * ACTION_COUNT, (s + 1) * ACTION_COUNT).reduce((a, b) => a + b, 0));
}

/** 기간 안 세부 목표마다 도장을 찍은 날 수(8개) */
export function subActiveDays(record: CheckinRecord | undefined, dates: readonly string[]): number[] {
  const days = new Array<number>(SUB_COUNT).fill(0);
  for (const date of dates) for (const s of new Set(checksOn(record, date).map(subOf))) days[s] += 1;
  return days;
}

/** 세부 목표 이름(비었으면 '세부 목표 n') */
export function subTitle(board: Board, subIndex: number): string {
  return board.subs[subIndex]?.title.trim() || `세부 목표 ${subIndex + 1}`;
}

/** 실천 글(비었으면 '실천 n') */
export function actionTitle(board: Board, index: number): string {
  return board.subs[subOf(index)]?.actions[index % ACTION_COUNT]?.trim() || `실천 ${(index % ACTION_COUNT) + 1}`;
}

/** 진하기 0~4: 가장 많은 값(max) 대비 비율로 — 기간 길이(주·월·년)가 달라도 같은 그림이 돼요 */
export function relativeLevel(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0 || max <= 0) return 0;
  const ratio = value / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

// ───────────────────────── 연속 ─────────────────────────

export interface Run {
  start: string;
  end: string;
  length: number;
}

/** 실천한 날이 이어진 구간들(오래된 순) */
export function streakRuns(record: CheckinRecord | undefined): Run[] {
  const runs: Run[] = [];
  for (const date of recordDates(record)) {
    const last = runs[runs.length - 1];
    if (last && addDays(last.end, 1) === date) {
      last.end = date;
      last.length += 1;
    } else {
      runs.push({ start: date, end: date, length: 1 });
    }
  }
  return runs;
}

/** 가장 긴 연속(같으면 최근 것) */
export function bestRun(record: CheckinRecord | undefined): Run | null {
  return streakRuns(record).reduce<Run | null>((best, run) => (!best || run.length >= best.length ? run : best), null);
}

/** 연속 고비 */
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365] as const;

/** n 다음 고비. 365 를 넘으면 다음 100 단위 */
export function nextStreakMilestone(n: number): number {
  return STREAK_MILESTONES.find((m) => m > n) ?? (Math.floor(n / 100) + 1) * 100;
}

/** 고비 이름: 7 → '1주 연속', 14 → '2주 연속', 그 밖은 'n일 연속' */
export function milestoneName(days: number): string {
  return days === 7 ? '1주 연속' : days === 14 ? '2주 연속' : `${days}일 연속`;
}

export interface RecentDay {
  date: string;
  count: number;
  /** 처음 기록한 날보다 앞(아직 쓰기 전 — 빠진 날이 아니에요) */
  before: boolean;
}

/** 오늘까지 최근 n일(오래된 순) */
export function recentDays(record: CheckinRecord | undefined, today: string, n: number): RecentDay[] {
  const first = firstRecordDate(record);
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1);
    return { date, count: checksOn(record, date).length, before: first === null || date < first };
  });
}

/** 이번 달 쉰 날: 이번 달 1일(또는 처음 기록한 날)부터 어제까지 도장이 없는 날. 오늘은 아직 끝나지 않아 세지 않아요 */
export function restDaysThisMonth(record: CheckinRecord | undefined, today: string): number {
  const first = firstRecordDate(record);
  if (!first) return 0;
  const start = [monthRange(today, 0).start, first].sort()[1];
  const yesterday = addDays(today, -1);
  if (start > yesterday) return 0;
  return datesBetween(start, yesterday).filter((date) => checksOn(record, date).length === 0).length;
}

export interface StreakSummary {
  current: number;
  todayDone: boolean;
  best: Run | null;
  next: number;
  /** 지금처럼 이으면 다음 고비에 닿는 날 */
  nextDate: string;
}

export function streakSummary(record: CheckinRecord | undefined, today: string): StreakSummary {
  const current = streak(record, today);
  const todayDone = checksOn(record, today).length > 0;
  const next = nextStreakMilestone(current);
  // 오늘 했으면 내일부터 하루씩, 아직이면 오늘부터
  const nextDate = addDays(today, next - current - (todayDone ? 0 : 1));
  return { current, todayDone, best: bestRun(record), next, nextDate };
}

// ───────────────────────── 기간 ─────────────────────────

/** 기간 안 도장 수 */
export function checksIn(record: CheckinRecord | undefined, dates: readonly string[]): number {
  return dates.reduce((sum, date) => sum + checksOn(record, date).length, 0);
}

/** 지난 기간에서 '오늘과 같은 자리'(주: 같은 요일, 월: 같은 날짜, 년: 같은 월·일 — 없으면 그 기간 끝) */
export function samePoint(range: PeriodRange, today: string): string {
  const offsetDays = Math.round((Date.parse(today) - Date.parse(periodRange(range.period, today, 0).start)) / 86_400_000);
  const point = addDays(range.start, offsetDays);
  return point > range.end ? range.end : point;
}

export interface Comparison {
  /** 지금 기간(오늘까지) 도장 */
  now: number;
  /** 지난 기간 같은 자리까지 도장 */
  before: number;
  /** 지난 기간에 기록이 있었나(처음 기록한 날이 그 자리보다 앞) — 없으면 비교하지 않아요 */
  known: boolean;
  /** 지난 기간 이름: 지난주·지난달·작년 */
  label: string;
}

/** 이번 기간(offset 0)의 '지난 기간 이맘때' 비교 */
export function compareWithPrevious(record: CheckinRecord | undefined, period: StatsPeriod, today: string): Comparison {
  const current = periodRange(period, today, 0);
  const previous = periodRange(period, today, -1);
  const point = samePoint(previous, today);
  const first = firstRecordDate(record);
  return {
    now: checksIn(record, current.dates.filter((d) => d <= today)),
    before: checksIn(record, previous.dates.filter((d) => d <= point)),
    known: first !== null && first <= point,
    label: period === 'week' ? '지난주' : period === 'month' ? '지난달' : '작년',
  };
}

export interface Bar {
  label: string;
  value: number;
  /** 아직 오지 않은 칸 */
  future: boolean;
  /** 오늘이 든 칸 */
  current: boolean;
}

/** 도장 대시보드 막대: 주 = 요일, 월 = 주(월요일 시작, 그 달 안만), 년 = 달 */
export function periodBars(record: CheckinRecord | undefined, range: PeriodRange, today: string): Bar[] {
  if (range.period === 'week') {
    return range.dates.map((date) => ({ label: WEEKDAY_LABELS[weekdayIndex(date)], value: checksOn(record, date).length, future: date > today, current: date === today }));
  }
  if (range.period === 'month') {
    const weeks: string[][] = [];
    for (const date of range.dates) {
      if (weeks.length === 0 || weekdayIndex(date) === 0) weeks.push([]);
      weeks[weeks.length - 1].push(date);
    }
    return weeks.map((dates, i) => ({
      label: `${i + 1}주`,
      value: checksIn(record, dates),
      future: dates[0] > today,
      current: dates[0] <= today && today <= dates[dates.length - 1],
    }));
  }
  const year = range.start.slice(0, 4);
  return Array.from({ length: 12 }, (_, m) => {
    const month = monthRange(`${year}-${String(m + 1).padStart(2, '0')}-01`, 0);
    return {
      label: `${m + 1}월`,
      value: checksIn(record, month.dates),
      future: month.start > today,
      current: month.start <= today && today <= month.end,
    };
  });
}

// ───────────────────────── 지난주 리포트 ─────────────────────────

export interface WeekReport {
  range: PeriodRange;
  checks: number;
  activeDays: number;
  /** 월~일 도장 수 */
  daily: number[];
  /** 그 전 주 도장 */
  previousChecks: number;
  /** 그 전 주에 기록이 있었나 */
  previousKnown: boolean;
  subsTouched: number;
  top: ActionCount[];
  /** 세부 목표마다 도장을 찍은 날(8개) */
  subDays: number[];
}

export type ReportState =
  | { kind: 'ready'; report: WeekReport }
  /** 이번 주에 처음 썼어요: 다음 월요일에 첫 리포트 */
  | { kind: 'first'; nextMonday: string }
  /** 지난주는 도장이 없었어요 */
  | { kind: 'rest' };

export function lastWeekReport(board: Board, record: CheckinRecord | undefined, today: string): ReportState {
  const range = weekRange(today, -1);
  const first = firstRecordDate(record);
  const thisMonday = weekRange(today, 0).start;
  if (first === null || first >= thisMonday) return { kind: 'first', nextMonday: addDays(thisMonday, 7) };
  const stats = computeStats(board, record, range, today);
  if (stats.checks === 0) return { kind: 'rest' };
  const before = weekRange(today, -2);
  return {
    kind: 'ready',
    report: {
      range,
      checks: stats.checks,
      activeDays: stats.activeDays,
      daily: stats.daily.map((d) => d.count),
      previousChecks: checksIn(record, before.dates),
      previousKnown: first <= before.end,
      subsTouched: new Set(range.dates.flatMap((date) => checksOn(record, date).map(subOf))).size,
      top: stats.top,
      subDays: subActiveDays(record, range.dates),
    },
  };
}

// ───────────────────────── 꾸준함 점수 ─────────────────────────

/** 반감기 14일: 하면 오르고, 하루 쉬어도 0 이 되지 않아요(Loop Habit Tracker '습관 강도'와 같은 생각) */
const SCORE_HALF_LIFE_DAYS = 14;
const SCORE_ALPHA = 1 - Math.pow(0.5, 1 / SCORE_HALF_LIFE_DAYS);

/**
 * 처음 기록한 날부터 오늘까지 날마다의 점수(0~1). '그날 했으면 1, 아니면 0' 을 섞어요.
 * 오늘은 했을 때만 넣어요(하루 중간에 점수가 떨어지지 않게).
 */
function scoreByDate(record: CheckinRecord | undefined, today: string, did: (indices: number[]) => boolean): Map<string, number> {
  const scores = new Map<string, number>();
  const first = firstRecordDate(record);
  if (!first || first > today) return scores;
  let s = 0;
  for (const date of datesBetween(first, today)) {
    const indices = checksOn(record, date);
    if (date === today && indices.length === 0) {
      scores.set(date, s);
      break;
    }
    s += SCORE_ALPHA * ((did(indices) ? 1 : 0) - s);
    scores.set(date, s);
  }
  return scores;
}

export interface ScoreSummary {
  score: number;
  /** 7일 전 점수 */
  weekAgo: number;
  /** 7일 전에도 기록이 있었나(처음 일주일이면 '지난주보다'를 말하지 않아요) */
  weekAgoKnown: boolean;
  /** 최근 8주(주마다 그 주 마지막 날, 끝은 오늘)의 점수 9개 — 앞은 처음 기록 전이면 빠져요 */
  weekly: number[];
  /** 세부 목표마다 점수(8개) */
  bySub: number[];
}

export function scoreSummary(record: CheckinRecord | undefined, today: string): ScoreSummary | null {
  const all = scoreByDate(record, today, (indices) => indices.length > 0);
  if (all.size === 0) return null;
  const at = (date: string) => Math.round(100 * (all.get(date) ?? 0));
  const first = firstRecordDate(record)!;
  const weekly: number[] = [];
  for (let k = 8; k >= 0; k -= 1) {
    const date = addDays(today, -7 * k);
    if (date >= first) weekly.push(at(date));
  }
  const bySub = Array.from({ length: SUB_COUNT }, (_, s) => {
    const sub = scoreByDate(record, today, (indices) => indices.some((n) => subOf(n) === s));
    return Math.round(100 * (sub.get(today) ?? 0));
  });
  const weekAgoKnown = addDays(today, -7) >= first;
  return { score: at(today), weekAgo: weekAgoKnown ? at(addDays(today, -7)) : 0, weekAgoKnown, weekly, bySub };
}

// ───────────────────────── 요일별 평균 ─────────────────────────

export type WeekdayWindow = '4w' | '8w' | 'all';

export interface WeekdayStat {
  /** 0 = 월 … 6 = 일 */
  weekday: number;
  /** 하루 평균 도장 */
  average: number;
  /** 기간 안 그 요일 수 */
  days: number;
  /** 그 요일에 가장 많이 한 세부 목표(없으면 null)와 하루 평균 */
  topSub: number | null;
  topSubAverage: number;
}

export interface WeekdaySummary {
  stats: WeekdayStat[];
  /** 기간 첫날(처음 기록 전은 빼요). 기록이 없으면 null */
  from: string | null;
  best: number | null;
  worst: number | null;
}

/** 기간(최근 4주·8주·전체) 안 요일마다 하루 평균. 오늘은 도장이 있을 때만 넣어요(하루가 아직 끝나지 않았으니) */
export function weekdaySummary(record: CheckinRecord | undefined, today: string, window: WeekdayWindow): WeekdaySummary {
  const first = firstRecordDate(record);
  const empty = Array.from({ length: 7 }, (_, weekday) => ({ weekday, average: 0, days: 0, topSub: null, topSubAverage: 0 }));
  if (!first) return { stats: empty, from: null, best: null, worst: null };
  const windowStart = window === 'all' ? first : addDays(today, window === '4w' ? -27 : -55);
  const from = windowStart > first ? windowStart : first;
  const last = checksOn(record, today).length > 0 ? today : addDays(today, -1);
  const dates = from <= last ? datesBetween(from, last) : [];
  const stats: WeekdayStat[] = empty.map((stat) => {
    const days = dates.filter((date) => weekdayIndex(date) === stat.weekday);
    if (days.length === 0) return stat;
    const counts = actionCounts(record, days);
    const subs = subTotals(counts);
    const top = subs.reduce((best, value, s) => (value > subs[best] ? s : best), 0);
    return {
      weekday: stat.weekday,
      average: checksIn(record, days) / days.length,
      days: days.length,
      topSub: subs[top] > 0 ? top : null,
      topSubAverage: subs[top] / days.length,
    };
  });
  const seen = stats.filter((s) => s.days > 0);
  const best = seen.length > 0 ? seen.reduce((a, b) => (b.average > a.average ? b : a)).weekday : null;
  const worst = seen.length > 1 ? seen.reduce((a, b) => (b.average < a.average ? b : a)).weekday : null;
  return { stats, from, best, worst: worst === best ? null : worst };
}

// ───────────────────────── 지난달 회고 ─────────────────────────

export interface MonthReview {
  range: PeriodRange;
  activeDays: number;
  checks: number;
  top: ActionCount[];
  untouched: ActionCount[];
  /** 기록한 달 가운데 도장이 가장 많은 달(이번 달은 빼고) */
  best: boolean;
}

/** 지난달 돌아보기. 지난달에 도장이 하나도 없으면 null */
export function lastMonthReview(board: Board, record: CheckinRecord | undefined, today: string): MonthReview | null {
  const range = monthRange(today, -1);
  const stats = computeStats(board, record, range, today);
  if (stats.checks === 0) return null;
  const thisMonth = monthRange(today, 0).start.slice(0, 7);
  const totals = new Map<string, number>();
  for (const date of recordDates(record)) {
    const month = date.slice(0, 7);
    if (month === thisMonth) continue;
    totals.set(month, (totals.get(month) ?? 0) + checksOn(record, date).length);
  }
  const best = [...totals.values()].every((value) => value <= stats.checks);
  return { range, activeDays: stats.activeDays, checks: stats.checks, top: stats.top, untouched: stats.untouched, best };
}

// ───────────────────────── 누적 ─────────────────────────

export const TOTAL_MILESTONES = [100, 300, 500, 1000, 2000, 3000, 5000] as const;

export interface CumulativeSummary {
  total: number;
  first: string | null;
  /** 처음 기록한 달부터 이번 달까지 달마다 누적(그 달 끝, 이번 달은 오늘까지) */
  months: Array<{ month: string; label: string; total: number }>;
  next: number;
  left: number;
  /** 닿은 고비와 그날(첫 도장 = 1) */
  reached: Array<{ count: number; date: string }>;
  /** 최근 30일 속도로 다음 고비에 닿는 때: '11월 중순'. 최근 30일에 도장이 없으면 null */
  eta: string | null;
}

function etaLabel(date: string, today: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const part = d <= 10 ? '초' : d <= 20 ? '중순' : '말';
  return `${y === Number(today.slice(0, 4)) ? '' : `${y}년 `}${m}월 ${part}`;
}

export function cumulativeSummary(record: CheckinRecord | undefined, today: string): CumulativeSummary {
  const dates = recordDates(record).filter((date) => date <= today);
  const first = dates[0] ?? null;
  let running = 0;
  const reached: Array<{ count: number; date: string }> = [];
  const byMonth = new Map<string, number>();
  for (const date of dates) {
    const before = running;
    running += checksOn(record, date).length;
    if (before === 0) reached.push({ count: 1, date });
    for (const m of TOTAL_MILESTONES) if (before < m && running >= m) reached.push({ count: m, date });
    byMonth.set(date.slice(0, 7), running);
  }
  const months: CumulativeSummary['months'] = [];
  if (first) {
    let cursor = `${first.slice(0, 7)}-01`;
    let carried = 0;
    while (cursor.slice(0, 7) <= today.slice(0, 7)) {
      const month = cursor.slice(0, 7);
      carried = byMonth.get(month) ?? carried;
      months.push({ month, label: `${Number(month.slice(5))}월`, total: carried });
      cursor = addDays(monthRange(cursor, 0).end, 1);
    }
  }
  const next = TOTAL_MILESTONES.find((m) => m > running) ?? (Math.floor(running / 1000) + 1) * 1000;
  const recentStart = first && first > addDays(today, -29) ? first : addDays(today, -29);
  const recentDaysCount = first ? datesBetween(recentStart, today).length : 0;
  const recentChecks = first ? checksIn(record, datesBetween(recentStart, today)) : 0;
  const perDay = recentDaysCount > 0 ? recentChecks / recentDaysCount : 0;
  const eta = perDay > 0 ? etaLabel(addDays(today, Math.ceil((next - running) / perDay)), today) : null;
  return { total: running, first, months, next, left: next - running, reached, eta };
}

// ───────────────────────── 달력 ─────────────────────────

/** 1년 잔디: 월요일 시작 주마다 7칸(그해 밖이면 out, 오늘 뒤면 future) */
export interface GrassCell {
  date: string;
  count: number;
  out: boolean;
  future: boolean;
}

export function yearGrass(record: CheckinRecord | undefined, range: PeriodRange, today: string): { weeks: GrassCell[][]; months: Array<{ week: number; label: string }> } {
  const start = addDays(range.start, -weekdayIndex(range.start));
  const end = addDays(range.end, 6 - weekdayIndex(range.end));
  const weeks: GrassCell[][] = [];
  const months: Array<{ week: number; label: string }> = [];
  for (const date of datesBetween(start, end)) {
    if (weekdayIndex(date) === 0) weeks.push([]);
    const out = date < range.start || date > range.end;
    weeks[weeks.length - 1].push({ date, count: out ? 0 : checksOn(record, date).length, out, future: date > today });
    if (!out && date.endsWith('-01')) months.push({ week: weeks.length - 1, label: `${Number(date.slice(5, 7))}월` });
  }
  return { weeks, months };
}

/** 그해 달마다 도장(12개) */
export function monthTotals(record: CheckinRecord | undefined, year: string): number[] {
  return Array.from({ length: 12 }, (_, m) => checksIn(record, monthRange(`${year}-${String(m + 1).padStart(2, '0')}-01`, 0).dates));
}

/** 도장이 가장 많은 달 'YYYY-MM'(같으면 최근). 기록이 없으면 null */
export function bestMonth(record: CheckinRecord | undefined): string | null {
  const totals = new Map<string, number>();
  for (const date of recordDates(record)) totals.set(date.slice(0, 7), (totals.get(date.slice(0, 7)) ?? 0) + checksOn(record, date).length);
  let best: string | null = null;
  for (const [month, value] of totals) if (best === null || value >= (totals.get(best) ?? 0)) best = month;
  return best;
}
