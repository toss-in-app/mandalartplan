import { colors } from '@toss/tds-colors';
import { Button, Text, Top } from '@toss/tds-mobile';

import { AdMark } from '../components/AiDraftBadge';
import { Block } from '../components/Block';
import { useCellEditor } from '../hooks/useCellEditor';
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
  /** 편집 화면으로(오른쪽 위 버튼) */
  onEdit: () => void;
  /** 빈 실천 칸을 눌러 시트에서 적었을 때 */
  onChangeAction: (subIndex: number, actionIndex: number, text: string) => void;
  /** '빈 실천 AI로 채우기'(2.1) — 핵심 목표·이 세부 목표가 있고 빈 실천이 있을 때만. 없으면 숨겨요 */
  aiFill?: { label: string; caption: string; disabled: boolean; onPress: () => void };
}

/**
 * 세부 목표 화면 = 그 목표의 3×3. 실천 칸을 누르면 오늘 했어요 체크/해제, 빈 칸을 누르면 그 자리에서 바텀시트로 적어요.
 * 가운데(세부 목표 이름)는 누를 수 없는 이름표 — 편집은 오른쪽 위 버튼. 실천을 오늘 다 하면 가운데가 진해져요.
 */
export function SubScreen({ board, subIndex, checkin, onToggle, onEdit, onChangeAction, aiFill }: SubScreenProps) {
  const editor = useCellEditor({ onChangeAction });
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
        right={
          <Top.RightButton color="dark" variant="weak" onClick={() => onEdit()}>
            편집
          </Top.RightButton>
        }
      />

      <div style={{ padding: '0 20px' }}>
        <Block
          board={board}
          block={cellOfRing(subIndex)}
          size="main"
          checked={checked}
          nextCell={nextEmptyCell(board, cellOfRing(subIndex))}
          interactive={(_cell, view) => view.kind === 'action'}
          onSelectCell={(cell, view) => {
            if (view.kind !== 'action' || view.index === null) return;
            if (view.text) onToggle(view.index);
            else editor.openFromTap(editTarget(board, cellOfRing(subIndex), cell));
          }}
        />
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
          {board.goal.trim() ? `핵심 목표 · ${board.goal.trim()}` : '핵심 목표는 홈의 편집에서 적어요'}
        </Text>
      </div>

      {editor.sheet}
    </>
  );
}
