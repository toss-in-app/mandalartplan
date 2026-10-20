import { colors } from '@toss/tds-colors';
import { Text, Top } from '@toss/tds-mobile';

import { AiDraftBadge } from '../components/AiDraftBadge';
import { MandalartGrid } from '../components/MandalartGrid';
import { todaySet } from '../lib/checkin';
import { hasAiText, ringIndex, type Board } from '../lib/mandalart';
import { dateKey, type CheckinRecord } from '../lib/state';

interface OverviewScreenProps {
  board: Board;
  checkin: CheckinRecord | undefined;
  onSelectSub: (subIndex: number) => void;
  onShare: () => void;
}

/** 9×9 전체 보기. 한눈에 보는 용도라 글자는 작고, 둘레 블록을 누르면 그 세부 목표 화면으로 가요. 가운데 블록은 누를 수 없어요. 공유는 오른쪽 위. */
export function OverviewScreen({ board, checkin, onSelectSub, onShare }: OverviewScreenProps) {
  const checked = todaySet(checkin, dateKey());
  return (
    <>
      <Top
        subtitleTop={hasAiText(board) ? <AiDraftBadge /> : undefined}
        title={<Top.TitleParagraph size={22}>전체 보기</Top.TitleParagraph>}
        subtitleBottom={<Top.SubtitleParagraph size={17}>둘레 블록을 누르면 크게 볼 수 있어요</Top.SubtitleParagraph>}
        right={
          <Top.RightButton color="dark" variant="weak" onClick={onShare}>
            공유
          </Top.RightButton>
        }
      />
      <MandalartGrid board={board} checked={checked} onSelectBlock={(block) => onSelectSub(ringIndex(block))} />
      <div style={{ padding: '16px 24px 40px' }}>
        <Text typography="t7" color={colors.grey600} display="block">
          보라색 테두리 칸은 오늘 한 실천이고, 진해진 세부 목표 칸은 실천을 오늘 다 한 거예요. 이미지로 저장하거나 보내려면 오른쪽 위 공유를 눌러요.
        </Text>
      </div>
    </>
  );
}
