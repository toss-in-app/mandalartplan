import { ACTION_COUNT, CENTER, actionIndex, ringIndex, type Board } from './mandalart';

export interface CellView {
  text: string;
  placeholder: string;
  kind: 'goal' | 'sub' | 'action';
  /** kind 가 sub 면 세부 목표 index(0~7), action 이면 실천 번호(0~63) */
  index: number | null;
  /** 실천 칸: 오늘 체크함. 세부 목표 칸: 글이 있는 실천을 오늘 전부 체크함(홈·전체 보기·세부 화면 가운데가 진해져요) */
  checked: boolean;
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
      return { text: board.goal, placeholder: '핵심 목표', kind: 'goal', index: null, checked: false };
    }
    const s = ringIndex(cell);
    // 빈 세부 목표 칸은 비워 둬요(“목표 n” 같은 자리 표시를 보여주지 않아요, 2026-10-20 사용자 피드백)
    return { text: board.subs[s].title, placeholder: '', kind: 'sub', index: s, checked: subCompleted(board, s, checked) };
  }
  const s = ringIndex(block);
  const sub = board.subs[s];
  if (cell === CENTER) {
    return { text: sub.title, placeholder: '', kind: 'sub', index: s, checked: subCompleted(board, s, checked) };
  }
  const a = ringIndex(cell);
  const index = actionIndex(s, a);
  return { text: sub.actions[a], placeholder: '', kind: 'action', index, checked: checked.has(index) };
}
