import { colors } from '@toss/tds-colors';
import { Button, ConfirmDialog, FixedBottomCTA, Text, Top, useDialog, useToast } from '@toss/tds-mobile';
import { useEffect, useRef, useState, type PointerEvent } from 'react';

import { AdMark } from '../components/AiDraftBadge';
import { Block } from '../components/Block';
import { useCellEditor } from '../hooks/useCellEditor';
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
  /** 여러 칸 지우기(2.1): 고른 칸(0~8)의 글을 지우고 되돌리기 함수를 돌려줘요(토스트 '되돌리기'). 없으면 '선택' 버튼을 숨겨요 */
  onDeleteCells?: (cells: number[]) => () => void;
}

/**
 * 편집 = 3×3 칸을 눌러 바텀시트에서 한 칸씩 적어요. '완료' 를 눌러야 반영되고, 시트를 닫으면 그대로예요.
 * (2026-10-20 사용자 피드백: 아래에 입력칸이 줄줄이 있는 대신 누른 칸만 입력)
 * 오른쪽 위 '선택'(2.1): 지울 칸을 누르거나 쭉 끌어서 고르면 '오늘 다 했어요'와 같은 모양(진한 틴트·테두리·✓)으로 보이고,
 * 빨간 '삭제' → 확인 창 → 한꺼번에 지우고, 토스트의 '되돌리기'로 되살릴 수 있어요(2026-10-21 사용자 요청, ui-ux-pro-max undo-support).
 */
export function BlockScreen(props: BlockScreenProps) {
  const { board, block, onDone, initialCell = null, aiFill, onDeleteCells } = props;
  const editor = useCellEditor(props);
  const { openConfirm } = useDialog();
  const toast = useToast();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set());
  const gridRef = useRef<HTMLDivElement>(null);
  /** 끌어서 고르는 중: 처음 누른 칸이 안 골라져 있었으면 고르기, 골라져 있었으면 빼기 */
  const drag = useRef<{ select: boolean } | null>(null);
  /** 손가락·마우스는 누르는 순간 골랐으니 뒤따르는 click 은 건너뛰어요(키보드 Enter·Space 만 click 으로 골라요) */
  const skipClick = useRef(false);

  // 딥링크로 칸이 정해져 들어왔으면 그 칸의 입력창을 바로 열어요(키보드는 입력칸을 한 번 누르면 올라와요)
  useEffect(() => {
    if (initialCell === null) return;
    editor.open(editTarget(board, block, initialCell));
    // 화면이 처음 뜰 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCell]);

  const filled = Array.from({ length: 9 }, (_, cell) => cell).filter((cell) => cellView(board, block, cell).text.trim().length > 0);
  const isFilled = (cell: number) => filled.includes(cell);
  const canSelect = Boolean(onDeleteCells) && filled.length > 0;

  // 다른 곳에서 칸이 비면(다른 기기 아님, 같은 앱의 다른 화면) 고른 목록에서도 빼요
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

  const startSelecting = () => {
    setSelected(new Set());
    setSelecting(true);
  };

  const stopSelecting = () => {
    drag.current = null;
    setSelecting(false);
    setSelected(new Set());
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!selecting) return;
    const cell = cellAt(event.clientX, event.clientY);
    if (cell === null || !isFilled(cell)) return;
    const select = !selected.has(cell);
    drag.current = { select };
    skipClick.current = true;
    setCell(cell, select);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const cell = cellAt(event.clientX, event.clientY);
    if (cell !== null && isFilled(cell)) setCell(cell, drag.current.select);
  };

  const endDrag = () => {
    drag.current = null;
    // 끌다가 다른 칸에서 손을 떼면 click 이 오지 않아요 → 다음 키보드 선택을 막지 않게 바로 풀어요
    window.setTimeout(() => {
      skipClick.current = false;
    }, 0);
  };

  const onCell = (cell: number) => {
    if (!selecting) {
      editor.openFromTap(editTarget(board, block, cell));
      return;
    }
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    setCell(cell, !selected.has(cell));
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
        right={
          selecting || canSelect ? (
            <Top.RightButton color="dark" variant="weak" onClick={selecting ? stopSelecting : startSelecting}>
              {selecting ? '취소' : '선택'}
            </Top.RightButton>
          ) : undefined
        }
      />

      <div style={{ padding: '0 20px' }}>
        <div
          ref={gridRef}
          className={selecting ? 'mg-select-area' : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
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

      <div style={{ padding: '16px 24px 120px' }}>
        <Text typography="t7" color={colors.grey600} display="block">
          {selecting ? '고른 칸은 진하게 ✓ 로 보여요. 다시 누르면 빠져요.' : `칸을 누르면 글을 적을 수 있어요. 한 칸에 ${MAX_TEXT}자까지예요.`}
        </Text>
      </div>

      {selecting ? (
        <FixedBottomCTA color="danger" disabled={selected.size === 0} onClick={() => void confirmDelete()}>
          {selected.size > 0 ? `${selected.size}칸 삭제` : '삭제'}
        </FixedBottomCTA>
      ) : (
        <FixedBottomCTA onClick={onDone}>완료</FixedBottomCTA>
      )}

      {editor.sheet}
    </>
  );
}
