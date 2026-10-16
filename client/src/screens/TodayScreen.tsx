import { colors } from '@toss/tds-colors';
import { Button, List, ListHeader, ListRow, SegmentedControl, Text, Top } from '@toss/tds-mobile';
import { useState } from 'react';

import { AD_GROUPS } from '../ads/config';
import { AdBanner } from '../components/AdBanner';
import { StatsPanel } from '../components/StatsPanel';
import { cheerFor, type Content } from '../content';
import { checkinGroups, formatDateLabel, todaySet } from '../lib/checkin';
import type { Board } from '../lib/mandalart';
import { dateKey, streak, type CheckinRecord } from '../lib/state';
import { computeStats, periodRange, type StatsPeriod } from '../lib/stats';

type RecordTab = 'today' | StatsPeriod;

export interface StatsViewInfo {
  period: StatsPeriod;
  offset: number;
  activeDays: number;
  checks: number;
}

interface TodayScreenProps {
  board: Board;
  record: CheckinRecord | undefined;
  content: Content;
  /** 알림 상태가 unknown 이고 쓸 수 있을 때만 — 위에 '매일 저녁 알림 받기' 버튼 */
  onNotification?: () => void;
  onDone: () => void;
  /** 딥링크로 바로 들어와 뒤로가기가 종료일 때만 빈 상태에 '홈으로' 버튼을 둬요 */
  showHome?: boolean;
  /** 주간·월간 탭을 열거나 기간을 옮겼을 때 (분석 stats_view) */
  onStatsView?: (info: StatsViewInfo) => void;
}

function isRecordTab(value: string): value is RecordTab {
  return value === 'today' || value === 'week' || value === 'month';
}

/**
 * 기록 (홈 '기록 보기', 화면 흐름 v3). 탭 [오늘 | 주간 | 월간] — 탭은 화면 안 상태라 히스토리에 쌓지 않고, 들어올 때마다 '오늘'.
 * Top 은 제목만 둬서 탭을 바꿔도 화면이 튀지 않아요. 오늘 탭은 오늘 체크한 실천을 세부 목표별로, 주간·월간 탭은 StatsPanel.
 * 전면 광고는 홈 → 이 화면 전환에(App). 배너 1개는 맨 아래 — 체크 기록이 하나라도 있으면 보이고, 탭을 바꿔도 다시 불러오지 않아요(refresh 금지).
 */
export function TodayScreen({ board, record, content, onNotification, onDone, showHome = false, onStatsView }: TodayScreenProps) {
  const today = dateKey();
  const [tab, setTab] = useState<RecordTab>('today');
  const [offsets, setOffsets] = useState<Record<StatsPeriod, number>>({ week: 0, month: 0 });
  const checked = todaySet(record, today);
  const days = streak(record, today);
  const hasHistory = record !== undefined && Object.keys(record.days).length > 0;

  const reportStats = (period: StatsPeriod, offset: number) => {
    if (!onStatsView) return;
    const stats = computeStats(board, record, periodRange(period, today, offset), today);
    onStatsView({ period, offset, activeDays: stats.activeDays, checks: stats.checks });
  };

  const changeTab = (value: string) => {
    if (!isRecordTab(value) || value === tab) return;
    setTab(value);
    if (value !== 'today') reportStats(value, offsets[value]);
  };

  const move = (period: StatsPeriod, offset: number) => {
    setOffsets((prev) => ({ ...prev, [period]: offset }));
    reportStats(period, offset);
  };

  return (
    <>
      <Top title={<Top.TitleParagraph size={22}>기록</Top.TitleParagraph>} />
      {/* SegmentedControl 은 좌우 24px 여백을 스스로 가져요 */}
      <div style={{ paddingBottom: 16 }}>
        <SegmentedControl value={tab} onChange={changeTab}>
          <SegmentedControl.Item value="today">오늘</SegmentedControl.Item>
          <SegmentedControl.Item value="week">주간</SegmentedControl.Item>
          <SegmentedControl.Item value="month">월간</SegmentedControl.Item>
        </SegmentedControl>
      </div>

      {tab === 'today' ? (
        <TodayTab
          board={board}
          checked={checked}
          days={days}
          content={content}
          today={today}
          onNotification={onNotification}
          onDone={onDone}
          showHome={showHome}
        />
      ) : (
        <StatsPanel board={board} record={record} period={tab} offset={offsets[tab]} today={today} onMove={(offset) => move(tab, offset)} />
      )}

      {hasHistory && (
        <div key="banner" style={{ padding: '24px 0 40px' }}>
          <AdBanner adGroupId={AD_GROUPS.bannerToday} />
        </div>
      )}
    </>
  );
}

interface TodayTabProps {
  board: Board;
  checked: ReadonlySet<number>;
  days: number;
  content: Content;
  today: string;
  onNotification?: () => void;
  onDone: () => void;
  showHome: boolean;
}

/** 오늘 탭: 날짜 줄 · 격려 문구 · 오늘 체크한 실천을 세부 목표별로. 하나도 없으면 안내만 (탭·뒤로가기로 나갈 수 있어요) */
function TodayTab({ board, checked, days, content, today, onNotification, onDone, showHome }: TodayTabProps) {
  if (checked.size === 0) {
    return (
      <div style={{ padding: '32px 24px 8px', textAlign: 'center' }}>
        <Text typography="t6" color={colors.grey700} display="block">
          오늘 한 실천을 체크해 보세요
        </Text>
        <Text typography="t7" color={colors.grey600} display="block" style={{ marginTop: 6 }}>
          세부 목표 화면에서 실천 칸을 누르면 여기에 모여요
        </Text>
        {showHome && (
          <div style={{ marginTop: 20 }}>
            <Button size="medium" color="dark" variant="weak" onClick={onDone}>
              홈으로
            </Button>
          </div>
        )}
      </div>
    );
  }

  const groups = checkinGroups(board)
    .map((g) => ({ ...g, items: g.items.filter((item) => checked.has(item.index)) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <div style={{ padding: '0 24px 16px' }}>
        <Text typography="t7" color={colors.grey600} display="block">
          {formatDateLabel(today)} · {days}일째 · {checked.size}개 실천
        </Text>
        <Text typography="t6" color={colors.grey800} fontWeight="semibold" display="block" style={{ marginTop: 4 }}>
          {cheerFor(content, today)}
        </Text>
      </div>
      {onNotification && (
        <div style={{ padding: '0 20px 16px' }}>
          <Button display="block" size="medium" color="dark" variant="weak" onClick={onNotification}>
            매일 저녁 알림 받기
          </Button>
        </div>
      )}
      <div style={{ paddingBottom: 8 }}>
        {groups.map((group) => (
          <section key={group.subIndex}>
            <ListHeader
              title={
                <ListHeader.TitleParagraph typography="t5" fontWeight="bold" color={colors.grey800}>
                  {group.title}
                </ListHeader.TitleParagraph>
              }
            />
            <List>
              {group.items.map((item) => (
                <ListRow key={item.index} contents={<ListRow.Texts type="1RowTypeA" top={item.text} />} />
              ))}
            </List>
          </section>
        ))}
      </div>
    </>
  );
}
