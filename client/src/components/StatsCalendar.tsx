import { colors } from '@toss/tds-colors';
import type { CSSProperties } from 'react';

import { heatLevel, monthCells, WEEKDAY_LABELS, type DayCount, type PeriodRange } from '../lib/stats';
import { brandColor, withAlpha } from '../theme';
import './stats.css';

type Level = 0 | 1 | 2 | 3;

/**
 * 진하기 4단계 색. 틴트만으로는 옆 단계와 구분이 약해서(1.2~1.6:1) 체크한 날엔 날짜 아래 점(1~3개)을 함께 그려요 — 색에만 기대지 않게.
 * 날짜 글자 대비는 모두 4.5:1 이상(grey700/grey100 6.5, grey900/20% 12.4, grey900/55% 7.6, 흰 글자/브랜드 4.57).
 */
const LEVEL_STYLE: Record<Level, CSSProperties> = {
  0: { background: colors.grey100, color: colors.grey700 },
  1: { background: withAlpha(brandColor, 0.2), color: colors.grey900 },
  2: { background: withAlpha(brandColor, 0.55), color: colors.grey900 },
  3: { background: brandColor, color: colors.white, fontWeight: 600 },
};

const LEGEND: Array<{ level: Level; label: string }> = [
  { level: 0, label: '0개' },
  { level: 1, label: '1~2개' },
  { level: 2, label: '3~5개' },
  { level: 3, label: '6개 이상' },
];

function Dots({ level, onBrand }: { level: Level; onBrand: boolean }) {
  if (level === 0) return null;
  return (
    <span className="sc-dots">
      {Array.from({ length: level }, (_, i) => (
        <i key={i} style={{ background: onBrand ? colors.white : brandColor }} />
      ))}
    </span>
  );
}

interface StatsCalendarProps {
  range: PeriodRange;
  daily: DayCount[];
  today: string;
  /** 스크린리더용 요약 (달력 칸은 하나씩 읽지 않아요) */
  summary: string;
}

/** 월간 탭 달력: 날짜 칸이 그날 체크 수만큼 진해지고 점이 늘어요. 오늘은 테두리, 아직 오지 않은 날은 흰 칸. */
export function StatsCalendar({ range, daily, today, summary }: StatsCalendarProps) {
  const counts = new Map(daily.map((d) => [d.date, d.count]));
  return (
    <div>
      <div className="sc" role="img" aria-label={summary}>
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="sc-head" style={{ color: colors.grey600 }} aria-hidden>
            {label}
          </span>
        ))}
        {monthCells(range).map((date, i) => {
          if (date === null) return <span key={`blank-${i}`} aria-hidden />;
          const future = date > today;
          const level: Level = future ? 0 : heatLevel(counts.get(date) ?? 0);
          const style: CSSProperties = future
            ? { background: colors.white, color: colors.grey600, boxShadow: `inset 0 0 0 1px ${colors.grey200}` }
            : { ...LEVEL_STYLE[level] };
          if (date === today) style.boxShadow = `inset 0 0 0 2px ${colors.grey900}`;
          return (
            <span key={date} className="sc-cell" style={style} aria-hidden>
              <span className="sc-day">{Number(date.slice(8))}</span>
              <Dots level={level} onBrand={level === 3} />
            </span>
          );
        })}
      </div>
      <div className="sc-legend" style={{ color: colors.grey600 }} aria-hidden>
        {LEGEND.map(({ level, label }) => (
          <span key={level}>
            <i className="sc-swatch" style={LEVEL_STYLE[level]}>
              <Dots level={level} onBrand={level === 3} />
            </i>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
