import { Storage } from '@apps-in-toss/web-framework';

import { withTimeout } from './async';
import { createEmptyBoard, parseBoard, type Board } from './mandalart';

export const BOARD_KEY = 'mandalart.board.v1';
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

export async function loadBoard(): Promise<Board> {
  return parseBoard(await readItem(BOARD_KEY)) ?? createEmptyBoard();
}

export async function saveBoard(board: Board): Promise<void> {
  await writeItem(BOARD_KEY, JSON.stringify(board));
}

export async function clearBoard(): Promise<void> {
  await removeItem(BOARD_KEY);
}
