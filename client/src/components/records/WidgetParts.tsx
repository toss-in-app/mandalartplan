import { colors } from '@toss/tds-colors';
import type { CSSProperties } from 'react';

import { CENTER, ringIndex } from '../../lib/mandalart';
import { checksOn, relativeLevel } from '../../lib/records';
import type { CheckinRecord } from '../../lib/state';
import { firstRecordDate, heatLevel, monthRange, weekdayIndex } from '../../lib/stats';
import { brandColor, stampInk, withAlpha } from '../../theme';
import { DAY_HEAT, HEAT } from './shared';

/** 기록 위젯 안 작은 그림들(3.0). 그림은 aria-hidden 이고, 숫자는 위젯 이름(aria-label)으로 읽어요 */

export function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.grey500} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function Label({ text, chevron }: { text: string; chevron: boolean }) {
  return (
    <span className="rc-widget-label">
      {text}
      {chevron && <Chevron />}
    </span>
  );
}

/** 이번 달 세부 목표 3×3(가운데 = 핵심 목표) */
export function MiniBoard({ subs }: { subs: number[] }) {
  const max = Math.max(0, ...subs);
  return (
    <span className="rc-mini3" aria-hidden>
      {Array.from({ length: 9 }, (_, cell) => (
        <i key={cell} style={{ background: cell === CENTER ? brandColor : HEAT[relativeLevel(subs[ringIndex(cell)], max)] }} />
      ))}
    </span>
  );
}

/** 이번 달 점 달력(월요일 시작) */
export function MiniCalendar({ record, today }: { record: CheckinRecord | undefined; today: string }) {
  const month = monthRange(today, 0);
  const first = firstRecordDate(record);
  const lead = weekdayIndex(month.start);
  return (
    <span className="rc-minical" aria-hidden>
      {Array.from({ length: lead }, (_, i) => (
        <i key={`b${i}`} style={{ background: 'transparent' }} />
      ))}
      {month.dates.map((date) => {
        const count = checksOn(record, date).length;
        const quiet = date > today || first === null || date < first;
        const style: CSSProperties = { background: quiet && count === 0 ? colors.grey100 : DAY_HEAT[heatLevel(count)] };
        if (date === today) style.boxShadow = `0 0 0 1.5px ${colors.white}, 0 0 0 3px ${colors.grey900}`;
        return <i key={date} style={style} />;
      })}
    </span>
  );
}

export function MiniBars({ values, current, future = () => false }: { values: number[]; current: number; future?: (i: number) => boolean }) {
  const max = Math.max(1, ...values);
  return (
    <span className="rc-widget-foot rc-minibars" aria-hidden>
      {values.map((value, i) => {
        if (future(i) || value === 0) return <i key={i} style={{ height: 3, background: colors.grey200 }} />;
        return <i key={i} style={{ height: Math.max(4, Math.round((value / max) * 28)), background: i === current ? stampInk : withAlpha(brandColor, 0.4) }} />;
      })}
    </span>
  );
}

export function Meter({ ratio }: { ratio: number }) {
  return (
    <span className="rc-widget-foot" aria-hidden>
      <span className="rc-meter" style={{ display: 'block' }}>
        <i style={{ width: `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`, background: brandColor }} />
      </span>
    </span>
  );
}
