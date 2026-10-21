import { CTAButton, ConfirmDialog, FixedBottomCTA, useDialog, useWebToast } from '@toss/tds-mobile';
import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type PointerEvent, type ReactNode } from 'react';

import type { Block } from '../components/Block';
import { logEvent } from '../lib/analytics';
import { haptic } from '../lib/bridge';
import { cascadeOf, clearBlockCells, swappable } from '../lib/cellEdit';
import { cellView } from '../lib/cells';
import { CENTER, type Board } from '../lib/mandalart';

/** 이만큼 누르고 있으면 편집 모드(아이폰 홈 화면처럼 칸이 흔들려요). 편집 모드에선 이만큼 꾹 누르면 그 칸을 들어요(자리 바꾸기) */
export const LONG_PRESS_MS = 450;
/** 손가락이 이만큼 움직이면 누르기가 아니라 끌기·스크롤(기록 위젯 판 hooks/useWidgetEdit 도 같은 값) */
export const MOVE_SLOP_PX = 10;
/** 길게 누르기·끌기 뒤 손을 떼고 이 안에 오는 click 은 그 손가락의 것이라 건너뛰어요 */
export const SKIP_CLICK_MS = 600;
/** 든 칸을 놓을 때 두 칸이 제자리로 미끄러져 들어가는 시간 */
export const SETTLE_MS = 220;

/** 분석 이벤트 edit_mode_enter 의 via */
export type EditVia = 'longpress' | 'button' | 'link';

/** 꾹 눌러 든 칸(자리 바꾸기): 손가락을 따라 움직인 만큼(dx·dy)과 지금 손가락 아래의 놓을 칸 */
export interface LiftView {
  cell: number;
  dx: number;
  dy: number;
  over: number | null;
}

/** 확인 창 설명: 상위 목표를 따라 함께 지워지는 하위 칸 */
function cascadeNotice(goal: boolean, extra: { subs: number; actions: number }): string | undefined {
  const parts = [extra.subs > 0 ? `세부 목표 ${extra.subs}개` : '', extra.actions > 0 ? `실천 ${extra.actions}개` : ''].filter(Boolean);
  if (parts.length === 0) return undefined;
  return goal ? `핵심 목표를 지우면 ${parts.join('와 ')}도 함께 지워져요.` : `세부 목표를 지우면 그 아래 ${parts.join('와 ')}도 함께 지워져요.`;
}

interface Point {
  x: number;
  y: number;
}

/** 요소의 가운데(화면 좌표, transform 포함) */
function centerOf(el: HTMLElement): Point {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function reduceMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

type BlockModeProps = Pick<ComponentProps<typeof Block>, 'checked' | 'caption' | 'nextCell' | 'interactive' | 'selected' | 'lift'>;

interface UseGridEditOptions {
  board: Board;
  /** 지금 보이는 3×3 블록(0~8). 홈 = 가운데(4), 세부 목표 화면 = 그 둘레 블록 */
  block: number;
  /** 어느 화면의 편집 모드인지(분석 이벤트). trial = 1분 체험판 — 저장하지 않는 판이라 화면을 떠나면 '되돌리기' 토스트도 닫아요 */
  screen: 'home' | 'sub' | 'trial';
  /** 편집 모드에서 칸을 누르면(지울 칸을 고르는 중이 아닐 때) — 그 칸의 입력 시트를 열어요 */
  onEditCell: (cell: number) => void;
  /** 고른 칸(0~8)을 지우고 되돌리기 함수를 돌려줘요. 없으면 끌어서 고르기·삭제를 못 해요 */
  onDeleteCells?: (cells: number[]) => () => void;
  /** 두 칸(0~8, 가운데 제외)의 자리를 서로 바꿔요(3.0). 없으면 꾹 눌러 끌기·'자리 바꾸기'를 못 해요 */
  onSwapCells?: (a: number, b: number) => void;
  /** 처음부터 편집 모드(예전 편집 화면 링크 `block/:n`) */
  startEditing?: boolean;
}

/**
 * 3×3 제자리 편집 모드(2.1, 2026-10-21 사용자 결정 — 편집 버튼·편집 화면 없이 아이폰 홈 화면처럼).
 *  - 칸을 **길게 누르면** 편집 모드: 글이 있는 칸이 흔들리고('wiggle' 진동) 오른쪽 위 '완료'로 끝내요.
 *    옮길 수 있는 칸(글이 있고 가운데가 아닌 칸)이면 그 손가락 밑에 바로 들려요 — 떼지 않고 끌면 옮기고, 그냥 떼면 제자리예요
 *  - 편집 모드에서 **누르면** 그 칸 글 고치기(입력 시트), **바로 쭉 끌면** 지울 칸 고르기(고른 칸 = ✓ 가 스르륵 찍혀요),
 *    **꾹 누른 채 끌면** 그 칸을 들어 다른 칸 위에 놓아 자리 바꾸기(3.0, 사용자 2026-10-21 '아이폰 홈 화면처럼') — 가운데는 들 수도, 놓을 자리도 못 돼요.
 *    홈에서 세부 목표를 옮기면 그 아래 실천과 체크 기록도 함께 가요(App·lib/cellEdit `swapBlockCells`)
 *  - 끌어서 고르기·옮기기는 편집 모드에서만이에요. 평소에 끌면 아무 일도 없어요(끌다가 편집 모드로 넘어가지 않게 — 사용자 2026-10-21)
 *  - 고르는 중에는 누르면 고르기·빼기, 아래 '선택 해제' + 빨간 'n칸 삭제' → 확인 창 → 토스트 '되돌리기'.
 *    상위 목표를 지우면 그 아래도 전부 지워요(`clearBlockCells`) — 확인 창이 함께 지워지는 칸 수를 알려 줘요
 *  - 키보드·스크린리더는 포커스할 때만 보이는 '편집'·'지울 칸 고르기'·'자리 바꾸기'(첫 칸 → 바꿀 칸을 차례로 누르기) 입구로 같은 일을 해요
 * 편집 모드에 들어갈 때와 나올 때(완료·화면 이탈) 판이 바뀌었으면 board_edit 를 1회 보내요.
 */
export function useGridEdit({ board, block, screen, onEditCell, onDeleteCells, onSwapCells, startEditing = false }: UseGridEditOptions) {
  const { openConfirm } = useDialog();
  // useToast 와 같은 웹 토스트예요(Provider 에 toast 를 넘기지 않아서). 체험판 판은 화면과 함께 사라지니 그 판의 '되돌리기' 토스트도
  // 화면을 떠날 때 닫고(useToast 에는 닫기가 없어요), 내 판에선 화면을 옮겨도 되돌릴 수 있게 남겨 둬요
  const toast = useWebToast({ exitOnUnmount: screen === 'trial' });
  const [editing, setEditing] = useState(startEditing);
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set());
  /** 키보드로 '지울 칸 고르기'를 켰을 때: 아직 고른 칸이 없어도 누르면 고르기 */
  const [pickMode, setPickMode] = useState(false);
  /** 꾹 눌러 든 칸(손가락을 따라 그려요) */
  const [lift, setLift] = useState<LiftView | null>(null);
  /** 키보드 '자리 바꾸기': 켜져 있는지, 첫 칸을 골랐는지 */
  const [swapMode, setSwapMode] = useState(false);
  const [swapFirst, setSwapFirst] = useState<number | null>(null);
  /** 포인터 처리기는 다시 그리기 전에도 불릴 수 있어 편집 모드 여부를 ref 로도 들고 있어요 */
  const editingRef = useRef(startEditing);
  const gridRef = useRef<HTMLDivElement>(null);
  /** 누르고 있는 칸과 처음 위치, 길게 누르기 타이머 */
  const press = useRef<{ cell: number; x: number; y: number; timer: number | null } | null>(null);
  /** 끌어서 고르는 중: 처음 칸 기준 고르기/빼기, last = 마지막으로 지난 칸(새 칸에서만 진동) */
  const drag = useRef<{ select: boolean; last: number } | null>(null);
  /** 든 칸: 든 순간의 손가락 위치(x·y)에서 움직인 만큼(dx·dy)과 놓을 칸 */
  const liftRef = useRef<{ cell: number; x: number; y: number; dx: number; dy: number; over: number | null; pointerId: number } | null>(null);
  /** 놓은 뒤 두 칸이 제자리로 미끄러져 들어가게, 놓는 순간의 두 칸 가운데를 재 둬요(든 칸은 보이는 자리와 제자리 둘 다) */
  const settle = useRef<{ a: number; b: number; liftedA: Point; restA: Point; restB: Point } | null>(null);
  /** 이번 누르기에서 길게 누르기·끌기가 일어났는지 */
  const gestured = useRef(false);
  /** 이 시각 전까지 오는 click 은 길게 누르기·끌기를 한 손가락의 것(세부 목표로 가거나·체크하거나·입력창을 열지 않게) */
  const skipClickUntil = useRef(0);
  const latest = useRef({ board, block });
  latest.current = { board, block };
  /** 편집 모드에 들어갈 때 판의 updatedAt */
  const editStart = useRef<number | null>(null);

  const closeEditSession = () => {
    const start = editStart.current;
    editStart.current = null;
    if (start !== null && latest.current.board.updatedAt !== start) logEvent('board_edit', { block: latest.current.block });
  };

  useEffect(() => {
    if (startEditing) {
      editStart.current = latest.current.board.updatedAt;
      logEvent('edit_mode_enter', { screen, via: 'link' });
    }
    // 화면을 떠나면 길게 누르기 타이머를 지우고 편집 기록을 마감해요
    return () => {
      window.clearTimeout(press.current?.timer ?? undefined);
      closeEditSession();
    };
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 든 칸을 끌거나 지울 칸을 고르는 동안은 브라우저 스크롤을 막아요. 평소의 touch-action: pan-y 는 터치가 시작될 때 정해져
  // 길게 눌러 편집 모드가 된 뒤에는 바꿀 수 없어서, 이 손가락의 touchmove 를 직접 막아요(React 의 onTouchMove 는 passive 라 못 막아요)
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const guard = (event: TouchEvent) => {
      if (liftRef.current || drag.current) event.preventDefault();
    };
    el.addEventListener('touchmove', guard, { passive: false });
    return () => el.removeEventListener('touchmove', guard);
  }, []);

  const isFilled = (cell: number) => cellView(board, block, cell).text.trim().length > 0;
  /** 타이머·포인터 처리기용(닫힌 값이 아니라 지금 판으로) */
  const isFilledNow = (cell: number) => cellView(latest.current.board, latest.current.block, cell).text.trim().length > 0;
  const anyFilled = Array.from({ length: 9 }, (_, cell) => cell).some(isFilled);
  const canDelete = Boolean(onDeleteCells);
  /** 옮길 수 있는 칸: 글이 있고 가운데가 아닌 칸(홈 = 세부 목표, 세부 목표 화면 = 실천) */
  const movable = (cell: number) => cell !== CENTER && Boolean(onSwapCells) && isFilledNow(cell);
  const canSwap = Boolean(onSwapCells) && Array.from({ length: 9 }, (_, cell) => cell).some((cell) => cell !== CENTER && isFilled(cell));
  const picking = editing && (pickMode || selected.size > 0);
  const pickingRef = useRef(false);
  pickingRef.current = picking;

  // 칸이 비면(지우기·되돌리기·판 바꾸기 뒤) 고른 목록에서도 빼요
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((cell) => cellView(board, block, cell).text.trim().length > 0));
      return next.size === prev.size ? prev : next;
    });
  }, [board, block]);

  // 놓은 자리에서 두 칸이 제자리로: 든 칸은 손가락 자리에서 새 칸으로, 상대 칸은 제 자리에서 든 칸이 있던 자리로(바뀐 글로 그린 뒤 한 번만)
  useLayoutEffect(() => {
    const s = settle.current;
    if (!s) return;
    settle.current = null;
    const grid = gridRef.current;
    const elA = grid?.querySelector<HTMLElement>(`[data-cell="${s.b}"]`);
    const elB = grid?.querySelector<HTMLElement>(`[data-cell="${s.a}"]`);
    if (!elA || !elB || typeof elA.animate !== 'function' || reduceMotion()) return;
    const options = { duration: SETTLE_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' };
    elA.animate([{ transform: `translate(${s.liftedA.x - s.restB.x}px, ${s.liftedA.y - s.restB.y}px) scale(1.06)` }, { transform: 'none' }], options);
    elB.animate([{ transform: `translate(${s.restB.x - s.restA.x}px, ${s.restB.y - s.restA.y}px)` }, { transform: 'none' }], options);
  });

  const setCell = (cell: number, on: boolean) =>
    setSelected((prev) => {
      if (prev.has(cell) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(cell);
      else next.delete(cell);
      return next;
    });

  /** 손가락 아래의 칸(이 3×3 안의 `data-cell`). 든 칸은 pointer-events 가 꺼져 있어 그 밑의 칸이 잡혀요 */
  const cellAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint?.(x, y)?.closest<HTMLElement>('[data-cell]');
    if (!el || !gridRef.current?.contains(el)) return null;
    const cell = Number(el.dataset.cell);
    return Number.isInteger(cell) ? cell : null;
  };

  const cancelPress = () => {
    if (press.current?.timer) window.clearTimeout(press.current.timer);
    press.current = null;
  };

  const enter = (via: EditVia) => {
    if (editingRef.current) return;
    editingRef.current = true;
    editStart.current = latest.current.board.updatedAt;
    setEditing(true);
    void haptic('wiggle');
    logEvent('edit_mode_enter', { screen, via });
  };

  const releaseLift = () => {
    const l = liftRef.current;
    if (!l) return null;
    liftRef.current = null;
    try {
      gridRef.current?.releasePointerCapture?.(l.pointerId);
    } catch {
      /* jsdom 등 */
    }
    setLift(null);
    return l;
  };

  const exit = () => {
    cancelPress();
    drag.current = null;
    releaseLift();
    editingRef.current = false;
    setEditing(false);
    setPickMode(false);
    setSelected(new Set());
    setSwapMode(false);
    setSwapFirst(null);
    closeEditSession();
  };

  /** 끌어서 고르기 시작: 처음 칸을 고르거나(안 골라져 있으면) 빼요 */
  const startDrag = (cell: number) => {
    const select = !selected.has(cell);
    drag.current = { select, last: cell };
    setCell(cell, select);
    void haptic('tickWeak');
  };

  /** 꾹 누른 칸을 들어요: 손가락을 따라오고, 3×3 밖으로 나가도 놓을 때까지 따라가게 포인터를 잡아요 */
  const startLift = (cell: number, x: number, y: number, pointerId: number, buzz: boolean) => {
    liftRef.current = { cell, x, y, dx: 0, dy: 0, over: null, pointerId };
    setLift({ cell, dx: 0, dy: 0, over: null });
    try {
      gridRef.current?.setPointerCapture?.(pointerId);
    } catch {
      /* jsdom 등 */
    }
    if (buzz) void haptic('softMedium');
  };

  const moveLift = (x: number, y: number) => {
    const l = liftRef.current;
    if (!l) return;
    l.dx = x - l.x;
    l.dy = y - l.y;
    const under = cellAt(x, y);
    const over = under !== null && swappable(l.cell, under) ? under : null;
    if (over !== l.over) {
      l.over = over;
      if (over !== null) void haptic('tickWeak');
    }
    setLift({ cell: l.cell, dx: l.dx, dy: l.dy, over });
  };

  /** 두 칸의 자리를 바꿔요(끌어서 놓기·키보드). 놓는 순간의 자리를 재 둬 바뀐 뒤 미끄러져 들어가게 */
  const swap = (a: number, b: number, lifted: boolean) => {
    if (!onSwapCells || !swappable(a, b)) return;
    const grid = gridRef.current;
    const elA = grid?.querySelector<HTMLElement>(`[data-cell="${a}"]`);
    const elB = grid?.querySelector<HTMLElement>(`[data-cell="${b}"]`);
    if (elA && elB) {
      const liftedA = centerOf(elA);
      const l = liftRef.current;
      const dx = lifted && l ? l.dx : 0;
      const dy = lifted && l ? l.dy : 0;
      // 든 칸의 제자리 = 지금 보이는 자리에서 손가락을 따라 움직인 만큼 되돌린 자리
      settle.current = { a, b, liftedA, restA: { x: liftedA.x - dx, y: liftedA.y - dy }, restB: centerOf(elB) };
    }
    onSwapCells(a, b);
    void haptic('tap');
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    gestured.current = false;
    skipClickUntil.current = 0;
    const cell = cellAt(event.clientX, event.clientY);
    if (cell === null) return;
    cancelPress();
    const { clientX: x, clientY: y, pointerId } = event;
    // 평소: 길게 누르면 편집 모드(옮길 수 있는 칸이면 바로 들려요). 편집 모드: 꾹 누르면 그 칸을 들어요(지울 칸을 고르는 중엔 아니에요)
    const timer = window.setTimeout(() => {
      // 길게 누른 뒤의 움직임은 고르기가 아니라 옮기기예요(들지 못한 칸이면 아무 일도 없고, 떼면 평소처럼 click)
      press.current = null;
      const fresh = !editingRef.current;
      const liftable = !pickingRef.current && movable(cell);
      if (!fresh && !liftable) return;
      gestured.current = true;
      if (fresh) enter('longpress');
      if (liftable) startLift(cell, x, y, pointerId, !fresh);
    }, LONG_PRESS_MS);
    press.current = { cell, x, y, timer };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (liftRef.current) {
      moveLift(event.clientX, event.clientY);
      return;
    }
    const pending = press.current;
    if (pending && !drag.current) {
      const dx = event.clientX - pending.x;
      const dy = event.clientY - pending.y;
      if (Math.hypot(dx, dy) < MOVE_SLOP_PX) return;
      cancelPress();
      // 움직였으면 누르기가 아니에요(손을 뗀 뒤 click 으로 체크하거나 입력창을 열지 않게)
      gestured.current = true;
      // 꾹 누르기 전에 바로 끌면 지울 칸 고르기 — 편집 모드에서만. 평소엔 그냥 놓아줘요(스크롤)
      if (!editingRef.current || !canDelete || !isFilled(pending.cell)) return;
      startDrag(pending.cell);
    }
    if (!drag.current) return;
    const cell = cellAt(event.clientX, event.clientY);
    if (cell === null || cell === drag.current.last || !isFilled(cell)) return;
    drag.current.last = cell;
    setCell(cell, drag.current.select);
    void haptic('tickWeak');
  };

  /** 손을 뗐을 때(commit). 브라우저가 가로채 취소됐을 때(pointercancel)는 바꾸지 않고 제자리로 */
  const endPointer = (commit: boolean) => {
    cancelPress();
    const l = liftRef.current;
    if (l) {
      // 다른 칸 위에서 놓으면 자리를 바꾸고, 아니면 제자리로
      if (commit && l.over !== null) swap(l.cell, l.over, true);
      releaseLift();
    }
    drag.current = null;
    if (gestured.current) {
      gestured.current = false;
      skipClickUntil.current = Date.now() + SKIP_CLICK_MS;
    }
  };

  /**
   * 칸 click 을 먼저 받아요. true = 여기서 처리했어요(건너뛰기·고치기·고르기·자리 바꾸기), false = 화면의 평소 동작(세부 목표로·체크·빈 칸 적기).
   */
  const handleTap = (cell: number): boolean => {
    if (Date.now() < skipClickUntil.current) {
      skipClickUntil.current = 0;
      return true;
    }
    if (!editing) return false;
    if (swapMode) {
      // 키보드 '자리 바꾸기': 첫 칸(옮길 수 있는 칸) → 바꿀 칸. 첫 칸을 다시 누르면 취소
      if (swapFirst === null) {
        if (movable(cell)) {
          setSwapFirst(cell);
          void haptic('tickWeak');
        }
        return true;
      }
      if (cell === swapFirst) {
        setSwapFirst(null);
        return true;
      }
      if (!swappable(swapFirst, cell)) return true;
      swap(swapFirst, cell, false);
      setSwapMode(false);
      setSwapFirst(null);
      return true;
    }
    if (picking) {
      if (isFilled(cell)) setCell(cell, !selected.has(cell));
      return true;
    }
    onEditCell(cell);
    return true;
  };

  const clearSelection = () => {
    setPickMode(false);
    setSelected(new Set());
  };

  const startPicking = () => {
    setPickMode(true);
    // 키보드로 들어왔으니 첫 칸으로 포커스를 옮겨 바로 고를 수 있게
    window.setTimeout(() => gridRef.current?.querySelector<HTMLElement>('button[data-filled]')?.focus(), 0);
  };

  const startSwapping = () => {
    setSwapMode(true);
    setSwapFirst(null);
    window.setTimeout(() => gridRef.current?.querySelector<HTMLElement>(`button[data-filled]:not([data-cell="${CENTER}"])`)?.focus(), 0);
  };

  const confirmDelete = async () => {
    const cells = [...selected].sort((a, b) => a - b);
    if (cells.length === 0 || !onDeleteCells) return;
    // 상위 목표를 지우면 그 아래도 전부 지워져요: 칸 수는 함께 지워지는 칸까지 세고, 무엇이 함께 지워지는지 알려 줘요
    const total = clearBlockCells(board, block, cells).cleared;
    const ok = await openConfirm({
      title: `${total}칸을 삭제할까요?`,
      description: cascadeNotice(block === CENTER && cells.includes(CENTER), cascadeOf(board, block, cells)),
      confirmButton: <ConfirmDialog.ConfirmButton color="danger">삭제</ConfirmDialog.ConfirmButton>,
      cancelButton: '닫기',
    });
    if (!ok) return;
    const undo = onDeleteCells(cells);
    clearSelection();
    toast.openToast(`${total}칸을 삭제했어요`, {
      button: {
        text: '되돌리기',
        onClick: () => {
          undo();
          toast.openToast('되돌렸어요');
        },
      },
    });
  };

  /** 3×3 을 감싸는 div 에 그대로 넘겨요 */
  const gridProps = {
    ref: gridRef,
    className: editing ? 'mg-press-area mg-edit-area mg-jiggle' : 'mg-press-area',
    onPointerDown,
    onPointerMove,
    onPointerUp: () => endPointer(true),
    onPointerCancel: () => endPointer(false),
    // 안드로이드는 길게 누르면 메뉴가 떠요 → 칸 위에서는 막아요
    onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
  };

  /** 그릴 든 칸: 손가락으로 든 칸, 아니면 키보드 '자리 바꾸기'의 첫 칸(제자리에서 든 모양) */
  const liftView: LiftView | null = lift ?? (swapFirst !== null ? { cell: swapFirst, dx: 0, dy: 0, over: null } : null);

  /**
   * Block 에 넘길 값. 평소엔 화면의 값 그대로, 편집 모드에선 오늘 체크·칸 아래 글·다음 칸 안내를 빼요(✓ 는 '고른 칸'만 뜻하게).
   * 편집 모드에선 모든 칸을 누를 수 있고(고치기), 고르는 중엔 글이 있는 칸만 눌러요. 든 칸과 놓을 칸은 lift 로 그려요.
   */
  const blockProps = (normal: Omit<BlockModeProps, 'selected' | 'lift'>): BlockModeProps =>
    editing
      ? { nextCell: null, interactive: picking ? (cell) => isFilled(cell) : () => true, selected: picking ? selected : undefined, lift: liftView }
      : normal;

  /** 3×3 아래 한 줄 안내 — 편집 모드에서만(평소 '칸을 길게 누르면…'은 사용자 2026-10-21 결정으로 뺐어요, 길게 누르기는 1분 체험판에서 익혀요). 모드가 바뀌면 스크린리더가 읽어요 */
  const hint: string | null = lift
    ? block === CENTER
      ? '다른 세부 목표 위에 놓으면 자리를 바꿔요. 실천도 함께 가요'
      : '다른 칸 위에 놓으면 자리를 바꿔요'
    : swapMode
      ? swapFirst === null
        ? '자리를 바꿀 첫 칸을 누르세요'
        : '바꿀 칸을 누르세요. 첫 칸을 다시 누르면 취소예요'
      : picking
        ? '지울 칸을 누르거나 쭉 끌어서 골라요'
        : editing
          ? canDelete && anyFilled
            ? canSwap
              ? '칸을 누르면 고치고, 쭉 끌면 지울 칸을 골라요. 꾹 눌러 끌면 자리를 바꿔요'
              : '칸을 누르면 고치고, 쭉 끌면 지울 칸을 골라요'
            : canSwap
              ? '칸을 누르면 고치고, 꾹 눌러 끌면 자리를 바꿔요'
              : '칸을 누르면 글을 적어요'
          : null;

  const bottomBar: ReactNode = picking ? (
    <FixedBottomCTA.Double
      leftButton={
        <CTAButton color="dark" variant="weak" onClick={clearSelection}>
          선택 해제
        </CTAButton>
      }
      rightButton={
        <CTAButton color="danger" disabled={selected.size === 0} onClick={() => void confirmDelete()}>
          {selected.size > 0 ? `${selected.size}칸 삭제` : '삭제'}
        </CTAButton>
      }
    />
  ) : null;

  // 길게 누르기·끌기를 못 하는 키보드·스크린리더용 입구. 포커스할 때만 보여요(같은 버튼이라 눌러도 포커스가 남아요)
  const revealButton: ReactNode = !editing ? (
    <button type="button" className="mg-reveal-on-focus" onClick={() => enter('button')}>
      편집
    </button>
  ) : picking || swapMode ? null : (
    <>
      {canDelete && anyFilled && (
        <button type="button" className="mg-reveal-on-focus" onClick={startPicking}>
          지울 칸 고르기
        </button>
      )}
      {canSwap && (
        <button type="button" className="mg-reveal-on-focus" onClick={startSwapping}>
          자리 바꾸기
        </button>
      )}
    </>
  );

  return { editing, picking, selected, lift: liftView, exit, gridProps, blockProps, handleTap, hint, bottomBar, revealButton };
}
