/**
 * 기기 로컬 상태 (계약: contract/state.schema.json).
 * Storage 키 3개 — boards(판 1~2) · checkins(판별 날짜 → 실천 번호) · settings.
 */
import { TOTAL_ACTIONS, createEmptyBoard, normalizeBoard, type Board } from './mandalart';

export const KEYS = {
  boards: 'mandalart.boards.v1',
  checkins: 'mandalart.checkins.v1',
  settings: 'mandalart.settings.v1',
  /** 선행 프로토타입(2026-09-28)의 단일 판 키. 읽어서 boards 로 옮긴 뒤 지운다 */
  legacyBoard: 'mandalart.board.v1',
} as const;

export const MAX_BOARDS = 2;
/** 체크인 기록 보관 일수 */
export const MAX_CHECKIN_DAYS = 400;

export interface BoardsState {
  version: 1;
  active: number;
  boards: Board[];
}

export interface CheckinRecord {
  /** 'YYYY-MM-DD' → 그날 체크한 실천 번호(0~63). 빈 배열 = 완료했지만 0개 */
  days: Record<string, number[]>;
  lastCompletedAt: number | null;
}

export interface CheckinsState {
  version: 1;
  byBoard: Record<string, CheckinRecord>;
}

export type NotificationStatus = 'unknown' | 'agreed' | 'declined';

export interface BackupSettings {
  /** 설정에서 '백업 켜기' 를 누른 뒤 true. 끄면 서버 본도 지워요 */
  enabled: boolean;
  /** sha256('mandalartplan:' + 토스 익명 키) → 'k' + hex 64. 켤 때 한 번 계산 */
  key: string | null;
  lastBackupAt: number | null;
}

export interface SettingsState {
  version: 1;
  notification: NotificationStatus;
  unlocks: { extraBoard: boolean };
  seenContentVersion: number;
  firstCheckinAt: number | null;
  backup: BackupSettings;
}

const BACKUP_KEY_RE = /^k[0-9a-f]{64}$/;

export interface AppState {
  boards: BoardsState;
  checkins: CheckinsState;
  settings: SettingsState;
}

const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

export function createEmptyBoards(now: number = Date.now()): BoardsState {
  return { version: 1, active: 0, boards: [createEmptyBoard(now)] };
}

export function normalizeBoards(input: unknown, now: number = Date.now()): BoardsState | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  if (raw.version !== 1 || !Array.isArray(raw.boards)) return null;
  const boards = raw.boards
    .slice(0, MAX_BOARDS)
    .map((b) => normalizeBoard(b, now))
    .filter((b): b is Board => b !== null);
  if (boards.length === 0) return null;
  const active = typeof raw.active === 'number' && raw.active >= 0 && raw.active < boards.length ? Math.floor(raw.active) : 0;
  return { version: 1, active, boards };
}

export function createEmptyCheckins(): CheckinsState {
  return { version: 1, byBoard: {} };
}

export function normalizeCheckins(input: unknown): CheckinsState | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  if (raw.version !== 1 || !raw.byBoard || typeof raw.byBoard !== 'object') return null;
  const byBoard: Record<string, CheckinRecord> = {};
  for (const [boardId, rec] of Object.entries(raw.byBoard as Record<string, unknown>)) {
    if (!rec || typeof rec !== 'object') continue;
    const r = rec as Record<string, unknown>;
    const days: Record<string, number[]> = {};
    if (r.days && typeof r.days === 'object') {
      const entries = Object.entries(r.days as Record<string, unknown>)
        .filter(([date, list]) => DATE_RE.test(date) && Array.isArray(list))
        .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
        .slice(0, MAX_CHECKIN_DAYS);
      for (const [date, list] of entries) {
        const clean = Array.from(
          new Set((list as unknown[]).filter((n): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < TOTAL_ACTIONS)),
        ).sort((a, b) => a - b);
        days[date] = clean;
      }
    }
    const last = r.lastCompletedAt;
    byBoard[boardId] = { days, lastCompletedAt: typeof last === 'number' && last >= 0 ? Math.floor(last) : null };
  }
  return { version: 1, byBoard };
}

export function createDefaultSettings(): SettingsState {
  return {
    version: 1,
    notification: 'unknown',
    unlocks: { extraBoard: false },
    seenContentVersion: 0,
    firstCheckinAt: null,
    backup: { enabled: false, key: null, lastBackupAt: null },
  };
}

export function normalizeSettings(input: unknown): SettingsState | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  if (raw.version !== 1) return null;
  const s = createDefaultSettings();
  if (raw.notification === 'agreed' || raw.notification === 'declined') s.notification = raw.notification;
  const unlocks = raw.unlocks && typeof raw.unlocks === 'object' ? (raw.unlocks as Record<string, unknown>) : {};
  s.unlocks.extraBoard = unlocks.extraBoard === true;
  if (typeof raw.seenContentVersion === 'number' && raw.seenContentVersion >= 0) s.seenContentVersion = Math.floor(raw.seenContentVersion);
  if (typeof raw.firstCheckinAt === 'number' && raw.firstCheckinAt >= 0) s.firstCheckinAt = Math.floor(raw.firstCheckinAt);
  const backup = raw.backup && typeof raw.backup === 'object' ? (raw.backup as Record<string, unknown>) : {};
  const key = typeof backup.key === 'string' && BACKUP_KEY_RE.test(backup.key) ? backup.key : null;
  s.backup = {
    enabled: backup.enabled === true && key !== null,
    key,
    lastBackupAt: typeof backup.lastBackupAt === 'number' && backup.lastBackupAt >= 0 ? Math.floor(backup.lastBackupAt) : null,
  };
  return s;
}

/** 기기 시간 기준 'YYYY-MM-DD' */
export function dateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftDate(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return dateKey(date);
}

/** 오늘(또는 어제)부터 이어진 완료 일수. 오늘 아직 안 했으면 어제까지 센다. */
export function streak(record: CheckinRecord | undefined, today: string = dateKey()): number {
  if (!record) return 0;
  let cursor = today in record.days ? today : shiftDate(today, -1);
  let count = 0;
  while (cursor in record.days) {
    count += 1;
    cursor = shiftDate(cursor, -1);
  }
  return count;
}
