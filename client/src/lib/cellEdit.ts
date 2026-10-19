import { CENTER, ringIndex, type Board } from './mandalart';

/**
 * 칸 하나를 적는 바텀시트의 내용(편집 화면·홈·세부 목표 화면 공용). 화면은 `hooks/useCellEditor`.
 */

export const EDITOR_INPUT_ID = 'mandalart-cell-editor';

/** 이 칸이 판의 어느 글인지 */
export type CellField = { kind: 'goal' } | { kind: 'sub'; subIndex: number } | { kind: 'action'; subIndex: number; actionIndex: number };

export interface CellEditTarget {
  field: CellField;
  /** 3×3 안의 칸 번호(위치 아이콘) */
  cell: number;
  /** 시트 제목(질문형). 위 칸의 이름을 넣어요: "자격증 따기 칸의 세부 목표는 무엇인가요?" */
  question: string;
  /** 칸 위치 이름: 핵심 목표 · 세부 목표 n · 실천 n */
  position: string;
  placeholder: string;
  value: string;
}

export interface CellEditHandlers {
  onChangeGoal?: (goal: string) => void;
  onChangeSubTitle?: (subIndex: number, title: string) => void;
  onChangeAction?: (subIndex: number, actionIndex: number, text: string) => void;
}

/** 제목에 넣을 칸 이름. 길면 줄여요(전체 글은 3×3 에 그대로 보여요) */
function nameForTitle(text: string, max = 16): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** 블록(0~8)·칸(0~8) → 그 칸의 질문, 위치 이름, 지금 글 */
export function editTarget(board: Board, block: number, cell: number): CellEditTarget {
  const goal = board.goal.trim();
  // 세부 목표 칸의 질문: 핵심 목표 이름을 넣어요. 핵심 목표가 비어 있으면 일반 질문
  const subQuestion = goal ? `${nameForTitle(goal)} 칸의 세부 목표는 무엇인가요?` : '목표를 이루려면 무엇이 필요할까요?';
  if (block === CENTER) {
    if (cell === CENTER) {
      return { field: { kind: 'goal' }, cell, question: '어떤 목표를 이루고 싶나요?', position: '핵심 목표', placeholder: '예: 올해 안에 책 한 권 쓰기', value: board.goal };
    }
    const s = ringIndex(cell);
    return { field: { kind: 'sub', subIndex: s }, cell, question: subQuestion, position: `세부 목표 ${s + 1}`, placeholder: '예: 꾸준한 운동', value: board.subs[s].title };
  }
  const s = ringIndex(block);
  if (cell === CENTER) {
    return { field: { kind: 'sub', subIndex: s }, cell, question: subQuestion, position: `세부 목표 ${s + 1}`, placeholder: '예: 매일 글쓰기 습관', value: board.subs[s].title };
  }
  const a = ringIndex(cell);
  // 실천 칸의 질문: 세부 목표 이름을 넣어요. 비어 있으면 '세부 목표 n'
  const subName = board.subs[s].title.trim() || `세부 목표 ${s + 1}`;
  return {
    field: { kind: 'action', subIndex: s, actionIndex: a },
    cell,
    question: `${nameForTitle(subName)} 칸의 실천은 무엇인가요?`,
    position: `실천 ${a + 1}`,
    placeholder: '예: 아침 스트레칭 10분',
    value: board.subs[s].actions[a],
  };
}

export function applyEdit(field: CellField, text: string, handlers: CellEditHandlers) {
  if (field.kind === 'goal') handlers.onChangeGoal?.(text);
  else if (field.kind === 'sub') handlers.onChangeSubTitle?.(field.subIndex, text);
  else handlers.onChangeAction?.(field.subIndex, field.actionIndex, text);
}

/** 입력칸에 포커스하고 커서를 글 끝에 둬요(이미 적힌 글을 이어서 고치기 쉽게) */
export function focusEditor() {
  const el = document.getElementById(EDITOR_INPUT_ID) as HTMLTextAreaElement | null;
  if (!el) return;
  el.focus();
  const end = el.value.length;
  el.setSelectionRange(end, end);
}
