import { useCallback, useEffect, useRef, useState } from 'react';

import { clampText, createEmptyBoard, type Board } from '../lib/mandalart';
import { clearBoard, loadBoard, saveBoard } from '../lib/storage';

const SAVE_DELAY_MS = 400;

/**
 * 보드 상태 하나를 앱 전체가 공유해요. 바뀔 때마다 400ms 뒤에 저장하고,
 * 화면이 가려지거나(visibilitychange) 페이지가 닫힐 때는 바로 저장해요.
 */
export function useBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const boardRef = useRef<Board | null>(null);
  const pendingRef = useRef<Board | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    void loadBoard().then((loaded) => {
      if (!alive) return;
      boardRef.current = loaded;
      setBoard(loaded);
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
    if (pending) {
      pendingRef.current = null;
      void saveBoard(pending);
    }
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

  const update = useCallback(
    (updater: (prev: Board) => Board) => {
      const prev = boardRef.current;
      if (!prev) return;
      const next: Board = { ...updater(prev), updatedAt: Date.now() };
      boardRef.current = next;
      pendingRef.current = next;
      setBoard(next);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  const setGoal = useCallback(
    (goal: string) => update((prev) => ({ ...prev, goal: clampText(goal) })),
    [update],
  );

  const setSubTitle = useCallback(
    (subIndex: number, title: string) =>
      update((prev) => ({
        ...prev,
        subs: prev.subs.map((sub, i) => (i === subIndex ? { ...sub, title: clampText(title) } : sub)),
      })),
    [update],
  );

  const setAction = useCallback(
    (subIndex: number, actionIndex: number, text: string) =>
      update((prev) => ({
        ...prev,
        subs: prev.subs.map((sub, i) => {
          if (i !== subIndex) return sub;
          const actions = sub.actions.map((a, j) => (j === actionIndex ? clampText(text) : a));
          // 글을 지우면 완료 표시도 함께 지워요.
          const done = sub.done.map((d, j) => (j === actionIndex && !text.trim() ? false : d));
          return { ...sub, actions, done };
        }),
      })),
    [update],
  );

  const toggleDone = useCallback(
    (subIndex: number, actionIndex: number) =>
      update((prev) => ({
        ...prev,
        subs: prev.subs.map((sub, i) =>
          i === subIndex
            ? { ...sub, done: sub.done.map((d, j) => (j === actionIndex ? !d : d)) }
            : sub,
        ),
      })),
    [update],
  );

  const reset = useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
    const empty = createEmptyBoard();
    boardRef.current = empty;
    setBoard(empty);
    await clearBoard();
  }, []);

  return { board, setGoal, setSubTitle, setAction, toggleDone, reset };
}
