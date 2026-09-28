/**
 * 만다라트 데이터 모델.
 *
 * 9×9 판은 3×3 블록 9개로 이뤄져요. 가운데 블록(4)의 가운데 칸이 핵심 목표,
 * 그 둘레 8칸이 세부 목표예요. 둘레 블록 b 는 세부 목표 ringIndex(b) 를 펼친 것으로,
 * 가운데 칸에 세부 목표, 둘레 8칸에 실천 항목이 들어가요.
 */

export const SUB_COUNT = 8;
export const ACTION_COUNT = 8;
/** 3×3 블록 안에서 가운데 칸(또는 9개 블록 중 가운데 블록)의 index */
export const CENTER = 4;
/** 한 칸에 쓸 수 있는 최대 글자 수 */
export const MAX_TEXT = 40;

export interface SubGoal {
  title: string;
  actions: string[];
  done: boolean[];
}

export interface Board {
  version: 1;
  goal: string;
  subs: SubGoal[];
  updatedAt: number;
}

export function createEmptySub(): SubGoal {
  return {
    title: '',
    actions: Array.from({ length: ACTION_COUNT }, () => ''),
    done: Array.from({ length: ACTION_COUNT }, () => false),
  };
}

export function createEmptyBoard(): Board {
  return {
    version: 1,
    goal: '',
    subs: Array.from({ length: SUB_COUNT }, createEmptySub),
    updatedAt: 0,
  };
}

/** 3×3 블록의 칸 index(0~8, 가운데 4 제외)를 둘레 순번(0~7)으로 바꿔요. */
export function ringIndex(cell: number): number {
  if (!Number.isInteger(cell) || cell < 0 || cell > 8 || cell === CENTER) {
    throw new RangeError(`가운데가 아닌 칸(0~3, 5~8)이어야 해요: ${cell}`);
  }
  return cell < CENTER ? cell : cell - 1;
}

/** 둘레 순번(0~7)을 3×3 블록의 칸 index(0~8)로 바꿔요. */
export function cellOfRing(ring: number): number {
  if (!Number.isInteger(ring) || ring < 0 || ring >= SUB_COUNT) {
    throw new RangeError(`둘레 순번은 0~7 이어야 해요: ${ring}`);
  }
  return ring < CENTER ? ring : ring + 1;
}

export function clampText(value: string): string {
  return value.slice(0, MAX_TEXT);
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? clampText(value) : '';
}

/** 저장돼 있던 값을 검증해서 Board 로 만들어요. 모양이 다르면 null 을 돌려줘요. */
export function normalizeBoard(input: unknown): Board | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  if (raw.version !== 1 || !Array.isArray(raw.subs)) return null;

  const board = createEmptyBoard();
  board.goal = cleanText(raw.goal);
  board.updatedAt = typeof raw.updatedAt === 'number' ? raw.updatedAt : 0;

  raw.subs.slice(0, SUB_COUNT).forEach((item, i) => {
    if (!item || typeof item !== 'object') return;
    const sub = item as Record<string, unknown>;
    const actions = Array.isArray(sub.actions) ? sub.actions : [];
    const done = Array.isArray(sub.done) ? sub.done : [];
    board.subs[i].title = cleanText(sub.title);
    for (let a = 0; a < ACTION_COUNT; a++) {
      board.subs[i].actions[a] = cleanText(actions[a]);
      board.subs[i].done[a] = done[a] === true;
    }
  });
  return board;
}

export function parseBoard(json: string | null): Board | null {
  if (!json) return null;
  try {
    return normalizeBoard(JSON.parse(json));
  } catch {
    return null;
  }
}

export interface Progress {
  /** 글이 적힌 칸 수 (핵심 1 + 세부 8 + 실천 64 = 최대 73) */
  filled: number;
  totalCells: number;
  /** 완료 표시한 실천 항목 수 (글이 있는 것만 셈) */
  done: number;
  totalActions: number;
}

export function getProgress(board: Board): Progress {
  let filled = board.goal.trim() ? 1 : 0;
  let done = 0;
  for (const sub of board.subs) {
    if (sub.title.trim()) filled += 1;
    sub.actions.forEach((action, i) => {
      if (!action.trim()) return;
      filled += 1;
      if (sub.done[i]) done += 1;
    });
  }
  return {
    filled,
    totalCells: 1 + SUB_COUNT + SUB_COUNT * ACTION_COUNT,
    done,
    totalActions: SUB_COUNT * ACTION_COUNT,
  };
}

/** 공유용 텍스트. 비어 있는 세부 목표는 건너뛰어요. */
export function boardToText(board: Board): string {
  const lines: string[] = [`[핵심 목표] ${board.goal.trim() || '아직 정하지 않았어요'}`];
  board.subs.forEach((sub, i) => {
    const actions = sub.actions
      .map((action, j) => {
        const text = action.trim();
        if (!text) return null;
        return `${sub.done[j] ? '- [완료] ' : '- '}${text}`;
      })
      .filter((line): line is string => line !== null);
    if (!sub.title.trim() && actions.length === 0) return;
    lines.push('', `${i + 1}. ${sub.title.trim() || `세부 목표 ${i + 1}`}`, ...actions);
  });
  return lines.join('\n');
}
