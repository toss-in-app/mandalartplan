/**
 * AI 초안 규칙 (설계 plans/2.0-ai-draft-design.md, 계약 contract/ai-draft.api.md).
 * 광고 1회 = AI 1회, 사람(기기)당 하루 10회, 빈 칸만 채우고 사용자가 적은 칸은 건드리지 않아요.
 */
import { ACTION_COUNT, AI_CELL, clampText, type AiDraftMeta, type Board } from '../lib/mandalart';
import type { AiSettings } from '../lib/state';

/** 하루 AI 실행 상한 (2026-10-20 사용자 결정) */
export const AI_DAILY_RUNS = 10;

export function runsLeft(ai: AiSettings, today: string): number {
  const used = ai.runs.date === today ? ai.runs.count : 0;
  return Math.max(0, AI_DAILY_RUNS - used);
}

/** AI 가 결과를 돌려줬을 때만 하루 횟수에 넣어요(실패·거절은 넣지 않음) */
export function recordRun(ai: AiSettings, today: string): AiSettings {
  return { ...ai, runs: { date: today, count: ai.runs.date === today ? ai.runs.count + 1 : 1 } };
}

/** 서버로 보내는 칸 글·서버가 준 칸 글: 제어문자를 지우고 공백을 하나로, 40자까지 */
export function cleanCell(text: string): string {
  // eslint-disable-next-line no-control-regex
  return clampText(text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim());
}

export function emptySubCount(board: Board): number {
  return board.subs.filter((sub) => !sub.title.trim()).length;
}

export function emptyActionCount(board: Board, subIndex: number): number {
  return board.subs[subIndex].actions.filter((action) => !action.trim()).length;
}

/** 편집 화면 '빈 칸 AI로 채우기': 핵심 목표가 있고 빈 세부 목표가 있을 때 */
export function canFillSubs(board: Board): boolean {
  return board.goal.trim().length > 0 && emptySubCount(board) > 0;
}

/** 편집 화면 '실천 AI로 추천': 핵심 목표·이 세부 목표가 있고 빈 실천이 있을 때 */
export function canFillActions(board: Board, subIndex: number): boolean {
  return board.goal.trim().length > 0 && board.subs[subIndex].title.trim().length > 0 && emptyActionCount(board, subIndex) > 0;
}

/** 실천을 채울 세부 목표들: 제목이 있고 빈 실천이 있는 것 */
export function subsNeedingActions(board: Board): number[] {
  return board.subs.flatMap((sub, i) => (sub.title.trim() && sub.actions.some((action) => !action.trim()) ? [i] : []));
}

export interface MergeResult {
  board: Board;
  /** 이번에 새로 채운 칸 수 */
  filled: number;
  /** 이번에 AI 글로 채운 칸(AI_CELL 번호) — 'AI 초안' 기록에 더해요. 사용자가 입력한 핵심 목표는 넣지 않아요 */
  cells: number[];
}

/** AI 가 준 세부 목표 8개 가운데 판에서 비어 있는 칸만 채워요 */
export function mergeSubs(board: Board, subs: readonly string[]): MergeResult {
  const cells: number[] = [];
  const next = board.subs.map((sub, i) => {
    if (sub.title.trim()) return sub;
    const text = cleanCell(subs[i] ?? '');
    if (!text) return sub;
    cells.push(AI_CELL.sub(i));
    return { ...sub, title: text };
  });
  return { board: cells.length > 0 ? { ...board, subs: next } : board, filled: cells.length, cells };
}

/** 세부 목표 하나(subIndex)의 실천 8개 가운데 비어 있는 칸만 채워요 */
export function mergeActions(board: Board, subIndex: number, actions: readonly string[]): MergeResult {
  const sub = board.subs[subIndex];
  const cells: number[] = [];
  const nextActions = Array.from({ length: ACTION_COUNT }, (_, j) => {
    const current = sub.actions[j];
    if (current.trim()) return current;
    const text = cleanCell(actions[j] ?? '');
    if (!text) return current;
    cells.push(AI_CELL.action(subIndex, j));
    return text;
  });
  if (cells.length === 0) return { board, filled: 0, cells };
  return { board: { ...board, subs: board.subs.map((s, i) => (i === subIndex ? { ...s, actions: nextActions } : s)) }, filled: cells.length, cells };
}

/** 미리보기의 초안을 지금 판에 넣어요. 핵심 목표는 입력한 글로, 세부 목표·실천은 빈 칸만 */
export function mergeDraft(board: Board, goal: string, draft: Board): MergeResult {
  const cleanGoal = cleanCell(goal);
  let next: Board = cleanGoal && cleanGoal !== board.goal ? { ...board, goal: cleanGoal } : board;
  let filled = next.goal !== board.goal && !board.goal.trim() ? 1 : 0;
  const subs = mergeSubs(next, draft.subs.map((sub) => sub.title));
  next = subs.board;
  filled += subs.filled;
  const cells = [...subs.cells];
  draft.subs.forEach((sub, i) => {
    const actions = mergeActions(next, i, sub.actions);
    next = actions.board;
    filled += actions.filled;
    cells.push(...actions.cells);
  });
  return { board: next, filled, cells };
}

/** AI 결과를 넣은 판에 'AI 초안' 기록을 남겨요(시각은 마지막으로 넣은 때, 칸은 이전 기록과 합쳐요) */
export function markAiDraft(board: Board, meta: Pick<AiDraftMeta, 'model' | 'promptVersion'>, now: number, cells: readonly number[]): Board {
  if (cells.length === 0) return board;
  const merged = Array.from(new Set([...(board.aiDraft?.cells ?? []), ...cells])).sort((a, b) => a - b);
  return { ...board, aiDraft: { at: now, model: meta.model, promptVersion: meta.promptVersion, cells: merged } };
}
