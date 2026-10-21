import { SegmentedControl, Top } from '@toss/tds-mobile';
import { useEffect, useRef, useState } from 'react';

import { AD_GROUPS } from '../ads/config';
import { AdBanner } from '../components/AdBanner';
import { BoardDashboard } from '../components/records/BoardDashboard';
import { CalendarDashboard } from '../components/records/CalendarDashboard';
import { ReportStory } from '../components/records/ReportStory';
import { WEEKDAY_WINDOWS, type RecordContext } from '../components/records/shared';
import {
  BadgesDashboard,
  EmptyLine,
  ReviewDashboard,
  ScoreDashboard,
  StampsDashboard,
  StreakDashboard,
  TotalDashboard,
  WeekdayDashboard,
} from '../components/records/SimpleDashboards';
import '../components/records/records.css';
import type { Content } from '../content';
import type { Board } from '../lib/mandalart';
import { checksIn, checksOn, lastWeekReport, monthDay, weekdaySummary, type WeekdayWindow } from '../lib/records';
import { dateKey, type CheckinRecord } from '../lib/state';
import { computeStats, datesBetween, periodRange, type StatsPeriod } from '../lib/stats';
import { RECORD_WIDGETS, type RecordWidgetId } from '../lib/widgets';

const PERIODS: Array<[StatsPeriod, string]> = [
  ['week', '주'],
  ['month', '월'],
  ['year', '년'],
];

/** 기간이 있는 대시보드와 처음 기간(1년 잔디 위젯은 달력을 '년'으로 열어요) */
const FIRST_PERIOD: Partial<Record<RecordWidgetId, StatsPeriod>> = { week: 'week', board: 'month', calendar: 'month', year: 'year' };

export interface StatsViewInfo {
  widget: RecordWidgetId;
  period: StatsPeriod | WeekdayWindow;
  offset: number;
  activeDays: number;
  checks: number;
}

interface RecordScreenProps {
  widget: RecordWidgetId;
  board: Board;
  record: CheckinRecord | undefined;
  content: Content;
  /** 지난주 리포트 ✕ — 판으로 */
  onClose: () => void;
  /** 지난주 리포트 마지막 장 '글로 공유하기' */
  onShareReport: (text: string) => void;
  /** 기간이 있는 대시보드를 열거나 기간·옮기기를 바꿨을 때 (분석 stats_view) */
  onStatsView?: (info: StatsViewInfo) => void;
}

/**
 * 위젯을 눌러 여는 대시보드 (3.0, `#/record/<위젯>`). 머리는 TDS Top(제목 위 부제 '기록', 제목은 대시보드 이름),
 * 기간이 있으면 그 아래 TDS SegmentedControl(주·월·년 / 요일별은 4주·8주·전체)과 '‹ 기간 ›'. 맨 아래 배너 1개(기록이 있을 때만).
 * 지난주 리포트만 전체 화면 스토리. 대시보드를 열 때 전면 광고는 없어요(노출 정책 UX 원칙 2).
 */
export function RecordScreen({ widget, board, record, content, onClose, onShareReport, onStatsView }: RecordScreenProps) {
  const today = dateKey();
  const ctx: RecordContext = { board, record, today };
  const [period, setPeriod] = useState<StatsPeriod>(FIRST_PERIOD[widget] ?? 'month');
  const [offset, setOffset] = useState(0);
  const [span, setSpan] = useState<WeekdayWindow>('8w');
  const hasHistory = record !== undefined && Object.values(record.days).some((list) => list.length > 0);
  const range = periodRange(period, today, offset);
  const periodic = widget in FIRST_PERIOD;

  // stats_view: 기간이 있는 대시보드를 열 때와 기간·옮기기를 바꿀 때
  const statsView = useRef(onStatsView);
  statsView.current = onStatsView;
  useEffect(() => {
    if (!statsView.current) return;
    if (periodic) {
      const stats = computeStats(board, record, range, today);
      statsView.current({ widget, period, offset, activeDays: stats.activeDays, checks: stats.checks });
    } else if (widget === 'weekday') {
      const from = weekdaySummary(record, today, span).from;
      const dates = from ? datesBetween(from, today) : [];
      statsView.current({ widget, period: span, offset: 0, activeDays: dates.filter((d) => checksOn(record, d).length > 0).length, checks: checksIn(record, dates) });
    }
    // 기간을 바꿀 때만(기록이 바뀔 때마다 보내지 않아요)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget, period, offset, span]);

  const report = widget === 'report' ? lastWeekReport(board, record, today) : null;
  if (report?.kind === 'ready') {
    return <ReportStory board={board} report={report.report} onClose={onClose} onShare={onShareReport} />;
  }

  const move = (next: number) => setOffset(Math.min(0, next));
  let body: JSX.Element;
  switch (widget) {
    case 'streak':
      body = <StreakDashboard {...ctx} />;
      break;
    case 'week':
      body = <StampsDashboard {...ctx} range={range} onMove={move} />;
      break;
    case 'board':
      body = <BoardDashboard {...ctx} range={range} onMove={move} />;
      break;
    case 'calendar':
    case 'year':
      body = <CalendarDashboard {...ctx} content={content} range={range} onMove={move} />;
      break;
    case 'badges':
      body = <BadgesDashboard {...ctx} />;
      break;
    case 'score':
      body = <ScoreDashboard {...ctx} />;
      break;
    case 'weekday':
      body = <WeekdayDashboard {...ctx} span={span} />;
      break;
    case 'review':
      body = <ReviewDashboard {...ctx} />;
      break;
    case 'report':
      // 지난주 리포트는 위젯을 누를 수 없을 때(딥링크로만 와요): 언제 나오는지 한 줄
      body = <EmptyLine text={report?.kind === 'first' ? `한 주를 다 쓰면 ${monthDay(report.nextMonday)} 월요일에 첫 리포트가 나와요` : '지난주는 쉬어 갔어요. 이번 주 리포트는 다음 월요일에 나와요'} />;
      break;
    default:
      body = <TotalDashboard {...ctx} />;
  }

  return (
    <>
      <Top subtitleTop={<Top.SubtitleParagraph size={15}>기록</Top.SubtitleParagraph>} title={<Top.TitleParagraph size={22}>{RECORD_WIDGETS[widget].dashboard}</Top.TitleParagraph>} />
      {periodic && (
        <div style={{ paddingBottom: 8 }}>
          <SegmentedControl
            value={period}
            onChange={(value: string) => {
              if (value !== 'week' && value !== 'month' && value !== 'year') return;
              setPeriod(value);
              setOffset(0);
            }}
          >
            {PERIODS.map(([value, label]) => (
              <SegmentedControl.Item key={value} value={value}>
                {label}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl>
        </div>
      )}
      {widget === 'weekday' && (
        <div style={{ paddingBottom: 8 }}>
          <SegmentedControl
            value={span}
            onChange={(value: string) => {
              if (value === '4w' || value === '8w' || value === 'all') setSpan(value);
            }}
          >
            {WEEKDAY_WINDOWS.map(([value, label]) => (
              <SegmentedControl.Item key={value} value={value}>
                {label}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl>
        </div>
      )}
      {body}
      {hasHistory ? (
        <div key="banner" style={{ padding: '24px 0 40px' }}>
          <AdBanner adGroupId={AD_GROUPS.bannerToday} />
        </div>
      ) : (
        <div style={{ height: 40 }} />
      )}
    </>
  );
}
