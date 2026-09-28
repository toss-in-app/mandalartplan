import { CENTER, ringIndex, type Board } from './mandalart';

export interface CellView {
  text: string;
  placeholder: string;
  kind: 'goal' | 'sub' | 'action';
  done: boolean;
}

/** 블록 index(0~8)와 칸 index(0~8)가 보드의 어느 글인지 계산해요. */
export function cellView(board: Board, block: number, cell: number): CellView {
  if (block === CENTER) {
    if (cell === CENTER) {
      return { text: board.goal, placeholder: '핵심 목표', kind: 'goal', done: false };
    }
    const s = ringIndex(cell);
    return { text: board.subs[s].title, placeholder: `목표 ${s + 1}`, kind: 'sub', done: false };
  }
  const s = ringIndex(block);
  const sub = board.subs[s];
  if (cell === CENTER) {
    return { text: sub.title, placeholder: `목표 ${s + 1}`, kind: 'sub', done: false };
  }
  const a = ringIndex(cell);
  return { text: sub.actions[a], placeholder: '', kind: 'action', done: sub.done[a] };
}
