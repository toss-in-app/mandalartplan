import { CTAButton, ConfirmDialog, FixedBottomCTA, useDialog, useToast } from '@toss/tds-mobile';
import { useEffect, useRef, useState, type ComponentProps, type PointerEvent, type ReactNode } from 'react';

import type { Block } from '../components/Block';
import { logEvent } from '../lib/analytics';
import { haptic } from '../lib/bridge';
import { cellView } from '../lib/cells';
import { CENTER, ringIndex, type Board } from '../lib/mandalart';

/** 이만큼 누르고 있으면 편집 모드(아이폰 홈 화면처럼 칸이 흔들려요) */
export const LONG_PRESS_MS = 450;
/** 손가락이 이만큼 움직이면 누르기가 아니라 쓸기·스크롤 */
const MOVE_SLOP_PX = 10;
/** 길게 누르기·끌기 뒤 손을 떼고 이 안에 오는 click 은 그 손가락의 것이라 건너뛰어요 */
const SKIP_CLICK_MS = 600;

/** 분석 이벤트 edit_mode_enter 의 via */
export type EditVia = 'longpress' | 'swipe' | 'button' | 'link';

type BlockModeProps = Pick<ComponentProps<typeof Block>, 'checked' | 'caption' | 'nextCell' | 'interactive' | 'selected'>;

interface UseGridEditOptions {
  board: Board;
  /** 지금 보이는 3×3 블록(0~8). 홈 = 가운데(4), 세부 목표 화면 = 그 둘레 블록 */
  block: number;
  /** 분석 이벤트용: 어느 화면의 편집 모드인지 */
  screen: 'home' | 'sub';
  /** 편집 모드에서 칸을 누르면(지울 칸을 고르는 중이 아닐 때) — 그 칸의 입력 시트를 열어요 */
  onEditCell: (cell: number) => void;
  /** 고른 칸(0~8)을 지우고 되돌리기 함수를 돌려줘요. 없으면 끌어서 고르기·삭제를 못 해요 */
  onDeleteCells?: (cells: number[]) => () => void;
  /** 처음부터 편집 모드(예전 편집 화면 링크 `block/:n`) */
  startEditing?: boolean;
}

/**
 * 3×3 제자리 편집 모드(2.1, 2026-10-21 사용자 결정 — 편집 버튼·편집 화면 없이 아이폰 홈 화면처럼).
 *  - 칸을 **길게 누르면** 편집 모드: 글이 있는 칸이 흔들리고('wiggle' 진동) 오른쪽 위 '완료'로 끝내요
 *  - 편집 모드에서 **누르면** 그 칸 글 고치기(입력 시트), **쭉 끌면** 지울 칸 고르기(고른 칸 = '오늘 다 했어요' 모양 ✓).
 *    길게 누른 손가락을 떼지 않고 끌어도 골라요
 *  - 평소에도 글이 있는 칸을 **옆으로 쓸면** 바로 편집 모드 + 지울 칸 고르기. 위아래 움직임은 스크롤로 놓아줘요
 *  - 고르는 중에는 누르면 고르기·빼기, 아래 '선택 해제' + 빨간 'n칸 삭제' → 확인 창 → 토스트 '되돌리기'
 *  - 키보드·스크린리더는 포커스할 때만 보이는 '편집'·'지울 칸 고르기' 입구로 같은 일을 해요
 * 편집 모드에 들어갈 때와 나올 때(완료·화면 이탈) 판이 바뀌었으면 board_edit 를 1회 보내요.
 */
export function useGridEdit({ board, block, screen, onEditCell, onDeleteCells, startEditing = false }: UseGridEditOptions) {
  const { openConfirm } = useDialog();
  const toast = useToast();
  const [editing, setEditing] = useState(startEditing);
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set());
  /** 키보드로 '지울 칸 고르기'를 켰을 때: 아직 고른 칸이 없어도 누르면 고르기 */
  const [pickMode, setPickMode] = useState(false);
  /** 포인터 처리기는 다시 그리기 전에도 불릴 수 있어 편집 모드 여부를 ref 로도 들고 있어요 */
  const editingRef = useRef(startEditing);
  const gridRef = useRef<HTMLDivElement>(null);
  /** 누르고 있는 칸과 처음 위치. 평소엔 길게 누르기 타이머도 */
  const press = useRef<{ cell: number; x: number; y: number; timer: number | null } | null>(null);
  /** 끌어서 고르는 중: 처음 칸 기준 고르기/빼기, last = 마지막으로 지난 칸(새 칸에서만 진동) */
  const drag = useRef<{ select: boolean; last: number } | null>(null);
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

  const isFilled = (cell: number) => cellView(board, block, cell).text.trim().length > 0;
  const anyFilled = Array.from({ length: 9 }, (_, cell) => cell).some(isFilled);
  const canDelete = Boolean(onDeleteCells);
  const picking = editing && (pickMode || selected.size > 0);

  // 칸이 비면(지우기·되돌리기·판 바꾸기 뒤) 고른 목록에서도 빼요
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((cell) => cellView(board, block, cell).text.trim().length > 0));
      return next.size === prev.size ? prev : next;
    });
  }, [board, block]);

  const setCell = (cell: number, on: boolean) =>
    setSelected((prev) => {
      if (prev.has(cell) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(cell);
      else next.delete(cell);
      return next;
    });

  /** 손가락 아래의 칸(이 3×3 안의 `data-cell`) */
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

  const exit = () => {
    cancelPress();
    drag.current = null;
    editingRef.current = false;
    setEditing(false);
    setPickMode(false);
    setSelected(new Set());
    closeEditSession();
  };

  /** 끌어서 고르기 시작: 처음 칸을 고르거나(안 골라져 있으면) 빼요 */
  const startDrag = (cell: number) => {
    const select = !selected.has(cell);
    drag.current = { select, last: cell };
    setCell(cell, select);
    void haptic('tickWeak');
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    gestured.current = false;
    skipClickUntil.current = 0;
    const cell = cellAt(event.clientX, event.clientY);
    if (cell === null) return;
    cancelPress();
    // 편집 모드: 누르기만 하면 click(고치기·고르기), 끌면 고르기
    const timer = editingRef.current
      ? null
      : window.setTimeout(() => {
          if (press.current) press.current.timer = null;
          gestured.current = true;
          enter('longpress');
        }, LONG_PRESS_MS);
    press.current = { cell, x: event.clientX, y: event.clientY, timer };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pending = press.current;
    if (pending && !drag.current) {
      const dx = event.clientX - pending.x;
      const dy = event.clientY - pending.y;
      if (Math.hypot(dx, dy) < MOVE_SLOP_PX) return;
      cancelPress();
      // 움직였으면 누르기가 아니에요(손을 뗀 뒤 click 으로 입력창을 열지 않게)
      gestured.current = true;
      // 평소엔 옆으로 쓸 때만(위아래는 스크롤), 편집 모드에선 어느 쪽으로 끌어도 지울 칸 고르기
      const sideways = Math.abs(dx) > Math.abs(dy);
      if (!canDelete || !isFilled(pending.cell) || (!editingRef.current && !sideways)) return;
      enter('swipe');
      startDrag(pending.cell);
    }
    if (!drag.current) return;
    const cell = cellAt(event.clientX, event.clientY);
    if (cell === null || cell === drag.current.last || !isFilled(cell)) return;
    drag.current.last = cell;
    setCell(cell, drag.current.select);
    void haptic('tickWeak');
  };

  const endPointer = () => {
    cancelPress();
    drag.current = null;
    if (gestured.current) {
      gestured.current = false;
      skipClickUntil.current = Date.now() + SKIP_CLICK_MS;
    }
  };

  /**
   * 칸 click 을 먼저 받아요. true = 여기서 처리했어요(건너뛰기·고치기·고르기), false = 화면의 평소 동작(세부 목표로·체크·빈 칸 적기).
   */
  const handleTap = (cell: number): boolean => {
    if (Date.now() < skipClickUntil.current) {
      skipClickUntil.current = 0;
      return true;
    }
    if (!editing) return false;
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

  const confirmDelete = async () => {
    const cells = [...selected].sort((a, b) => a - b);
    if (cells.length === 0 || !onDeleteCells) return;
    // 세부 목표 이름을 지우는데 그 아래 실천(이번에 같이 지우지 않는 것)이 남으면 알려 줘요
    const keepsActions =
      block === CENTER
        ? cells.some((cell) => cell !== CENTER && board.subs[ringIndex(cell)].actions.some((action) => action.trim()))
        : cells.includes(CENTER) &&
          board.subs[ringIndex(block)].actions.some((action, a) => action.trim() && !cells.includes(a < CENTER ? a : a + 1));
    const ok = await openConfirm({
      title: `${cells.length}칸을 삭제할까요?`,
      description: keepsActions ? '세부 목표를 지워도 그 아래 실천은 그대로예요.' : undefined,
      confirmButton: <ConfirmDialog.ConfirmButton color="danger">삭제</ConfirmDialog.ConfirmButton>,
      cancelButton: '닫기',
    });
    if (!ok) return;
    const undo = onDeleteCells(cells);
    clearSelection();
    toast.openToast(`${cells.length}칸을 삭제했어요`, {
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
    onPointerUp: endPointer,
    onPointerCancel: endPointer,
    // 안드로이드는 길게 누르면 메뉴가 떠요 → 칸 위에서는 막아요
    onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
  };

  /**
   * Block 에 넘길 값. 평소엔 화면의 값 그대로, 편집 모드에선 오늘 체크·칸 아래 글·다음 칸 안내를 빼요(✓ 는 '고른 칸'만 뜻하게).
   * 편집 모드에선 모든 칸을 누를 수 있고(고치기), 고르는 중엔 글이 있는 칸만 눌러요.
   */
  const blockProps = (normal: Omit<BlockModeProps, 'selected'>): BlockModeProps =>
    editing ? { nextCell: null, interactive: picking ? (cell) => isFilled(cell) : () => true, selected: picking ? selected : undefined } : normal;

  /** 3×3 아래 한 줄 안내. 모드가 바뀌면 스크린리더가 읽어요 */
  const hint: string | null = picking
    ? '지울 칸을 누르거나 쭉 끌어서 골라요'
    : editing
      ? canDelete && anyFilled
        ? '칸을 누르면 고치고, 쭉 끌면 지울 칸을 골라요'
        : '칸을 누르면 글을 적어요'
      : anyFilled
        ? canDelete
          ? '칸을 길게 누르면 고치거나 지울 수 있어요'
          : '칸을 길게 누르면 고칠 수 있어요'
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

  // 길게 누르기·쓸기를 못 하는 키보드·스크린리더용 입구. 포커스할 때만 보여요(같은 버튼이라 눌러도 포커스가 남아요)
  const revealButton: ReactNode = !editing ? (
    <button type="button" className="mg-reveal-on-focus" onClick={() => enter('button')}>
      편집
    </button>
  ) : canDelete && anyFilled && !picking ? (
    <button type="button" className="mg-reveal-on-focus" onClick={startPicking}>
      지울 칸 고르기
    </button>
  ) : null;

  return { editing, picking, selected, exit, gridProps, blockProps, handleTap, hint, bottomBar, revealButton };
}
