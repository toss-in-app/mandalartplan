import { CENTER, actionIndex, ringIndex, type Board } from './mandalart';

export interface CellView {
  text: string;
  placeholder: string;
  kind: 'goal' | 'sub' | 'action';
  /** kind 가 sub 면 세부 목표 index(0~7), action 이면 실천 번호(0~63) */
  index: number | null;
  /** 오늘 체크한 실천 */
  checked: boolean;
}

/** 블록 index(0~8)와 칸 index(0~8)가 보드의 어느 글인지 계산해요. */
export function cellView(board: Board, block: number, cell: number, checked: ReadonlySet<number> = new Set()): CellView {
  if (block === CENTER) {
    if (cell === CENTER) {
      return { text: board.goal, placeholder: '핵심 목표', kind: 'goal', index: null, checked: false };
    }
    const s = ringIndex(cell);
    return { text: board.subs[s].title, placeholder: `목표 ${s + 1}`, kind: 'sub', index: s, checked: false };
  }
  const s = ringIndex(block);
  const sub = board.subs[s];
  if (cell === CENTER) {
    return { text: sub.title, placeholder: `목표 ${s + 1}`, kind: 'sub', index: s, checked: false };
  }
  const a = ringIndex(cell);
  const index = actionIndex(s, a);
  return { text: sub.actions[a], placeholder: '', kind: 'action', index, checked: checked.has(index) };
}
