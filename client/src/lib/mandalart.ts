/**
 * 만다라트 데이터 모델 (계약: contract/state.schema.json 의 board).
 *
 * 9×9 판은 3×3 블록 9개. 가운데 블록(4)의 가운데 칸이 핵심 목표, 그 둘레 8칸이 세부 목표.
 * 둘레 블록 b 는 세부 목표 ringIndex(b) 를 펼친 것으로, 가운데 칸에 세부 목표, 둘레 8칸에 실천 항목.
 * 실천의 "오늘 했어요" 는 판이 아니라 체크인 기록(state.ts checkins)에 날짜별로 남아요.
 */

export const SUB_COUNT = 8;
export const ACTION_COUNT = 8;
/** 3×3 블록 안에서 가운데 칸(또는 9개 블록 중 가운데 블록)의 index */
export const CENTER = 4;
/** 한 칸에 쓸 수 있는 최대 글자 수 (계약 text40) */
export const MAX_TEXT = 40;
export const TOTAL_CELLS = 1 + SUB_COUNT + SUB_COUNT * ACTION_COUNT; // 73
export const TOTAL_ACTIONS = SUB_COUNT * ACTION_COUNT; // 64

export interface SubGoal {
  title: string;
  actions: string[];
}

/** AI 결과를 판에 넣은 기록 (계약 board.aiDraft, 2.0). AI 가 쓴 칸이 남아 있는 동안 'AI 초안' 표시를 붙여요(서비스 오픈 정책 2-4) */
export interface AiDraftMeta {
  /** AI 결과를 판에 마지막으로 넣은 시각 */
  at: number;
  model: string;
  promptVersion: number;
  /** AI 가 쓰고 사용자가 아직 고치지 않은 칸(`AI_CELL` 번호). 사용자가 고친 칸은 빠지고, 하나도 안 남으면 기록을 지워요 */
  cells: number[];
}

/** 칸 번호(AI 기록용): 0 = 핵심 목표, 1~8 = 세부 목표, 9~72 = 실천(9 + 세부 목표 × 8 + 실천) */
export const AI_CELL = {
  goal: 0,
  sub: (subIndex: number) => 1 + subIndex,
  action: (subIndex: number, action: number) => 1 + SUB_COUNT + subIndex * ACTION_COUNT + action,
} as const;

export interface Board {
  /** 'b' + 생성 시각(ms 13자리) */
  id: string;
  goal: string;
  subs: SubGoal[];
  /** 예시 템플릿에서 시작했으면 그 id */
  templateId: string | null;
  /** AI 초안·빈 칸 채우기 결과를 넣었으면 그 기록, 아니면 null */
  aiDraft: AiDraftMeta | null;
  createdAt: number;
  updatedAt: number;
}

const BOARD_ID_RE = /^b[0-9]{13}$/;

export function makeBoardId(now: number): string {
  return `b${String(Math.max(0, Math.floor(now))).padStart(13, '0').slice(-13)}`;
}

export function createEmptySub(): SubGoal {
  return { title: '', actions: Array.from({ length: ACTION_COUNT }, () => '') };
}

export function createEmptyBoard(now: number = Date.now()): Board {
  return {
    id: makeBoardId(now),
    goal: '',
    subs: Array.from({ length: SUB_COUNT }, createEmptySub),
    templateId: null,
    aiDraft: null,
    createdAt: now,
    updatedAt: now,
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

/** 체크인 기록에 쓰는 실천 번호 (0~63) = 세부 목표 index × 8 + 실천 index */
export function actionIndex(subIndex: number, action: number): number {
  return subIndex * ACTION_COUNT + action;
}

export function splitActionIndex(index: number): { subIndex: number; action: number } {
  return { subIndex: Math.floor(index / ACTION_COUNT), action: index % ACTION_COUNT };
}

export function clampText(value: string): string {
  return value.slice(0, MAX_TEXT);
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? clampText(value) : '';
}

function cleanTime(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

/** 칸 번호의 글 (AI_CELL 번호 → 판의 글) */
export function cellTextAt(board: Board, cell: number): string {
  if (cell === AI_CELL.goal) return board.goal;
  if (cell >= 1 && cell <= SUB_COUNT) return board.subs[cell - 1].title;
  const index = cell - 1 - SUB_COUNT;
  if (index < 0 || index >= TOTAL_ACTIONS) return '';
  return board.subs[Math.floor(index / ACTION_COUNT)].actions[index % ACTION_COUNT];
}

/** 이 판에 아직 AI 가 쓴 글이 남아 있는지('AI 초안' 표시 기준 — 홈·전체 보기·공유) */
export function hasAiText(board: Board): boolean {
  return board.aiDraft !== null && board.aiDraft.cells.length > 0;
}

/** 사용자가 칸 하나를 고쳤어요: 그 칸은 이제 사용자의 글이에요. 남은 AI 칸이 없으면 기록을 지워요 */
export function releaseAiCell(board: Board, cell: number): Board {
  const ai = board.aiDraft;
  if (!ai || !ai.cells.includes(cell)) return board;
  const cells = ai.cells.filter((c) => c !== cell);
  return { ...board, aiDraft: cells.length > 0 ? { ...ai, cells } : null };
}

/** 저장돼 있던 AI 기록. 모양이 다르면 null(표시 없음). cells 가 없으면(2.0 QR 초기 판) null 로 두고 판을 읽은 뒤 채워요 */
function cleanAiDraft(value: unknown): (Omit<AiDraftMeta, 'cells'> & { cells: number[] | null }) | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const { at, model, promptVersion } = raw;
  if (typeof at !== 'number' || !Number.isFinite(at) || at < 0) return null;
  if (typeof model !== 'string' || model.length === 0 || model.length > 64) return null;
  if (typeof promptVersion !== 'number' || !Number.isInteger(promptVersion) || promptVersion < 1) return null;
  const cells = Array.isArray(raw.cells)
    ? Array.from(new Set(raw.cells.filter((c): c is number => Number.isInteger(c) && (c as number) >= 0 && (c as number) < TOTAL_CELLS))).sort((a, b) => a - b)
    : null;
  return { at: Math.floor(at), model, promptVersion, cells };
}

/** 판을 읽은 뒤 AI 기록 정리: 비어 있는 칸은 AI 글이 아니에요. cells 가 없던 기록은 글이 있는 세부 목표·실천 칸 전부로 봐요(보수적으로) */
function settleAiDraft(board: Board, raw: ReturnType<typeof cleanAiDraft>): AiDraftMeta | null {
  if (!raw) return null;
  const all = Array.from({ length: TOTAL_CELLS - 1 }, (_, i) => i + 1);
  const cells = (raw.cells ?? all).filter((cell) => cellTextAt(board, cell).trim().length > 0);
  return cells.length > 0 ? { at: raw.at, model: raw.model, promptVersion: raw.promptVersion, cells } : null;
}

/**
 * 저장돼 있던 값을 검증해서 Board 로 만들어요. 모양이 다르면 null.
 * 예전 형식(`version`·`updatedAt` 만 있는 단일 판, 실천별 `done`)도 받아들이고 모르는 필드는 버려요.
 */
export function normalizeBoard(input: unknown, now: number = Date.now()): Board | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.subs)) return null;

  const board = createEmptyBoard(now);
  if (typeof raw.id === 'string' && BOARD_ID_RE.test(raw.id)) board.id = raw.id;
  board.goal = cleanText(raw.goal);
  board.templateId = typeof raw.templateId === 'string' && raw.templateId ? raw.templateId : null;
  const aiDraft = cleanAiDraft(raw.aiDraft);
  board.createdAt = cleanTime(raw.createdAt, now);
  board.updatedAt = cleanTime(raw.updatedAt, board.createdAt);

  raw.subs.slice(0, SUB_COUNT).forEach((item, i) => {
    if (!item || typeof item !== 'object') return;
    const sub = item as Record<string, unknown>;
    const actions = Array.isArray(sub.actions) ? sub.actions : [];
    board.subs[i].title = cleanText(sub.title);
    for (let a = 0; a < ACTION_COUNT; a++) board.subs[i].actions[a] = cleanText(actions[a]);
  });
  board.aiDraft = settleAiDraft(board, aiDraft);
  return board;
}

export interface Progress {
  /** 글이 적힌 칸 수 (최대 73) */
  filled: number;
  totalCells: number;
  /** 글이 적힌 실천 수 (최대 64) */
  actionsFilled: number;
  totalActions: number;
}

export function getProgress(board: Board): Progress {
  let filled = board.goal.trim() ? 1 : 0;
  let actionsFilled = 0;
  for (const sub of board.subs) {
    if (sub.title.trim()) filled += 1;
    for (const action of sub.actions) {
      if (!action.trim()) continue;
      filled += 1;
      actionsFilled += 1;
    }
  }
  return { filled, totalCells: TOTAL_CELLS, actionsFilled, totalActions: TOTAL_ACTIONS };
}

/** 공유용 텍스트. 비어 있는 세부 목표는 건너뛰고, 오늘 체크한 실천에는 [오늘] 을 붙여요. */
export function boardToText(board: Board, checkedToday: ReadonlySet<number> = new Set()): string {
  const lines: string[] = [`[핵심 목표] ${board.goal.trim() || '아직 정하지 않았어요'}`];
  board.subs.forEach((sub, i) => {
    const actions = sub.actions
      .map((action, j) => {
        const text = action.trim();
        if (!text) return null;
        return `${checkedToday.has(actionIndex(i, j)) ? '- [오늘] ' : '- '}${text}`;
      })
      .filter((line): line is string => line !== null);
    if (!sub.title.trim() && actions.length === 0) return;
    lines.push('', `${i + 1}. ${sub.title.trim() || `세부 목표 ${i + 1}`}`, ...actions);
  });
  // AI 가 쓴 글이 들어간 판은 밖으로 보내는 글에도 표시해요(서비스 오픈 정책 2-4)
  if (hasAiText(board)) lines.push('', '(AI 초안 포함)');
  return lines.join('\n');
}
