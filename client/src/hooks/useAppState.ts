import { useCallback, useEffect, useRef, useState } from 'react';

import type { ContentTemplate } from '../content';
import { clampText, createEmptyBoard, type Board } from '../lib/mandalart';
import { boardFromTemplate } from '../lib/template';
import { createEmptyBoards, type AppState, type BoardsState, type CheckinsState, type SettingsState } from '../lib/state';
import { clearAll, loadState, saveBoards, saveCheckins, saveSettings } from '../lib/storage';

const SAVE_DELAY_MS = 400;

type Part = keyof AppState;
const savers: { [K in Part]: (value: AppState[K]) => Promise<void> } = {
  boards: saveBoards,
  checkins: saveCheckins,
  settings: saveSettings,
};

/**
 * 앱 상태(판·체크인·설정) 하나를 앱 전체가 공유해요. 바뀐 부분만 400ms 뒤에 저장하고,
 * 화면이 가려지거나(visibilitychange) 페이지가 닫힐 때는 바로 저장해요.
 */
export function useAppState() {
  const [state, setState] = useState<AppState | null>(null);
  const stateRef = useRef<AppState | null>(null);
  const pendingRef = useRef<Partial<AppState>>({});
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    void loadState().then((loaded) => {
      if (!alive) return;
      stateRef.current = loaded;
      setState(loaded);
    });
    return () => {
      alive = false;
    };
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = {};
    (Object.keys(pending) as Part[]).forEach((part) => {
      const value = pending[part];
      if (value) void (savers[part] as (v: AppState[Part]) => Promise<void>)(value);
    });
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  const patch = useCallback(
    (part: Part, value: BoardsState | CheckinsState | SettingsState) => {
      const prev = stateRef.current;
      if (!prev) return;
      const next = { ...prev, [part]: value } as AppState;
      stateRef.current = next;
      (pendingRef.current as Record<Part, unknown>)[part] = value;
      setState(next);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  /** 지금 보고 있는 판을 바꿔요. updatedAt 은 자동. */
  const updateBoard = useCallback(
    (updater: (board: Board) => Board) => {
      const prev = stateRef.current;
      if (!prev) return;
      const { active, boards } = prev.boards;
      const nextBoard: Board = { ...updater(boards[active]), updatedAt: Date.now() };
      patch('boards', { ...prev.boards, boards: boards.map((b, i) => (i === active ? nextBoard : b)) });
    },
    [patch],
  );

  const setGoal = useCallback((goal: string) => updateBoard((b) => ({ ...b, goal: clampText(goal) })), [updateBoard]);

  const setSubTitle = useCallback(
    (subIndex: number, title: string) =>
      updateBoard((b) => ({
        ...b,
        subs: b.subs.map((sub, i) => (i === subIndex ? { ...sub, title: clampText(title) } : sub)),
      })),
    [updateBoard],
  );

  const setAction = useCallback(
    (subIndex: number, actionIndex: number, text: string) =>
      updateBoard((b) => ({
        ...b,
        subs: b.subs.map((sub, i) =>
          i === subIndex ? { ...sub, actions: sub.actions.map((a, j) => (j === actionIndex ? clampText(text) : a)) } : sub,
        ),
      })),
    [updateBoard],
  );

  const updateSettings = useCallback(
    (updater: (settings: SettingsState) => SettingsState) => {
      const prev = stateRef.current;
      if (!prev) return;
      patch('settings', updater(prev.settings));
    },
    [patch],
  );

  const updateCheckins = useCallback(
    (updater: (checkins: CheckinsState) => CheckinsState) => {
      const prev = stateRef.current;
      if (!prev) return;
      patch('checkins', updater(prev.checkins));
    },
    [patch],
  );

  /** 지금 보고 있는 판을 예시 템플릿 글로 채우고, 그 판의 체크 기록은 지워요(실천이 모두 바뀌니까). */
  const applyTemplate = useCallback(
    (template: ContentTemplate) => {
      const prev = stateRef.current;
      if (!prev) return;
      const { active, boards } = prev.boards;
      const now = Date.now();
      const nextBoard = boardFromTemplate(boards[active], template, now);
      patch('boards', { ...prev.boards, boards: boards.map((b, i) => (i === active ? nextBoard : b)) });
      const byBoard = { ...stateRef.current!.checkins.byBoard };
      delete byBoard[nextBoard.id];
      patch('checkins', { version: 1, byBoard });
    },
    [patch],
  );

  /** 판과 체크인 기록을 지우고 빈 판 하나로 돌아가요. 설정(잠금 해제·알림 상태)은 남겨요. */
  const reset = useCallback(async () => {
    const prev = stateRef.current;
    if (!prev) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = {};
    const next: AppState = { ...prev, boards: createEmptyBoards(), checkins: { version: 1, byBoard: {} } };
    stateRef.current = next;
    setState(next);
    await clearAll();
    await saveBoards(next.boards);
  }, []);

  const board = state ? state.boards.boards[state.boards.active] : null;

  return { state, board, setGoal, setSubTitle, setAction, applyTemplate, updateSettings, updateCheckins, reset, createEmptyBoard };
}
