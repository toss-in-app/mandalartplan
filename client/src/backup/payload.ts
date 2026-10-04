import { getProgress } from '../lib/mandalart';
import { normalizeBoards, normalizeCheckins, type AppState, type BoardsState, type CheckinsState } from '../lib/state';

/** 서버에 두는 백업 본 (contract/backup.schema.json). 알림 상태·개인정보는 넣지 않아요. */
export interface BackupPayload {
  version: 1;
  exportedAt: number;
  boards: BoardsState;
  checkins: CheckinsState;
  unlocks: { extraBoard: boolean };
}

export function buildPayload(state: AppState, now: number = Date.now()): BackupPayload {
  return {
    version: 1,
    exportedAt: now,
    boards: state.boards,
    checkins: state.checkins,
    unlocks: { extraBoard: state.settings.unlocks.extraBoard },
  };
}

export function normalizePayload(input: unknown, now: number = Date.now()): BackupPayload | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  if (raw.version !== 1) return null;
  const boards = normalizeBoards(raw.boards, now);
  const checkins = normalizeCheckins(raw.checkins);
  if (!boards || !checkins) return null;
  const unlocks = raw.unlocks && typeof raw.unlocks === 'object' ? (raw.unlocks as Record<string, unknown>) : {};
  return {
    version: 1,
    exportedAt: typeof raw.exportedAt === 'number' && raw.exportedAt >= 0 ? Math.floor(raw.exportedAt) : 0,
    boards,
    checkins,
    unlocks: { extraBoard: unlocks.extraBoard === true },
  };
}

/** 복원 전 안내용: 보고 있는 판에 글이 적힌 칸 수 */
export function cellsFilled(boards: BoardsState): number {
  return getProgress(boards.boards[boards.active]).filled;
}
