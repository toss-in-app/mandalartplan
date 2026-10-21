import { colors } from '@toss/tds-colors';
import { Button, Text, Top } from '@toss/tds-mobile';
import { useEffect } from 'react';

import { AdMark } from '../components/AiDraftBadge';
import { Block } from '../components/Block';
import { EditDoneButton } from '../components/EditDoneButton';
import { useCellEditor } from '../hooks/useCellEditor';
import { useGridEdit } from '../hooks/useGridEdit';
import { editTarget } from '../lib/cellEdit';
import { nextEmptyCell } from '../lib/cells';
import { checkedInSub, todaySet } from '../lib/checkin';
import { cellOfRing, type Board } from '../lib/mandalart';
import { dateKey, type CheckinRecord } from '../lib/state';

interface SubScreenProps {
  board: Board;
  /** 세부 목표 index 0~7 */
  subIndex: number;
  checkin: CheckinRecord | undefined;
  onToggle: (actionIndex: number) => void;
  /** 칸을 눌러 시트에서 적었을 때(빈 실천 칸, 또는 편집 모드에서 고친 칸) */
  onChangeAction: (subIndex: number, actionIndex: number, text: string) => void;
  /** 편집 모드에서 가운데(세부 목표 이름)를 고쳤을 때 */
  onChangeSubTitle: (subIndex: number, title: string) => void;
  /** '빈 실천 AI로 채우기'(2.1) — 핵심 목표·이 세부 목표가 있고 빈 실천이 있을 때만. 없으면 숨겨요 */
  aiFill?: { label: string; caption: string; disabled: boolean; onPress: () => void };
  /** 편집 모드에서 고른 칸(0~8)을 지우고 되돌리기 함수를 돌려줘요(2.1) */
  onDeleteCells?: (cells: number[]) => () => void;
  /** 예전 편집 화면 링크(`block/:n`)로 들어왔을 때: 편집 모드로 시작, cell 이 있으면 그 칸 입력창, '완료'는 편집 모드를 끝내고 onDone */
  editLink?: { cell: number | null; onDone: () => void };
}

/**
 * 세부 목표 화면 = 그 목표의 3×3. 실천 칸을 누르면 오늘 했어요 체크/해제, 빈 칸을 누르면 그 자리에서 바텀시트로 적어요.
 * 가운데(세부 목표 이름)는 누를 수 없는 이름표. 실천을 오늘 다 하면 가운데가 진해지고 '오늘 다 했어요'가 붙어요.
 * 오늘 한 실천 칸은 브랜드 색으로 채워져요(✓ 는 편집 모드의 '고른 칸'만).
 * 고치기·지우기는 편집 버튼 없이 칸을 길게 눌러 그 자리에서(2.1 제자리 편집 모드, `useGridEdit`) — 오른쪽 위 '완료'로 끝내요.
 */
export function SubScreen({ board, subIndex, checkin, onToggle, onChangeAction, onChangeSubTitle, aiFill, onDeleteCells, editLink }: SubScreenProps) {
  const block = cellOfRing(subIndex);
  const editor = useCellEditor({ onChangeAction, onChangeSubTitle });
  const edit = useGridEdit({
    board,
    block,
    screen: 'sub',
    onEditCell: (cell) => editor.openFromTap(editTarget(board, block, cell)),
    onDeleteCells,
    startEditing: Boolean(editLink),
  });
  // 링크로 들어왔으면 편집 모드를 끝내고 이전 화면으로(이전 화면이 없어도 편집 모드는 끝나요)
  const finishEditing = () => {
    edit.exit();
    editLink?.onDone();
  };
  // 링크에 칸이 정해져 있으면(`block/:n/:cell`) 그 칸의 입력창을 바로 열어요
  const linkCell = editLink?.cell ?? null;
  useEffect(() => {
    if (linkCell !== null) editor.open(editTarget(board, block, linkCell));
    // 화면이 처음 뜰 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const today = dateKey();
  const checked = todaySet(checkin, today);
  const sub = board.subs[subIndex];
  const total = sub.actions.filter((a) => a.trim()).length;
  const done = checkedInSub(checked, subIndex);
  const title = sub.title.trim() || `세부 목표 ${subIndex + 1}`;
  const subtitle =
    total === 0 ? '실천 항목을 적어 보세요' : done >= total ? `오늘 ${done}/${total} · 오늘 실천을 다 했어요` : `오늘 ${done}/${total} · 실천한 칸을 눌러 체크해요`;

  return (
    <>
      <Top
        title={<Top.TitleParagraph size={22}>{title}</Top.TitleParagraph>}
        subtitleBottom={<Top.SubtitleParagraph size={17}>{subtitle}</Top.SubtitleParagraph>}
        right={<EditDoneButton editing={edit.editing} onClick={finishEditing} />}
      />

      {edit.revealButton}

      <div style={{ padding: '0 20px' }}>
        <div {...edit.gridProps}>
          <Block
            board={board}
            block={block}
            size="main"
            {...edit.blockProps({
              checked,
              nextCell: nextEmptyCell(board, block),
              // 실천을 오늘 다 하면 가운데 이름표에 말로도 알려요(진해진 색과 함께)
              caption: (view) => (view.kind === 'sub' && view.checked ? '오늘 다 했어요' : null),
              interactive: (_cell, view) => view.kind === 'action',
            })}
            onSelectCell={(cell, view) => {
              // 편집 모드(고치기·고르기)와 길게 누른 뒤의 click 은 편집 쪽이 받아요
              if (edit.handleTap(cell)) return;
              if (view.kind !== 'action' || view.index === null) return;
              if (view.text) onToggle(view.index);
              else editor.openFromTap(editTarget(board, block, cell));
            }}
          />
        </div>
      </div>

      {/* 편집 버튼 대신 길게 누르기를 알려 주고, 편집 모드에선 할 수 있는 일을 알려 줘요 */}
      <div className="text-balance" aria-live="polite" style={{ padding: edit.hint ? '12px 24px 0' : 0 }}>
        {edit.hint && (
          <Text typography="t7" color={colors.grey600} display="block">
            {edit.hint}
          </Text>
        )}
      </div>

      {aiFill && (
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

      <div style={{ padding: '20px 24px 40px' }}>
        <Text typography="t7" color={colors.grey600} display="block">
          {board.goal.trim() ? `핵심 목표 · ${board.goal.trim()}` : '핵심 목표는 홈 가운데 칸에서 적어요'}
        </Text>
      </div>

      {editor.sheet}
      {edit.bottomBar}
    </>
  );
}
