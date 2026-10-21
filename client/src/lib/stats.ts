/**
 * 기록 통계 (화면 흐름 v3 '기록' 화면의 주간·월간 탭 → 3.0 위젯 판의 대시보드 기간 주·월·년, 더 많은 숫자는 lib/records.ts).
 * 데이터는 이미 쌓이는 체크 기록 그대로 써요: checkins.byBoard[판].days['YYYY-MM-DD'] = 그날 체크한 실천 번호.
 * 기록은 "몇 번째 칸을 체크했나" 라서, 실천 문구를 고치면 예전 기록도 지금 문구로 집계돼요.
 * 날짜는 시간대와 무관하게 'YYYY-MM-DD' 문자열끼리 계산해요(UTC 자정 기준 Date 로만 더하고 빼요).
 */
import { ACTION_COUNT, SUB_COUNT, TOTAL_ACTIONS, type Board } from './mandalart';
import type { CheckinRecord } from './state';

export type StatsPeriod = 'week' | 'month' | 'year';

export interface PeriodRange {
  period: StatsPeriod;
  /** 0 = 이번 주(달), -1 = 지난 주(달) … */
  offset: number;
  /** 첫날 'YYYY-MM-DD' (주는 월요일) */
  start: string;
  /** 마지막 날 'YYYY-MM-DD' */
  end: string;
  /** start~end 의 모든 날짜 */
  dates: string[];
  /** '10월 13일 ~ 19일' · '2026년 10월' · '2026년' */
  label: string;
}

export interface DayCount {
  date: string;
  count: number;
  /** 오늘 뒤의 날 (기록이 생길 수 없음) */
  future: boolean;
}

export interface SubCount {
  subIndex: number;
  title: string;
  count: number;
}

export interface ActionCount {
  /** 실천 번호 0~63 */
  index: number;
  text: string;
  count: number;
}

export interface PeriodStats {
  range: PeriodRange;
  daily: DayCount[];
  /** 체크가 1개 이상인 날 수 */
  activeDays: number;
  /** 기간 안 체크 수 합 */
  checks: number;
  /** 기간 안에서 체크한 날이 이어진 가장 긴 길이 */
  longestStreak: number;
  /** 세부 목표별 합 (적어 둔 세부 목표·실천이 있거나 기록이 있는 것만, 1~8 순서) */
  bySub: SubCount[];
  /** 많이 한 실천 (많은 순, 같으면 번호 순, 최대 3개, 0번 제외) */
  top: ActionCount[];
  /** 지금 글이 적힌 실천 중 이 기간에 한 번도 안 한 것 (번호 순) */
  untouched: ActionCount[];
}

export const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;

function toUtc(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(key: string, days: number): string {
  const date = toUtc(key);
  date.setUTCDate(date.getUTCDate() + days);
  return toKey(date);
}

/** 0 = 월요일 … 6 = 일요일 */
export function weekdayIndex(key: string): number {
  return (toUtc(key).getUTCDay() + 6) % 7;
}

export function weekdayLabel(key: string): string {
  return WEEKDAY_LABELS[weekdayIndex(key)];
}

/** start~end 의 모든 날짜(둘 다 포함) */
export function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) dates.push(cursor);
  return dates;
}

function parts(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

/** '10월 13일 ~ 19일'·'9월 29일 ~ 10월 5일'(해가 다르면 해까지) */
export function rangeLabel(start: string, end: string): string {
  const a = parts(start);
  const b = parts(end);
  if (a.y !== b.y) return `${a.y}년 ${a.m}월 ${a.d}일 ~ ${b.y}년 ${b.m}월 ${b.d}일`;
  if (a.m !== b.m) return `${a.m}월 ${a.d}일 ~ ${b.m}월 ${b.d}일`;
  return `${a.m}월 ${a.d}일 ~ ${b.d}일`;
}

/** today 가 든 주(월~일)에서 offset 주 옮긴 기간 */
export function weekRange(today: string, offset: number): PeriodRange {
  const start = addDays(addDays(today, -weekdayIndex(today)), offset * 7);
  const end = addDays(start, 6);
  return { period: 'week', offset, start, end, dates: datesBetween(start, end), label: rangeLabel(start, end) };
}

/** today 가 든 달에서 offset 달 옮긴 기간 */
export function monthRange(today: string, offset: number): PeriodRange {
  const { y, m } = parts(today);
  const first = new Date(Date.UTC(y, m - 1 + offset, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  const start = toKey(first);
  const end = toKey(last);
  return {
    period: 'month',
    offset,
    start,
    end,
    dates: datesBetween(start, end),
    label: `${first.getUTCFullYear()}년 ${first.getUTCMonth() + 1}월`,
  };
}

/** today 가 든 해(1월~12월)에서 offset 해 옮긴 기간 */
export function yearRange(today: string, offset: number): PeriodRange {
  const year = parts(today).y + offset;
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  return { period: 'year', offset, start, end, dates: datesBetween(start, end), label: `${year}년` };
}

export function periodRange(period: StatsPeriod, today: string, offset: number): PeriodRange {
  if (period === 'week') return weekRange(today, offset);
  return period === 'month' ? monthRange(today, offset) : yearRange(today, offset);
}

/** 가장 오래된 기록 날짜 (없으면 null) */
export function firstRecordDate(record: CheckinRecord | undefined): string | null {
  const keys = record ? Object.keys(record.days).sort() : [];
  return keys[0] ?? null;
}

/** 이전 기간으로 옮길 수 있나: 이 기간 앞에 기록이 있을 때만 */
export function canGoPrev(range: PeriodRange, record: CheckinRecord | undefined): boolean {
  const first = firstRecordDate(record);
  return first !== null && first < range.start;
}

/** 다음 기간으로 옮길 수 있나: 이번 기간보다 앞일 때만 */
export function canGoNext(range: PeriodRange): boolean {
  return range.offset < 0;
}

function actionText(board: Board, index: number): string {
  const subIndex = Math.floor(index / ACTION_COUNT);
  const action = index % ACTION_COUNT;
  return board.subs[subIndex]?.actions[action]?.trim() || `실천 ${action + 1}`;
}

export function computeStats(board: Board, record: CheckinRecord | undefined, range: PeriodRange, today: string): PeriodStats {
  const days = record?.days ?? {};
  const perAction = new Array<number>(TOTAL_ACTIONS).fill(0);
  let checks = 0;
  let activeDays = 0;
  let run = 0;
  let longestStreak = 0;

  const daily = range.dates.map((date) => {
    const indices = (days[date] ?? []).filter((n) => Number.isInteger(n) && n >= 0 && n < TOTAL_ACTIONS);
    const count = indices.length;
    indices.forEach((n) => {
      perAction[n] += 1;
    });
    checks += count;
    if (count > 0) {
      activeDays += 1;
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 0;
    }
    return { date, count, future: date > today };
  });

  const bySub: SubCount[] = [];
  for (let subIndex = 0; subIndex < SUB_COUNT; subIndex += 1) {
    const sub = board.subs[subIndex];
    const count = perAction.slice(subIndex * ACTION_COUNT, (subIndex + 1) * ACTION_COUNT).reduce((a, b) => a + b, 0);
    const written = Boolean(sub?.title.trim()) || Boolean(sub?.actions.some((a) => a.trim()));
    if (!written && count === 0) continue;
    bySub.push({ subIndex, title: sub?.title.trim() || `세부 목표 ${subIndex + 1}`, count });
  }

  const top = perAction
    .map((count, index) => ({ index, count, text: actionText(board, index) }))
    .filter((a) => a.count > 0)
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .slice(0, 3);

  const untouched: ActionCount[] = [];
  perAction.forEach((count, index) => {
    const text = board.subs[Math.floor(index / ACTION_COUNT)]?.actions[index % ACTION_COUNT]?.trim();
    if (text && count === 0) untouched.push({ index, text, count: 0 });
  });

  return { range, daily, activeDays, checks, longestStreak, bySub, top, untouched };
}

/** 달력 칸 진하기 4단계: 0 / 1~2 / 3~5 / 6+ */
export function heatLevel(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  return 3;
}

/** 월 달력: 월요일부터 7칸씩. 1일 앞 빈칸은 null */
export function monthCells(range: PeriodRange): Array<string | null> {
  const leading = new Array<null>(weekdayIndex(range.start)).fill(null);
  const cells: Array<string | null> = [...leading, ...range.dates];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

