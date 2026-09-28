/**
 * 오늘 체크인 로직 (화면과 분리해 테스트하기 쉽게).
 * 계약: contract/state.schema.json 의 checkins(byBoard[boardId].days[YYYY-MM-DD] = 실천 번호 목록).
 */
import { actionIndex, type Board } from './mandalart';
import { MAX_CHECKIN_DAYS, type CheckinRecord, type CheckinsState } from './state';

export interface CheckinItem {
  /** 실천 번호 0~63 */
  index: number;
  subIndex: number;
  action: number;
  text: string;
  /** 달성 표시(영구)된 실천 */
  done: boolean;
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
      items.push({ index: actionIndex(subIndex, action), subIndex, action, text: text.trim(), done: sub.done[action] });
    });
    if (items.length === 0) return;
    groups.push({ subIndex, title: sub.title.trim() || `세부 목표 ${subIndex + 1}`, items });
  });
  return groups;
}

/** 오늘 완료했으면 체크한 번호 목록, 아직이면 null */
export function todayChecked(record: CheckinRecord | undefined, date: string): number[] | null {
  return record?.days[date] ?? null;
}

/** 체크인 완료를 기록해요. 같은 날 다시 완료하면 덮어써요. 오래된 날은 MAX_CHECKIN_DAYS 만 남겨요. */
export function applyCheckin(checkins: CheckinsState, boardId: string, date: string, indices: number[], now: number): CheckinsState {
  const prev = checkins.byBoard[boardId] ?? { days: {}, lastCompletedAt: null };
  const clean = Array.from(new Set(indices.filter((n) => Number.isInteger(n) && n >= 0 && n < 64))).sort((a, b) => a - b);
  const days: Record<string, number[]> = { ...prev.days, [date]: clean };
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

/** 'YYYY-MM-DD' → '9월 29일' */
export function formatDateLabel(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${m}월 ${d}일`;
}
