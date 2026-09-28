/**
 * 오늘 체크 로직 (화면과 분리해 테스트하기 쉽게).
 * 계약: contract/state.schema.json 의 checkins(byBoard[boardId].days[YYYY-MM-DD] = 오늘 체크한 실천 번호).
 * 체크가 하나도 없는 날은 기록을 지워요 → 연속 일수는 "하나라도 체크한 날" 로 이어져요.
 */
import { ACTION_COUNT, TOTAL_ACTIONS, actionIndex, type Board } from './mandalart';
import { MAX_CHECKIN_DAYS, type CheckinRecord, type CheckinsState } from './state';

export interface CheckinItem {
  /** 실천 번호 0~63 */
  index: number;
  subIndex: number;
  action: number;
  text: string;
}

export interface CheckinGroup {
  subIndex: number;
  title: string;
  items: CheckinItem[];
}

/** 글이 있는 실천만, 세부 목표별로 묶어요. 실천이 하나도 없는 세부 목표는 빠져요. */
export function checkinGroups(board: Board): CheckinGroup[] {
  const groups: CheckinGroup[] = [];
  board.subs.forEach((sub, subIndex) => {
    const items: CheckinItem[] = [];
    sub.actions.forEach((text, action) => {
      if (!text.trim()) return;
      items.push({ index: actionIndex(subIndex, action), subIndex, action, text: text.trim() });
    });
    if (items.length === 0) return;
    groups.push({ subIndex, title: sub.title.trim() || `세부 목표 ${subIndex + 1}`, items });
  });
  return groups;
}

/** 그날 체크한 실천 번호. 없으면 빈 배열 */
export function todayChecked(record: CheckinRecord | undefined, date: string): number[] {
  return record?.days[date] ?? [];
}

export function todaySet(record: CheckinRecord | undefined, date: string): Set<number> {
  return new Set(todayChecked(record, date));
}

/** 어떤 세부 목표 안에서 오늘 체크한 실천 수 */
export function checkedInSub(checked: ReadonlySet<number>, subIndex: number): number {
  let n = 0;
  for (let a = 0; a < ACTION_COUNT; a += 1) if (checked.has(actionIndex(subIndex, a))) n += 1;
  return n;
}

/** 그날 기록을 통째로 써요(정리·중복 제거). 빈 목록이면 그날 기록을 지워요. 오래된 날은 MAX_CHECKIN_DAYS 만 남겨요. */
export function applyCheckin(checkins: CheckinsState, boardId: string, date: string, indices: number[], now: number): CheckinsState {
  const prev = checkins.byBoard[boardId] ?? { days: {}, lastCompletedAt: null };
  const clean = Array.from(new Set(indices.filter((n) => Number.isInteger(n) && n >= 0 && n < TOTAL_ACTIONS))).sort((a, b) => a - b);
  const days: Record<string, number[]> = { ...prev.days };
  if (clean.length === 0) delete days[date];
  else days[date] = clean;
  const keys = Object.keys(days).sort();
  while (keys.length > MAX_CHECKIN_DAYS) {
    const oldest = keys.shift();
    if (oldest !== undefined) delete days[oldest];
  }
  return {
    version: 1,
    byBoard: { ...checkins.byBoard, [boardId]: { days, lastCompletedAt: now } },
  };
}

/** 실천 하나를 오늘 체크/해제해요. */
export function toggleCheck(checkins: CheckinsState, boardId: string, date: string, index: number, now: number): CheckinsState {
  const current = new Set(todayChecked(checkins.byBoard[boardId], date));
  if (current.has(index)) current.delete(index);
  else current.add(index);
  return applyCheckin(checkins, boardId, date, Array.from(current), now);
}

/** 'YYYY-MM-DD' → '9월 29일' */
export function formatDateLabel(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${m}월 ${d}일`;
}
