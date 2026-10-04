import { colors } from '@toss/tds-colors';
import { Button, List, ListRow, ProgressBar, Text, Top } from '@toss/tds-mobile';

import { Block } from '../components/Block';
import { activeSeason, type Content } from '../content';
import { checkedInSub, formatDateLabel, todaySet } from '../lib/checkin';
import { CENTER, getProgress, type Board } from '../lib/mandalart';
import { dateKey, streak, type CheckinRecord } from '../lib/state';
import { brandColor } from '../theme';

interface HomeScreenProps {
  board: Board;
  content: Content;
  checkin: CheckinRecord | undefined;
  notificationVisible: boolean;
  onEditCore: () => void;
  onSelectSub: (subIndex: number) => void;
  onToday: () => void;
  onOverview: () => void;
  onShare: () => void;
  onSettings: () => void;
  onStartWithTemplate: () => void;
}

/**
 * 홈 = 가운데 3×3 (핵심 목표 + 세부 목표 8). 세부 목표를 누르면 그 목표의 3×3 으로,
 * 가운데(핵심 목표)를 누르면 편집으로. 9×9 는 '전체 보기' 로.
 */
export function HomeScreen({
  board,
  content,
  checkin,
  notificationVisible,
  onEditCore,
  onSelectSub,
  onToday,
  onOverview,
  onShare,
  onSettings,
  onStartWithTemplate,
}: HomeScreenProps) {
  const today = dateKey();
  const progress = getProgress(board);
  const checked = todaySet(checkin, today);
  const hasGoal = board.goal.trim().length > 0;
  const isEmpty = progress.filled === 0;
  const days = streak(checkin, today);
  const season = activeSeason(content, today);

  const subtitle = isEmpty
    ? '가운데 칸을 눌러 핵심 목표부터 정해 보세요'
    : checked.size > 0
      ? `${days}일째 · 오늘 ${checked.size}개 했어요`
      : days > 0
        ? `${days}일째 이어가는 중 · 오늘은 아직`
        : `${formatDateLabel(today)} · 세부 목표를 눌러 실천을 체크해요`;

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

      <div style={{ padding: '0 20px' }}>
        <Block
          board={board}
          block={CENTER}
          size="main"
          caption={(view) => {
            if (view.kind !== 'sub' || view.index === null || !view.text) return null;
            const total = board.subs[view.index].actions.filter((a) => a.trim()).length;
            if (total === 0) return '실천을 적어요';
            return `오늘 ${checkedInSub(checked, view.index)}/${total}`;
          }}
          onSelectCell={(_cell, view) => {
            if (view.kind === 'goal') onEditCore();
            else if (view.kind === 'sub' && view.index !== null) onSelectSub(view.index);
          }}
        />
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text typography="t7" color={colors.grey600}>
            오늘 실천
          </Text>
          <Text typography="t7" color={colors.grey800} fontWeight="semibold">
            {checked.size} / {progress.actionsFilled}
          </Text>
        </div>
        <ProgressBar
          size="normal"
          color={brandColor}
          progress={progress.actionsFilled === 0 ? 0 : checked.size / progress.actionsFilled}
          animate
        />
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '24px 20px 8px' }}>
        <div style={{ flex: 1 }}>
          <Button display="full" size="large" disabled={progress.actionsFilled === 0} onClick={onToday}>
            오늘 기록 보기
          </Button>
        </div>
        <div style={{ flex: 1 }}>
          <Button display="full" size="large" color="dark" variant="weak" disabled={isEmpty} onClick={onOverview}>
            전체 보기
          </Button>
        </div>
      </div>

      <List>
        {isEmpty && (
          <ListRow onClick={onStartWithTemplate} withArrow contents={<ListRow.Texts type="1RowTypeA" top="예시로 시작하기" />} />
        )}
        {notificationVisible && (
          <ListRow onClick={onSettings} withArrow contents={<ListRow.Texts type="1RowTypeA" top="매일 저녁 알림 받기" />} />
        )}
        <ListRow onClick={onSettings} withArrow contents={<ListRow.Texts type="1RowTypeA" top="설정" />} />
      </List>
      <div style={{ height: 40 }} />
    </>
  );
}
