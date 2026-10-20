import { colors } from '@toss/tds-colors';
import { Button, FixedBottomCTA, Text, Top } from '@toss/tds-mobile';
import { useEffect } from 'react';

import { AdMark } from '../components/AiDraftBadge';
import { Block } from '../components/Block';
import { useCellEditor } from '../hooks/useCellEditor';
import { nextEmptyCell } from '../lib/cells';
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
}

/**
 * 편집 = 3×3 칸을 눌러 바텀시트에서 한 칸씩 적어요. '완료' 를 눌러야 반영되고, 시트를 닫으면 그대로예요.
 * (2026-10-20 사용자 피드백: 아래에 입력칸이 줄줄이 있는 대신 누른 칸만 입력)
 */
export function BlockScreen(props: BlockScreenProps) {
  const { board, block, onDone, initialCell = null, aiFill } = props;
  const editor = useCellEditor(props);

  // 딥링크로 칸이 정해져 들어왔으면 그 칸의 입력창을 바로 열어요(키보드는 입력칸을 한 번 누르면 올라와요)
  useEffect(() => {
    if (initialCell === null) return;
    editor.open(editTarget(board, block, initialCell));
    // 화면이 처음 뜰 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCell]);

  const isCenter = block === CENTER;
  const subIndex = isCenter ? null : ringIndex(block);
  const sub = subIndex === null ? null : board.subs[subIndex];
  const title = isCenter ? '핵심 목표와 세부 목표' : sub?.title.trim() || `세부 목표 ${(subIndex ?? 0) + 1}`;
  const subtitle = isCenter
    ? '가운데가 핵심 목표, 둘레 8칸이 세부 목표예요'
    : `${board.goal.trim() || '핵심 목표'}를 이루기 위한 실천 항목 8개예요`;

  return (
    <>
      <Top
        title={<Top.TitleParagraph size={22}>{title}</Top.TitleParagraph>}
        subtitleBottom={<Top.SubtitleParagraph size={17}>{subtitle}</Top.SubtitleParagraph>}
      />

      <div style={{ padding: '0 20px' }}>
        <Block board={board} block={block} size="main" nextCell={nextEmptyCell(board, block)} onSelectCell={(cell) => editor.openFromTap(editTarget(board, block, cell))} />
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

      <div style={{ padding: '16px 24px 120px' }}>
        <Text typography="t7" color={colors.grey600} display="block">
          칸을 누르면 글을 적을 수 있어요. 한 칸에 {MAX_TEXT}자까지예요.
        </Text>
      </div>

      <FixedBottomCTA onClick={onDone}>완료</FixedBottomCTA>

      {editor.sheet}
    </>
  );
}
