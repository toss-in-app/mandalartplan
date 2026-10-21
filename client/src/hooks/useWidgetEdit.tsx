import { useWebToast } from '@toss/tds-mobile';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';

import { logEvent } from '../lib/analytics';
import { haptic } from '../lib/bridge';
import { RECORD_WIDGETS, addWidget, hiddenWidgets, hideWidget, moveWidget, visibleWidgets, type RecordWidgetId } from '../lib/widgets';
import { LONG_PRESS_MS, MOVE_SLOP_PX, SKIP_CLICK_MS, type EditVia } from './useGridEdit';

interface UseWidgetEditOptions {
  /** 저장된 배치(null = 기본) */
  widgets: RecordWidgetId[] | null;
  /** 배치를 바꿔 저장해요 */
  onChange: (next: RecordWidgetId[]) => void;
}

interface Drag {
  id: RecordWidgetId;
  /** 누른 곳이 위젯 왼쪽 위에서 얼마나 떨어져 있었나 */
  grabX: number;
  grabY: number;
  /** 마지막 손가락 위치(화면 좌표) */
  x: number;
  y: number;
  before: RecordWidgetId[];
}

/**
 * 기록 위젯 판의 편집 모드(3.0, 사용자 2026-10-21 '위젯 판 고칠 수 있고'). 홈 3×3 의 제자리 편집(useGridEdit)과 같은 손버릇이에요.
 *  - 위젯을 **길게 누르면** 편집 모드: 위젯이 흔들리고('wiggle' 진동) 왼쪽 위 −, 오른쪽 위 '완료'. 끌기로는 들어가지 않아요
 *  - 편집 모드에서 위젯을 **잡고 끌면** 손가락을 따라오고, 다른 위젯 위를 지나면 그 자리로 끼어들어요(손을 떼면 저장돼 있어요).
 *    길게 눌러 편집 모드가 된 손가락을 떼지 않고 끌어도 옮겨요
 *  - − 는 바로 숨기기(마지막 하나는 못 숨겨요), 아래 '숨긴 위젯'의 ＋ 는 맨 뒤에 넣기
 *  - 키보드·스크린리더는 포커스할 때만 보이는 '편집'·'앞으로'·'뒤로'
 * 편집 모드에선 위젯을 눌러도 대시보드로 가지 않아요. 바꿀 때마다 record_widget_edit 를 보내요.
 */
export function useWidgetEdit({ widgets, onChange }: UseWidgetEditOptions) {
  const toast = useWebToast();
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const visible = visibleWidgets(widgets);
  const hidden = hiddenWidgets(widgets);
  const latest = useRef({ widgets, onChange });
  latest.current = { widgets, onChange };
  /** 누르고 있는 위젯과 처음 위치. 평소엔 길게 누르기 타이머도 */
  const press = useRef<{ id: RecordWidgetId; x: number; y: number; pointerId: number; timer: number | null } | null>(null);
  const drag = useRef<Drag | null>(null);
  /** 끌고 있는 위젯과 손가락을 따라가는 만큼(다시 그릴 때 쓰려고 상태로도) */
  const [dragView, setDragView] = useState<{ id: RecordWidgetId; dx: number; dy: number } | null>(null);
  const gestured = useRef(false);
  /** 이 시각 전까지 오는 click 은 길게 누르기·끌기를 한 손가락의 것(대시보드를 열지 않게) */
  const skipClickUntil = useRef(0);

  const cancelPress = () => {
    if (press.current?.timer) window.clearTimeout(press.current.timer);
    press.current = null;
  };

  useEffect(() => () => cancelPress(), []);

  const enter = (via: EditVia) => {
    if (editingRef.current) return;
    editingRef.current = true;
    setEditing(true);
    void haptic('wiggle');
    logEvent('edit_mode_enter', { screen: 'records', via });
  };

  const exit = () => {
    cancelPress();
    drag.current = null;
    setDragView(null);
    editingRef.current = false;
    setEditing(false);
  };

  const save = (next: RecordWidgetId[], action: 'hide' | 'add' | 'move', id: RecordWidgetId) => {
    latest.current.onChange(next);
    logEvent('record_widget_edit', { action, widget: id, visible: next.length });
  };

  const hide = (id: RecordWidgetId) => {
    const current = visibleWidgets(latest.current.widgets);
    if (current.length <= 1) {
      toast.openToast('위젯은 하나 이상 있어야 해요');
      return;
    }
    save(hideWidget(current, id), 'hide', id);
    void haptic('tickWeak');
  };

  const add = (id: RecordWidgetId) => {
    save(addWidget(latest.current.widgets, id), 'add', id);
    void haptic('tap');
  };

  /** 키보드로 옮기기: 앞(-1)·뒤(+1) */
  const step = (id: RecordWidgetId, delta: -1 | 1) => {
    const current = visibleWidgets(latest.current.widgets);
    const index = current.indexOf(id);
    const next = moveWidget(current, id, index + delta);
    if (next.every((w, i) => w === current[i])) return;
    save(next, 'move', id);
  };

  /** 손가락 아래 위젯(끌고 있는 위젯은 빼요) */
  const widgetAt = (x: number, y: number, except: RecordWidgetId): RecordWidgetId | null => {
    const stack = document.elementsFromPoint?.(x, y) ?? [];
    for (const el of stack) {
      const target = (el as HTMLElement).closest?.<HTMLElement>('[data-widget]');
      const id = target?.dataset.widget as RecordWidgetId | undefined;
      if (id && id !== except && boardRef.current?.contains(target)) return id;
    }
    return null;
  };

  /** 끌고 있는 위젯이 손가락 밑에 오도록 옮길 만큼(자리가 바뀌어 위젯이 새 칸으로 가도 다시 맞춰요) */
  const follow = () => {
    const d = drag.current;
    const board = boardRef.current;
    const el = board?.querySelector<HTMLElement>(`[data-widget="${d?.id}"]`);
    if (!d || !board || !el) return;
    const rect = board.getBoundingClientRect();
    setDragView({ id: d.id, dx: d.x - rect.left - d.grabX - el.offsetLeft, dy: d.y - rect.top - d.grabY - el.offsetTop });
  };

  // 끄는 중에 자리가 바뀌면 새 칸 기준으로 다시 맞춰요(한 번 튀지 않게 그리기 전에)
  const order = visible.join(',');
  useLayoutEffect(() => {
    // follow 는 ref 만 읽어요
    if (drag.current) follow();
  }, [order]);

  const startDrag = (id: RecordWidgetId, x: number, y: number, pointerId: number) => {
    const board = boardRef.current;
    const el = board?.querySelector<HTMLElement>(`[data-widget="${id}"]`);
    if (!board || !el) return;
    // 끄는 동안 손가락이 판 밖(아래 '숨긴 위젯')으로 나가도 따라가게. 누르기만 할 때는 잡지 않아요(위젯 click 이 판으로 가지 않게)
    try {
      board.setPointerCapture?.(pointerId);
    } catch {
      /* jsdom 등 */
    }
    const rect = board.getBoundingClientRect();
    drag.current = { id, grabX: x - rect.left - el.offsetLeft, grabY: y - rect.top - el.offsetTop, x, y, before: visibleWidgets(latest.current.widgets) };
    setDragView({ id, dx: 0, dy: 0 });
    void haptic('tickWeak');
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    gestured.current = false;
    skipClickUntil.current = 0;
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-widget]');
    // − 버튼·키보드 버튼은 그냥 누르기
    if (!target || (event.target as HTMLElement).closest('button[data-control]')) return;
    const id = target.dataset.widget as RecordWidgetId;
    cancelPress();
    const timer = editingRef.current
      ? null
      : window.setTimeout(() => {
          if (press.current) press.current.timer = null;
          gestured.current = true;
          enter('longpress');
        }, LONG_PRESS_MS);
    press.current = { id, x: event.clientX, y: event.clientY, pointerId: event.pointerId, timer };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pending = press.current;
    if (pending && !drag.current) {
      if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) < MOVE_SLOP_PX) return;
      cancelPress();
      gestured.current = true;
      // 옮기기는 편집 모드에서만. 평소에 끌면 스크롤이에요(끌기로 편집 모드가 되지 않게)
      if (!editingRef.current) return;
      startDrag(pending.id, pending.x, pending.y, pending.pointerId);
    }
    const d = drag.current;
    if (!d) return;
    d.x = event.clientX;
    d.y = event.clientY;
    const over = widgetAt(event.clientX, event.clientY, d.id);
    if (over) {
      const current = visibleWidgets(latest.current.widgets);
      const next = moveWidget(current, d.id, current.indexOf(over));
      if (!next.every((w, i) => w === current[i])) {
        latest.current.onChange(next);
        void haptic('tickWeak');
      }
    }
    follow();
  };

  const endPointer = () => {
    cancelPress();
    const d = drag.current;
    if (d) {
      drag.current = null;
      setDragView(null);
      const now = visibleWidgets(latest.current.widgets);
      if (!now.every((w, i) => w === d.before[i])) logEvent('record_widget_edit', { action: 'move', widget: d.id, visible: now.length });
    }
    if (gestured.current) {
      gestured.current = false;
      skipClickUntil.current = Date.now() + SKIP_CLICK_MS;
    }
  };

  /** 위젯 click: true 면 여기서 막았어요(길게 누르기·끌기 직후, 편집 모드) */
  const blockClick = (): boolean => {
    if (Date.now() < skipClickUntil.current) {
      skipClickUntil.current = 0;
      return true;
    }
    return editingRef.current;
  };

  const boardProps = {
    ref: boardRef,
    className: editing ? 'rc-board rc-board-edit' : 'rc-board',
    onPointerDown,
    onPointerMove,
    onPointerUp: endPointer,
    onPointerCancel: endPointer,
    // 안드로이드는 길게 누르면 메뉴가 떠요 → 판 위에서는 막아요
    onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
  };

  /** 끌고 있는 위젯의 모양 */
  const dragStyle = (id: RecordWidgetId): { className: string; style?: CSSProperties } =>
    dragView?.id === id ? { className: ' rc-widget-dragging', style: { transform: `translate(${dragView.dx}px, ${dragView.dy}px)` } } : { className: '' };

  /** 편집 모드 안내(aria-live 자리는 늘 두고 글만 바꿔요) */
  const hint = editing ? '끌어서 자리를 바꾸고, − 를 눌러 숨겨요' : '';

  return {
    editing,
    visible,
    hidden,
    enter,
    exit,
    hide,
    add,
    step,
    blockClick,
    boardProps,
    dragStyle,
    hint,
    names: RECORD_WIDGETS,
  };
}
