import { colors } from '@toss/tds-colors';
import { Text } from '@toss/tds-mobile';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

import { cheerFor, type Content } from '../../content';
import { checkinGroups } from '../../lib/checkin';
import { SUB_COUNT } from '../../lib/mandalart';
import { bestMonth, bestRun, checksIn, checksOn, monthDay, monthTotals, subOf, subsTouched, yearGrass } from '../../lib/records';
import { streak } from '../../lib/state';
import { WEEKDAY_LABELS, computeStats, firstRecordDate, heatLevel, monthCells, weekdayLabel, type PeriodRange } from '../../lib/stats';
import { brandColor, stampInk, withAlpha } from '../../theme';
import { PeriodNav } from './PeriodNav';
import { DAY_HEAT, type RecordContext } from './shared';

type DayProps = RecordContext & { content: Content; date: string };

/** 고른 날의 실천(세부 목표별) — 오늘이면 지금 '오늘' 탭이 하던 일: 날짜 · 응원 한 줄 · 오늘 한 실천 */
function DayCard({ board, record, today, content, date }: DayProps) {
  const checked = new Set(checksOn(record, date));
  const groups = checkinGroups(board)
    .map((g) => ({ ...g, items: g.items.filter((item) => checked.has(item.index)) }))
    .filter((g) => g.items.length > 0);
  const isToday = date === today;
  return (
    <div className="rc-card" aria-live="polite">
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
        {monthDay(date)} {weekdayLabel(date)}요일{isToday ? ' · 오늘' : ''} · 도장 {checked.size}개
      </p>
      {isToday && checked.size > 0 && (
        <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: '20px', fontWeight: 600, color: colors.grey800 }}>{cheerFor(content, today)}</p>
      )}
      {checked.size === 0 ? (
        <p style={{ margin: '6px 0 0', fontSize: 14, color: colors.grey700 }}>{date > today ? '아직 오지 않은 날이에요' : isToday ? '오늘 한 실천을 체크해 보세요' : '이날은 쉬어 갔어요'}</p>
      ) : (
        <ul className="rc-rows" style={{ marginTop: 10, gap: 8 }}>
          {groups.flatMap((g) =>
            g.items.map((item) => (
              <li key={item.index} style={{ justifyContent: 'flex-start', gap: 10 }}>
                <span style={{ flex: '0 0 84px', fontSize: 12, color: colors.grey600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</span>
                <span style={{ color: colors.grey900, minWidth: 0 }}>{item.text}</span>
              </li>
            )),
          )}
        </ul>
      )}
    </div>
  );
}

/** 주: 요일마다 고리 = 그날 손댄 세부 목표 수/8 (A3) */
function WeekRings(props: RecordContext & { content: Content; range: PeriodRange }) {
  const { record, today, range } = props;
  const [selected, setSelected] = useState(() => (range.dates.includes(today) ? today : range.dates[0]));
  const r = 13;
  const length = 2 * Math.PI * r;
  const stats = computeStats(props.board, record, range, today);
  const subsWeek = new Set(range.dates.flatMap((date) => checksOn(record, date).map(subOf))).size;
  return (
    <>
      <div className="rc-days" style={{ padding: '8px 16px 0' }}>
        {range.dates.map((date) => {
          const touched = subsTouched(checksOn(record, date));
          const future = date > today;
          const on = date === selected;
          return (
            <button
              key={date}
              type="button"
              className="rc-month-day"
              aria-label={`${monthDay(date)} ${weekdayLabel(date)}요일, 세부 목표 ${SUB_COUNT}개 중 ${touched}개`}
              aria-pressed={on}
              style={{ background: on ? withAlpha(brandColor, 0.1) : undefined, padding: '6px 2px' }}
              onClick={() => setSelected(date)}
            >
              <span style={{ color: date === today ? stampInk : colors.grey600, fontWeight: date === today ? 700 : 400 }}>{date === today ? '오늘' : weekdayLabel(date)}</span>
              <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
                <circle cx="16" cy="16" r={r} fill="none" stroke={future ? colors.grey100 : colors.grey200} strokeWidth="4" strokeDasharray={future ? '2 3' : undefined} />
                {touched > 0 && (
                  <circle
                    cx="16"
                    cy="16"
                    r={r}
                    fill="none"
                    stroke={brandColor}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${(touched / SUB_COUNT) * length} ${length}`}
                    transform="rotate(-90 16 16)"
                  />
                )}
              </svg>
              <span style={{ color: future ? colors.grey400 : colors.grey800 }}>{Number(date.slice(8))}</span>
            </button>
          );
        })}
      </div>
      <p className="rc-note" style={{ marginTop: 8 }}>
        고리 = 그날 손댄 세부 목표 수(8개 중)
      </p>
      <DayCard {...props} date={selected} />
      <div className="rc-card">
        <ul className="rc-rows">
          <li>
            <span>도장</span>
            <b>{stats.checks}개</b>
          </li>
          <li>
            <span>실천한 날</span>
            <b>{stats.activeDays}일</b>
          </li>
          <li>
            <span>손댄 세부 목표</span>
            <b>{subsWeek}개</b>
          </li>
        </ul>
      </div>
    </>
  );
}

/** 월: 날짜마다 그날 도장 수가 찍힌 도장 달력 (A1). 오늘이 기본으로 골라져 있어요 */
function MonthStamps(props: RecordContext & { content: Content; range: PeriodRange }) {
  const { board, record, today, range } = props;
  const [selected, setSelected] = useState(() => (range.dates.includes(today) ? today : range.dates[range.dates.length - 1] <= today ? range.dates[range.dates.length - 1] : range.dates[0]));
  const stats = computeStats(board, record, range, today);
  const current = range.offset === 0;
  return (
    <>
      <p style={{ margin: 0, padding: '0 24px 10px', fontSize: 14, color: colors.grey700 }}>
        실천한 날 <b style={{ color: colors.grey900 }}>{stats.activeDays}일</b> · 도장 <b style={{ color: colors.grey900 }}>{stats.checks}개</b>
        {current && (
          <>
            {' '}
            · 지금 <b style={{ color: stampInk }}>{streak(record, today)}일째</b>
          </>
        )}
      </p>
      <div className="rc-month" role="group" aria-label={`${range.label} 도장 달력, ${stats.activeDays}일 실천, 도장 ${stats.checks}개`}>
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="rc-month-head" aria-hidden>
            {label}
          </span>
        ))}
        {monthCells(range).map((date, i) => {
          if (date === null) return <span key={`b${i}`} aria-hidden />;
          const count = checksOn(record, date).length;
          const future = date > today;
          const level = heatLevel(count);
          const on = date === selected;
          const stamp: CSSProperties =
            count > 0
              ? { border: `2px solid ${level >= 3 ? stampInk : withAlpha(brandColor, level === 2 ? 0.85 : 0.55)}`, background: level >= 3 ? withAlpha(brandColor, 0.16) : colors.white, color: stampInk }
              : { background: 'transparent' };
          return (
            <button
              key={date}
              type="button"
              className="rc-month-day"
              aria-label={`${monthDay(date)}, 도장 ${count}개`}
              aria-pressed={on}
              disabled={future}
              style={{ background: on ? withAlpha(brandColor, 0.1) : undefined, boxShadow: date === today ? `inset 0 0 0 1.5px ${colors.grey900}` : undefined, cursor: future ? 'default' : 'pointer' }}
              onClick={() => setSelected(date)}
            >
              <span style={{ color: future ? colors.grey400 : colors.grey700, fontWeight: date === today ? 700 : 400 }}>{Number(date.slice(8))}</span>
              <i style={stamp}>{count > 0 ? count : ''}</i>
            </button>
          );
        })}
      </div>
      <DayCard {...props} date={selected} />
    </>
  );
}

/** 년: 1년 잔디 + 지금 연속·최장 연속·가장 잘한 달 + 달마다 (A2) */
function YearGrass({ record, today, range }: RecordContext & { range: PeriodRange }) {
  const grass = yearGrass(record, range, today);
  const dates = range.dates.filter((date) => date <= today);
  const activeDays = dates.filter((date) => checksOn(record, date).length > 0).length;
  const checks = checksIn(record, dates);
  const first = firstRecordDate(record);
  const year = range.start.slice(0, 4);
  const totals = monthTotals(record, year);
  const maxMonth = Math.max(1, ...totals);
  const best = bestMonth(record);
  const months = totals.map((total, m) => ({ m, total })).filter((x) => x.total > 0).reverse();
  // 잔디는 1월부터 그려서 가로로 길어요 → 처음엔 오늘이 든 주가 오른쪽 끝에 오게(지난해면 12월 끝). 한 주 = 칸 11px + 사이 3px
  const scroller = useRef<HTMLDivElement>(null);
  const todayWeek = grass.weeks.findIndex((week) => week.some((cell) => cell.date === today));
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollLeft = todayWeek >= 0 ? 20 + (todayWeek + 1) * 14 + 8 - el.clientWidth : el.scrollWidth;
  }, [range.start, todayWeek]);
  return (
    <>
      <div className="rc-head">
        <p className="rc-head-label">
          {range.label}
          {first && first.startsWith(year) ? ` · ${monthDay(first)} 첫 도장부터` : ''}
        </p>
        <p className="rc-head-title">
          {activeDays}일 동안 도장 {checks}개를 찍었어요
        </p>
      </div>
      <div ref={scroller} className="rc-grass-scroll" style={{ marginTop: 14 }}>
        <div className="rc-grass" role="img" aria-label={`${range.label} 잔디, ${activeDays}일 실천`}>
          {grass.weeks.map((week, w) => {
            const label = grass.months.find((m) => m.week === w)?.label;
            return [
              <em key={`m${w}`} aria-hidden>
                {label ?? ''}
              </em>,
              ...week.map((cell) => (
                <i key={cell.date} aria-hidden style={{ background: cell.out ? 'transparent' : cell.future ? colors.grey50 : DAY_HEAT[heatLevel(cell.count)] }} />
              )),
            ];
          })}
        </div>
      </div>
      <div className="rc-legend" aria-hidden>
        <span style={{ marginRight: 2 }}>0개</span>
        {DAY_HEAT.map((color) => (
          <i key={color} style={{ background: color }} />
        ))}
        <span style={{ marginLeft: 2 }}>6개 이상</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, padding: '16px 20px 0' }}>
        {[
          ['지금 연속', `${streak(record, today)}일`],
          ['최장 연속', `${bestRun(record)?.length ?? 0}일`],
          ['가장 잘한 달', best ? `${best.slice(0, 4) === year ? '' : `${best.slice(2, 4)}년 `}${Number(best.slice(5))}월` : '–'],
        ].map(([label, value]) => (
          <div key={label} style={{ padding: '12px 12px', borderRadius: 14, background: colors.grey50 }}>
            <Text typography="t7" color={colors.grey700} display="block">
              {label}
            </Text>
            <span style={{ display: 'block', marginTop: 4, fontSize: 18, fontWeight: 700, color: label === '지금 연속' ? stampInk : colors.grey900 }}>{value}</span>
          </div>
        ))}
      </div>
      {months.length > 0 && (
        <>
          <h2 className="rc-section-title">달마다 찍은 도장</h2>
          <ul className="rc-rows" style={{ padding: '0 24px' }}>
            {months.map(({ m, total }) => (
              <li key={m} style={{ alignItems: 'center' }}>
                <span style={{ flex: '0 0 36px', color: colors.grey900 }}>{m + 1}월</span>
                <span className="rc-meter" style={{ flex: 1 }} aria-hidden>
                  <i style={{ width: `${Math.round((total / maxMonth) * 100)}%`, background: withAlpha(brandColor, total === maxMonth ? 1 : 0.55) }} />
                </span>
                <b style={{ flex: '0 0 48px' }}>{total}개</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/** 달력 대시보드: 주 = 요일 고리, 월 = 도장 달력, 년 = 1년 잔디 */
export function CalendarDashboard(props: RecordContext & { content: Content; range: PeriodRange; onMove: (offset: number) => void }) {
  const { record, range, onMove } = props;
  return (
    <>
      <PeriodNav range={range} record={record} onMove={onMove} />
      {range.period === 'week' ? <WeekRings key={range.start} {...props} /> : range.period === 'month' ? <MonthStamps key={range.start} {...props} /> : <YearGrass {...props} />}
    </>
  );
}
