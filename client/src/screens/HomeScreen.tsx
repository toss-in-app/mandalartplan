import { colors } from '@toss/tds-colors';
import { Button, List, ListRow, ProgressBar, Text, Top } from '@toss/tds-mobile';

import { MandalartGrid } from '../components/MandalartGrid';
import { activeSeason, type Content } from '../content';
import { getProgress, type Board } from '../lib/mandalart';
import { dateKey, streak, type CheckinRecord } from '../lib/state';
import { brandColor } from '../theme';

interface HomeScreenProps {
  board: Board;
  content: Content;
  checkin: CheckinRecord | undefined;
  notificationVisible: boolean;
  onSelectBlock: (block: number) => void;
  onCheckin: () => void;
  onShare: () => void;
  onSettings: () => void;
}

export function HomeScreen({ board, content, checkin, notificationVisible, onSelectBlock, onCheckin, onShare, onSettings }: HomeScreenProps) {
  const today = dateKey();
  const progress = getProgress(board);
  const hasGoal = board.goal.trim().length > 0;
  const isEmpty = progress.filled === 0;
  const actionsFilled = progress.filled - (hasGoal ? 1 : 0) - board.subs.filter((s) => s.title.trim()).length;
  const days = streak(checkin, today);
  const todayChecked = checkin?.days[today]?.length;
  const season = activeSeason(content, today);

  const subtitle = isEmpty
    ? '가운데 칸을 눌러 핵심 목표부터 정해 보세요'
    : todayChecked === undefined
      ? days > 0
        ? `${days}일째 이어가는 중 · 오늘 체크인 전`
        : `${progress.filled}칸 작성 · 오늘 체크인 전`
      : `${days}일째 · 오늘 ${todayChecked}개 체크`;

  return (
    <>
      <Top
        title={<Top.TitleParagraph size={22}>{hasGoal ? board.goal : '만다라트'}</Top.TitleParagraph>}
        subtitleBottom={<Top.SubtitleParagraph size={17}>{subtitle}</Top.SubtitleParagraph>}
        right={
          <Top.RightButton color="dark" variant="weak" disabled={isEmpty} onClick={onShare}>
            공유
          </Top.RightButton>
        }
      />

      {(content.notice || season) && (
        <div style={{ padding: '0 20px 16px' }}>
          <Text typography="t7" color={colors.grey700}>
            {content.notice ?? season?.message}
          </Text>
        </div>
      )}

      <MandalartGrid board={board} onSelectBlock={onSelectBlock} />

      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text typography="t7" color={colors.grey600}>
            달성
          </Text>
          <Text typography="t7" color={colors.grey800} fontWeight="semibold">
            {progress.done} / {progress.totalActions}
          </Text>
        </div>
        <ProgressBar size="normal" color={brandColor} progress={progress.done / progress.totalActions} animate />
      </div>

      <div style={{ padding: '24px 20px 8px' }}>
        <Button display="full" size="large" disabled={actionsFilled === 0} onClick={onCheckin}>
          오늘 체크인 하기
        </Button>
        {actionsFilled === 0 && (
          <div style={{ paddingTop: 8 }}>
            <Text typography="t7" color={colors.grey500} textAlign="center" display="block">
              실천 항목을 하나 이상 적으면 체크인할 수 있어요
            </Text>
          </div>
        )}
      </div>

      <List>
        {notificationVisible && (
          <ListRow
            onClick={onSettings}
            withArrow
            contents={<ListRow.Texts type="1RowTypeA" top="매일 저녁 알림 받기" />}
          />
        )}
        <ListRow onClick={onSettings} withArrow contents={<ListRow.Texts type="1RowTypeA" top="설정" />} />
      </List>
      <div style={{ height: 40 }} />
    </>
  );
}
