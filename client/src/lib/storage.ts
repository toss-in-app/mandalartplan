import { Storage } from '@apps-in-toss/web-framework';

import { withTimeout } from './async';
import { normalizeBoard } from './mandalart';
import {
  KEYS,
  createDefaultSettings,
  createEmptyBoards,
  createEmptyCheckins,
  normalizeBoards,
  normalizeCheckins,
  normalizeSettings,
  type AppState,
  type BoardsState,
  type CheckinsState,
  type SettingsState,
} from './state';

const BRIDGE_TIMEOUT_MS = 1500;

/*
 * 저장 순서
 *  1. 앱인토스 Storage 브릿지 — 토스앱 안에서는 네이티브 저장소, `npm run dev` 에서는
 *     AIT Devtools 가 localStorage(`__ait_storage:` 접두어)로 모킹해요.
 *  2. 브릿지가 없거나(일반 브라우저) 응답이 없으면 브라우저 localStorage 로 대체해요.
 */

function localGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function localSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 저장 공간 부족·비공개 모드 등은 무시해요 */
  }
}

function localRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* 무시 */
  }
}

export async function readItem(key: string): Promise<string | null> {
  try {
    return await withTimeout(Storage.getItem(key), BRIDGE_TIMEOUT_MS);
  } catch {
    return localGet(key);
  }
}

export async function writeItem(key: string, value: string): Promise<void> {
  localSet(key, value);
  try {
    await withTimeout(Storage.setItem(key, value), BRIDGE_TIMEOUT_MS);
  } catch {
    /* 브릿지가 없어도 localStorage 에는 남아 있어요 */
  }
}

export async function removeItem(key: string): Promise<void> {
  localRemove(key);
  try {
    await withTimeout(Storage.removeItem(key), BRIDGE_TIMEOUT_MS);
  } catch {
    /* 무시 */
  }
}

function parse(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** 세 키를 읽고, 선행 프로토타입의 단일 판(`mandalart.board.v1`)이 있으면 boards 로 옮겨요. */
export async function loadState(now: number = Date.now()): Promise<AppState> {
  const [boardsRaw, checkinsRaw, settingsRaw] = await Promise.all([
    readItem(KEYS.boards),
    readItem(KEYS.checkins),
    readItem(KEYS.settings),
  ]);

  let boards = normalizeBoards(parse(boardsRaw), now);
  if (!boards) {
    const legacy = normalizeBoard(parse(await readItem(KEYS.legacyBoard)), now);
    boards = legacy ? { version: 1, active: 0, boards: [legacy] } : createEmptyBoards(now);
    if (legacy) {
      await writeItem(KEYS.boards, JSON.stringify(boards));
      await removeItem(KEYS.legacyBoard);
    }
  }

  return {
    boards,
    checkins: normalizeCheckins(parse(checkinsRaw)) ?? createEmptyCheckins(),
    settings: normalizeSettings(parse(settingsRaw)) ?? createDefaultSettings(),
  };
}

export const saveBoards = (boards: BoardsState) => writeItem(KEYS.boards, JSON.stringify(boards));
export const saveCheckins = (checkins: CheckinsState) => writeItem(KEYS.checkins, JSON.stringify(checkins));
export const saveSettings = (settings: SettingsState) => writeItem(KEYS.settings, JSON.stringify(settings));

export async function clearAll(): Promise<void> {
  await Promise.all([removeItem(KEYS.boards), removeItem(KEYS.checkins), removeItem(KEYS.legacyBoard)]);
}
