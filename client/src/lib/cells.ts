import { ACTION_COUNT, CENTER, actionIndex, cellOfRing, ringIndex, type Board } from './mandalart';

export interface CellView {
  text: string;
  placeholder: string;
  kind: 'goal' | 'sub' | 'action';
  /** kind 가 sub 면 세부 목표 index(0~7), action 이면 실천 번호(0~63) */
  index: number | null;
  /** 실천 칸: 오늘 체크함. 세부 목표 칸: 글이 있는 실천을 오늘 전부 체크함(홈·전체 보기·세부 화면 가운데가 진해져요) */
  checked: boolean;
  /** 세부 목표 칸: 글이 있는 실천 중 오늘 체크한 비율(0~1, 실천이 없으면 0) — 홈·전체 보기에서 이만큼 진해져요. 그 밖의 칸은 0 */
  progress: number;
}

/** 세부 목표의 오늘 진행: 글이 있는 실천 중 체크한 비율(0~1). 실천이 없으면 0 */
export function subProgress(board: Board, subIndex: number, checked: ReadonlySet<number>): number {
  let total = 0;
  let done = 0;
  for (let a = 0; a < ACTION_COUNT; a += 1) {
    if (!board.subs[subIndex].actions[a].trim()) continue;
    total += 1;
    if (checked.has(actionIndex(subIndex, a))) done += 1;
  }
  return total === 0 ? 0 : done / total;
}

/** 글이 있는 실천이 1개 이상이고 오늘 전부 체크했는지 */
export function subCompleted(board: Board, subIndex: number, checked: ReadonlySet<number>): boolean {
  let total = 0;
  for (let a = 0; a < ACTION_COUNT; a += 1) {
    if (!board.subs[subIndex].actions[a].trim()) continue;
    total += 1;
    if (!checked.has(actionIndex(subIndex, a))) return false;
  }
  return total > 0;
}

/** 블록 index(0~8)와 칸 index(0~8)가 보드의 어느 글인지 계산해요. */
export function cellView(board: Board, block: number, cell: number, checked: ReadonlySet<number> = new Set()): CellView {
  if (block === CENTER) {
    if (cell === CENTER) {
      return { text: board.goal, placeholder: '핵심 목표', kind: 'goal', index: null, checked: false, progress: 0 };
    }
    const s = ringIndex(cell);
    // 빈 세부 목표 칸은 비워 둬요(“목표 n” 같은 자리 표시를 보여주지 않아요, 2026-10-20 사용자 피드백)
    return { text: board.subs[s].title, placeholder: '', kind: 'sub', index: s, checked: subCompleted(board, s, checked), progress: subProgress(board, s, checked) };
  }
  const s = ringIndex(block);
  const sub = board.subs[s];
  if (cell === CENTER) {
    return { text: sub.title, placeholder: '', kind: 'sub', index: s, checked: subCompleted(board, s, checked), progress: subProgress(board, s, checked) };
  }
  const a = ringIndex(cell);
  const index = actionIndex(s, a);
  return { text: sub.actions[a], placeholder: '', kind: 'action', index, checked: checked.has(index), progress: 0 };
}

/**
 * 블록에서 다음에 채울 칸(0~8): 가운데가 비었으면 가운데, 아니면 둘레의 첫 빈 칸. 다 찼으면 null.
 * 빈 칸 안내(은은한 깜빡임 + '눌러서 적기')를 한 칸에만 보여주려고 써요.
 */
export function nextEmptyCell(board: Board, block: number): number | null {
  if (block === CENTER) {
    if (!board.goal.trim()) return CENTER;
    const s = board.subs.findIndex((sub) => !sub.title.trim());
    return s === -1 ? null : cellOfRing(s);
  }
  const sub = board.subs[ringIndex(block)];
  if (!sub.title.trim()) return CENTER;
  const a = sub.actions.findIndex((action) => !action.trim());
  return a === -1 ? null : cellOfRing(a);
}
