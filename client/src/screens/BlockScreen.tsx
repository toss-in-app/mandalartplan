import { colors } from '@toss/tds-colors';
import { Button, CTAButton, ConfirmDialog, FixedBottomCTA, Text, Top, useDialog, useToast } from '@toss/tds-mobile';
import { useEffect, useRef, useState, type PointerEvent } from 'react';

import { AdMark } from '../components/AiDraftBadge';
import { Block } from '../components/Block';
import { useCellEditor } from '../hooks/useCellEditor';
import { haptic } from '../lib/bridge';
import { cellView, nextEmptyCell } from '../lib/cells';
import { editTarget } from '../lib/cellEdit';
import { CENTER, MAX_TEXT, ringIndex, type Board } from '../lib/mandalart';

interface BlockScreenProps {
  board: Board;
  /** 0~8. 4 는 가운데 블록(핵심 목표 + 세부 목표 8개) */
  block: number;
  onChangeGoal: (goal: string) => void;
  onChangeSubTitle: (subIndex: number, title: string) => void;
  onChangeAction: (subIndex: number, actionIndex: number, text: string) => void;
  onDone: () => void;
  /** 들어오자마자 입력창을 열 칸(0~8). `#/block/:b/:cell` 딥링크 */
  initialCell?: number | null;
  /** AI 로 빈 칸 채우기(2.0, 광고 1회): 가운데 블록 = 빈 세부 목표, 둘레 블록 = 그 세부 목표의 빈 실천. 채울 칸이 없으면 없음 */
  aiFill?: { label: string; caption: string; disabled: boolean; onPress: () => void };
  /** 여러 칸 지우기(2.1): 고른 칸(0~8)의 글을 지우고 되돌리기 함수를 돌려줘요(토스트 '되돌리기'). 없으면 고르기를 못 해요 */
  onDeleteCells?: (cells: number[]) => () => void;
}

/** 이만큼 누르고 있으면 고르기 모드(아이폰 홈 화면처럼 칸이 흔들려요) */
const LONG_PRESS_MS = 450;
/** 손가락이 이만큼 움직이면 누르기가 아니라 쓸기·스크롤 */
const MOVE_SLOP_PX = 10;

/**
 * 편집 = 3×3 칸을 눌러 바텀시트에서 한 칸씩 적어요. '완료' 를 눌러야 반영되고, 시트를 닫으면 그대로예요.
 * (2026-10-20 사용자 피드백: 아래에 입력칸이 줄줄이 있는 대신 누른 칸만 입력)
 *
 * 여러 칸 지우기(2.1, 2026-10-21 사용자 결정 — 버튼으로 들어가는 단계 없이):
 *  - 글이 있는 칸을 **길게 누르거나 옆으로 쓸면** 고르기 모드 — 아이폰 홈 화면 편집처럼 칸이 흔들리고, 고른 칸은 '오늘 다 했어요'와 같은 모양(✓)
 *  - 고르기 모드에서는 누르면 고르기·빼기, 쭉 끌면 지나간 칸을 한꺼번에. 아래 빨간 'n칸 삭제' → 확인 창 → 토스트 '되돌리기'
 *  - 키보드·스크린리더는 3×3 앞의 '여러 칸 골라 지우기' 버튼(포커스할 때만 보임)으로 같은 모드에 들어가요
 */
export function BlockScreen(props: BlockScreenProps) {
  const { board, block, onDone, initialCell = null, aiFill, onDeleteCells } = props;
  const editor = useCellEditor(props);
  const { openConfirm } = useDialog();
  const toast = useToast();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set());
  const gridRef = useRef<HTMLDivElement>(null);
  /** 고르기 전에 누르고 있는 칸: 길게 누르기 타이머와 처음 위치 */
  const press = useRef<{ cell: number; x: number; y: number; timer: number } | null>(null);
  /** 끌어서 고르는 중: 처음 칸이 안 골라져 있었으면 고르기, 골라져 있었으면 빼기. last = 마지막으로 지난 칸(새 칸에서만 진동) */
  const drag = useRef<{ select: boolean; last: number | null } | null>(null);
  /** 길게 누르기·쓸기·손가락으로 고른 뒤 따라오는 click 은 건너뛰어요(입력창을 열거나 두 번 고르지 않게) */
  const skipClick = useRef(false);

  // 딥링크로 칸이 정해져 들어왔으면 그 칸의 입력창을 바로 열어요(키보드는 입력칸을 한 번 누르면 올라와요)
  useEffect(() => {
    if (initialCell === null) return;
    editor.open(editTarget(board, block, initialCell));
    // 화면이 처음 뜰 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCell]);

  // 화면을 떠나면 길게 누르기 타이머를 지워요
  useEffect(() => () => window.clearTimeout(press.current?.timer), []);

  const filled = Array.from({ length: 9 }, (_, cell) => cell).filter((cell) => cellView(board, block, cell).text.trim().length > 0);
  const isFilled = (cell: number) => filled.includes(cell);
  const canSelect = Boolean(onDeleteCells) && filled.length > 0;

  // 칸이 비면(지우기·되돌리기 뒤) 고른 목록에서도 빼요
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
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cell]');
    if (!el || !gridRef.current?.contains(el)) return null;
    const cell = Number(el.dataset.cell);
    return Number.isInteger(cell) ? cell : null;
  };

  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };

  /** 고르기 모드로: 처음 칸을 고르고, 손을 떼기 전까지 끌면 계속 골라요 */
  const enterSelecting = (first: number | null, viaGesture: boolean) => {
    cancelPress();
    setSelecting(true);
    setSelected(new Set(first === null ? [] : [first]));
    if (viaGesture) {
      drag.current = { select: true, last: first };
      skipClick.current = true;
    }
    void haptic('wiggle');
  };

  const stopSelecting = () => {
    cancelPress();
    drag.current = null;
    setSelecting(false);
    setSelected(new Set());
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!canSelect) return;
    const cell = cellAt(event.clientX, event.clientY);
    if (cell === null || !isFilled(cell)) return;
    if (selecting) {
      const select = !selected.has(cell);
      drag.current = { select, last: cell };
      skipClick.current = true;
      setCell(cell, select);
      void haptic('tickWeak');
      return;
    }
    cancelPress();
    const timer = window.setTimeout(() => enterSelecting(cell, true), LONG_PRESS_MS);
    press.current = { cell, x: event.clientX, y: event.clientY, timer };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pending = press.current;
    if (pending && !selecting) {
      const dx = event.clientX - pending.x;
      const dy = event.clientY - pending.y;
      if (Math.hypot(dx, dy) < MOVE_SLOP_PX) return;
      // 옆으로 쓸면 바로 고르기(처음 칸 + 지나가는 칸), 위아래면 스크롤이라 놓아줘요
      if (Math.abs(dx) > Math.abs(dy)) enterSelecting(pending.cell, true);
      else {
        cancelPress();
        return;
      }
    }
    if (!drag.current) return;
    const cell = cellAt(event.clientX, event.clientY);
    if (cell === null || !isFilled(cell) || cell === drag.current.last) return;
    drag.current.last = cell;
    setCell(cell, drag.current.select);
    void haptic('tickWeak');
  };

  const endPointer = () => {
    cancelPress();
    drag.current = null;
    // 끌다가 다른 칸에서 손을 떼면 click 이 오지 않아요 → 다음 누르기를 막지 않게 바로 풀어요
    window.setTimeout(() => {
      skipClick.current = false;
    }, 0);
  };

  const onCell = (cell: number) => {
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    if (selecting) {
      if (isFilled(cell)) setCell(cell, !selected.has(cell));
      return;
    }
    editor.openFromTap(editTarget(board, block, cell));
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
    stopSelecting();
    toast.openToast(`${cells.length}칸을 삭제했어요`, {
      higherThanCTA: true,
      button: {
        text: '되돌리기',
        onClick: () => {
          undo();
          toast.openToast('되돌렸어요', { higherThanCTA: true });
        },
      },
    });
  };

  const isCenter = block === CENTER;
  const subIndex = isCenter ? null : ringIndex(block);
  const sub = subIndex === null ? null : board.subs[subIndex];
  const title = isCenter ? '핵심 목표와 세부 목표' : sub?.title.trim() || `세부 목표 ${(subIndex ?? 0) + 1}`;
  const subtitle = selecting
    ? '지울 칸을 누르거나 쭉 끌어서 골라요'
    : isCenter
      ? '가운데가 핵심 목표, 둘레 8칸이 세부 목표예요'
      : `${board.goal.trim() || '핵심 목표'}를 이루기 위한 실천 항목 8개예요`;

  return (
    <>
      <Top
        title={<Top.TitleParagraph size={22}>{title}</Top.TitleParagraph>}
        subtitleBottom={<Top.SubtitleParagraph size={17}>{subtitle}</Top.SubtitleParagraph>}
      />

      {canSelect && !selecting && (
        // 길게 누르기·쓸기를 못 하는 키보드·스크린리더용 입구. 포커스할 때만 보여요
        <button type="button" className="mg-reveal-on-focus" onClick={() => enterSelecting(null, false)}>
          여러 칸 골라 지우기
        </button>
      )}

      <div style={{ padding: '0 20px' }}>
        <div
          ref={gridRef}
          className={selecting ? 'mg-press-area mg-select-area mg-jiggle' : 'mg-press-area'}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onContextMenu={(event) => {
            // 안드로이드는 길게 누르면 메뉴가 떠요 → 칸 위에서는 막아요
            if (canSelect) event.preventDefault();
          }}
        >
          <Block
            board={board}
            block={block}
            size="main"
            nextCell={selecting ? null : nextEmptyCell(board, block)}
            interactive={selecting ? (cell) => isFilled(cell) : undefined}
            selected={selecting ? selected : undefined}
            onSelectCell={(cell) => onCell(cell)}
          />
        </div>
      </div>

      {aiFill && !selecting && (
        <>
          <div style={{ padding: '16px 20px 0' }}>
            <Button display="block" size="large" color="dark" variant="weak" disabled={aiFill.disabled} onClick={aiFill.onPress} aria-label={`광고 보고 ${aiFill.label}`}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <AdMark onBrand={false} />
                <span>{aiFill.label}</span>
              </span>
            </Button>
          </div>
          <div className="text-balance" style={{ padding: '8px 24px 0' }}>
            <Text typography="t7" color={colors.grey600} display="block">
              {aiFill.caption}
            </Text>
          </div>
        </>
      )}

      <div className="text-balance" style={{ padding: '16px 24px 120px' }}>
        <Text typography="t7" color={colors.grey600} display="block">
          {selecting
            ? '고른 칸은 진하게 ✓ 로 보여요. 다시 누르면 빠져요.'
            : canSelect
              ? `칸을 누르면 글을 적어요(한 칸에 ${MAX_TEXT}자). 길게 누르거나 옆으로 쓸면 여러 칸을 골라 지울 수 있어요.`
              : `칸을 누르면 글을 적을 수 있어요. 한 칸에 ${MAX_TEXT}자까지예요.`}
        </Text>
      </div>

      {selecting ? (
        <FixedBottomCTA.Double
          leftButton={
            <CTAButton color="dark" variant="weak" onClick={stopSelecting}>
              취소
            </CTAButton>
          }
          rightButton={
            <CTAButton color="danger" disabled={selected.size === 0} onClick={() => void confirmDelete()}>
              {selected.size > 0 ? `${selected.size}칸 삭제` : '삭제'}
            </CTAButton>
          }
        />
      ) : (
        <FixedBottomCTA onClick={onDone}>완료</FixedBottomCTA>
      )}

      {editor.sheet}
    </>
  );
}
