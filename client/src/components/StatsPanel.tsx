import { colors } from '@toss/tds-colors';
import { BarChart, IconButton, List, ListHeader, ListRow, Text } from '@toss/tds-mobile';

import type { Board } from '../lib/mandalart';
import type { CheckinRecord } from '../lib/state';
import { canGoNext, canGoPrev, computeStats, periodRange, weekdayLabel, type StatsPeriod } from '../lib/stats';
import { StatsCalendar } from './StatsCalendar';
import './stats.css';

/** '안 한 실천' 은 이만큼만 보이고 나머지는 "외 N개" */
const UNTOUCHED_LIMIT = 5;

interface StatsPanelProps {
  board: Board;
  record: CheckinRecord | undefined;
  period: StatsPeriod;
  /** 0 = 이번 주(달), -1 = 지난 주(달) … */
  offset: number;
  today: string;
  onMove: (offset: number) => void;
}

function sectionTitle(title: string) {
  return (
    <ListHeader.TitleParagraph typography="t5" fontWeight="bold" color={colors.grey800}>
      {title}
    </ListHeader.TitleParagraph>
  );
}

function countText(count: number) {
  return (
    <Text typography="t6" color={colors.grey700}>
      {count}번
    </Text>
  );
}

interface NavButtonProps {
  direction: 'prev' | 'next';
  label: string;
  disabled: boolean;
  onClick: () => void;
}

/** 기간 이동 버튼. TDS IconButton + 화살표 아이콘, 터치 영역은 stats.css 에서 44px 이상으로 */
function NavButton({ direction, label, disabled, onClick }: NavButtonProps) {
  return (
    <IconButton
      name={direction === 'prev' ? 'icon-arrow-left-small-mono' : 'icon-arrow-right-small-mono'}
      variant="fill"
      className="st-nav-btn"
      color={disabled ? colors.grey300 : colors.grey800}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    />
  );
}

/**
 * 기록 화면의 주간·월간 탭 (화면 흐름 v3). 기간 이동 · 요약 3칸 · 주간 막대그래프(TDS BarChart) 또는 월간 달력 ·
 * 세부 목표별 · 많이 한 실천 · 안 한 실천. 기간에 체크가 하나도 없으면 안내 한 줄만 보여요.
 */
export function StatsPanel({ board, record, period, offset, today, onMove }: StatsPanelProps) {
  const range = periodRange(period, today, offset);
  const stats = computeStats(board, record, range, today);
  const isCurrent = offset === 0;
  const words =
    period === 'week'
      ? { prev: '지난주', next: '다음 주', scope: isCurrent ? '이번 주' : '이 주' }
      : { prev: '지난달', next: '다음 달', scope: isCurrent ? '이번 달' : '이 달' };

  const max = Math.max(1, ...stats.daily.map((d) => d.count));
  // 막대는 전부 회색 — TDS 막대 색에 브랜드 보라가 없어 다른 색을 섞지 않아요. 오늘은 요일과 막대 위 숫자로 알 수 있어요
  const bars = stats.daily.map((d) => ({
    value: d.count,
    maxValue: max,
    label: weekdayLabel(d.date),
    barAnnotation: d.future ? '' : d.count,
  }));
  const hiddenUntouched = stats.untouched.length - UNTOUCHED_LIMIT;

  return (
    <>
      <div className="st-nav">
        <NavButton direction="prev" label={words.prev} disabled={!canGoPrev(range, record)} onClick={() => onMove(offset - 1)} />
        <div className="st-nav-label">
          <Text typography="t5" fontWeight="semibold" color={colors.grey900}>
            {range.label}
          </Text>
        </div>
        <NavButton direction="next" label={words.next} disabled={!canGoNext(range)} onClick={() => onMove(offset + 1)} />
      </div>

      {stats.checks === 0 ? (
        <div style={{ padding: '32px 24px 8px', textAlign: 'center' }}>
          <Text typography="t6" color={colors.grey700} display="block">
            {isCurrent ? `${words.scope} 첫 실천을 체크해 보세요` : '이 기간은 쉬어 갔어요'}
          </Text>
        </div>
      ) : (
        <>
          <div className="st-summary">
            {[
              ['실천한 날', `${stats.activeDays}일`],
              ['체크', `${stats.checks}개`],
              ['최장 연속', `${stats.longestStreak}일`],
            ].map(([label, value]) => (
              <div key={label}>
                <Text typography="t7" color={colors.grey600} display="block">
                  {label}
                </Text>
                <span className="st-number">
                  <Text typography="t4" fontWeight="bold" color={colors.grey900} display="block">
                    {value}
                  </Text>
                </span>
              </div>
            ))}
          </div>

          {period === 'week' ? (
            <div style={{ padding: '0 20px 8px' }}>
              <BarChart height={160} data={bars} fill={{ type: 'all-bar', theme: 'default' }} />
            </div>
          ) : (
            <StatsCalendar
              range={range}
              daily={stats.daily}
              today={today}
              summary={`${range.label} 달력, ${stats.activeDays}일 실천, 체크 ${stats.checks}개`}
            />
          )}

          <ListHeader title={sectionTitle('세부 목표별')} />
          <List>
            {stats.bySub.map((sub) => (
              <ListRow key={sub.subIndex} contents={<ListRow.Texts type="1RowTypeA" top={sub.title} />} right={countText(sub.count)} />
            ))}
          </List>

          {stats.top.length > 0 && (
            <>
              <ListHeader title={sectionTitle('많이 한 실천')} />
              <List>
                {stats.top.map((action) => (
                  <ListRow key={action.index} contents={<ListRow.Texts type="1RowTypeA" top={action.text} />} right={countText(action.count)} />
                ))}
              </List>
            </>
          )}

          {stats.untouched.length > 0 && (
            <>
              <ListHeader title={sectionTitle(`${words.scope}에 안 한 실천`)} />
              <List>
                {stats.untouched.slice(0, UNTOUCHED_LIMIT).map((action) => (
                  <ListRow key={action.index} contents={<ListRow.Texts type="1RowTypeA" top={action.text} />} />
                ))}
              </List>
              {hiddenUntouched > 0 && (
                <div style={{ padding: '4px 24px 0' }}>
                  <Text typography="t7" color={colors.grey600}>
                    외 {hiddenUntouched}개
                  </Text>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
