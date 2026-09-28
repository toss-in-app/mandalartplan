import { colors } from '@toss/tds-colors';
import { Text, Top } from '@toss/tds-mobile';

import { MandalartGrid } from '../components/MandalartGrid';
import { todaySet } from '../lib/checkin';
import { CENTER, ringIndex, type Board } from '../lib/mandalart';
import { dateKey, type CheckinRecord } from '../lib/state';

interface OverviewScreenProps {
  board: Board;
  checkin: CheckinRecord | undefined;
  onSelectSub: (subIndex: number) => void;
  onEditCore: () => void;
}

/** 9×9 전체 보기. 한눈에 보는 용도라 글자는 작고, 블록을 누르면 그 세부 목표 화면으로 가요. */
export function OverviewScreen({ board, checkin, onSelectSub, onEditCore }: OverviewScreenProps) {
  const checked = todaySet(checkin, dateKey());
  return (
    <>
      <Top
        title={<Top.TitleParagraph size={22}>전체 보기</Top.TitleParagraph>}
        subtitleBottom={<Top.SubtitleParagraph size={17}>블록을 누르면 크게 볼 수 있어요</Top.SubtitleParagraph>}
      />
      <MandalartGrid
        board={board}
        checked={checked}
        onSelectBlock={(block) => (block === CENTER ? onEditCore() : onSelectSub(ringIndex(block)))}
      />
      <div style={{ padding: '16px 20px 40px' }}>
        <Text typography="t7" color={colors.grey500} display="block">
          색이 진한 칸은 오늘 한 실천이에요. 이미지로 저장하려면 홈의 공유를 눌러요.
        </Text>
      </div>
    </>
  );
}
