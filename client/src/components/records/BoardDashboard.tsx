import { colors } from '@toss/tds-colors';
import { useState } from 'react';

import { ACTION_COUNT, CENTER, ringIndex } from '../../lib/mandalart';
import { actionCounts, actionTitle, checksIn, checksOn, compareWithPrevious, monthDay, relativeLevel, subActiveDays, subTitle, subTotals } from '../../lib/records';
import { computeStats, type PeriodRange } from '../../lib/stats';
import { brandColor, stampInk, withAlpha } from '../../theme';
import { PeriodNav } from './PeriodNav';
import { HEAT, scopeWord, type RecordContext } from './shared';
import { EmptyLine } from './SimpleDashboards';

/** 고른 실천을 한 날짜: '10월 1일 · 2일 · 5일 · 11월 3일' */
function datesText(dates: string[]): string {
  let month = '';
  return dates
    .map((date) => {
      const m = date.slice(5, 7);
      const label = m === month ? `${Number(date.slice(8))}일` : monthDay(date);
      month = m;
      return label;
    })
    .join(' · ');
}

/** 주: 세부 목표 3×3 이 이번 주 그 가지에 도장을 찍은 날만큼 차올라요(B2) */
function WeekFill({ board, record, today, range }: RecordContext & { range: PeriodRange }) {
  const dates = range.dates.filter((date) => date <= today);
  const elapsed = dates.length;
  const days = subActiveDays(record, dates);
  const daily = days.filter((d) => elapsed > 0 && d === elapsed).length;
  const touched = days.filter((d) => d > 0).length;
  const cmp = compareWithPrevious(record, 'week', today);
  const scope = scopeWord(range);
  return (
    <>
      <div className="rc-head">
        <p className="rc-head-label">
          {scope} · {range.label}
        </p>
        <p className="rc-head-title">{daily > 0 ? `가지 8개 중 ${daily}개를 매일 이었어요` : `가지 8개 중 ${touched}개에 도장을 찍었어요`}</p>
        <p className="rc-head-text">{scope} 그 가지에 도장을 찍은 날만큼 칸이 차올라요</p>
      </div>
      <div
        className="rc-three"
        style={{ marginTop: 16 }}
        role="img"
        aria-label={`세부 목표마다 도장을 찍은 날: ${days.map((d, s) => `${subTitle(board, s)} ${d}일`).join(', ')}`}
      >
        {Array.from({ length: 9 }, (_, cell) => {
          if (cell === CENTER) {
            return (
              <span key={cell} aria-hidden style={{ background: brandColor, color: colors.white, fontSize: 13, fontWeight: 700, lineHeight: '18px' }}>
                {board.goal.trim() || '핵심 목표'}
              </span>
            );
          }
          const s = ringIndex(cell);
          const d = days[s];
          const full = elapsed > 0 && d === elapsed;
          const level = d === 0 ? 0 : Math.max(1, relativeLevel(d, elapsed));
          // 가장 진한 칸(브랜드 색)만 흰 글자 — 그 아래 단계는 grey900 이 대비가 더 좋아요
          const ink = level === 4 ? colors.white : colors.grey900;
          return (
            <span key={cell} aria-hidden style={{ background: HEAT[level], color: ink }}>
              <span className="rc-clamp2" style={{ fontSize: 14, lineHeight: '19px', fontWeight: 700 }}>
                {subTitle(board, s)}
              </span>
              <span style={{ fontSize: 12, color: d === 0 ? colors.grey600 : ink }}>{d === 0 ? '아직 0일' : `${elapsed}일 중 ${d}일`}</span>
              {full && (
                <span
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 22,
                    height: 22,
                    boxSizing: 'border-box',
                    borderRadius: '50%',
                    border: `1.5px solid ${level === 4 ? colors.white : stampInk}`,
                    transform: 'rotate(-12deg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 7,
                    fontWeight: 700,
                    color: level === 4 ? colors.white : stampInk,
                  }}
                >
                  완료
                </span>
              )}
            </span>
          );
        })}
      </div>
      <div className="rc-card">
        <ul className="rc-rows">
          <li>
            <span>{scope} 도장</span>
            <b>{checksIn(record, dates)}개</b>
          </li>
          {range.offset === 0 && cmp.known && (
            <li>
              <span>지난주 이맘때</span>
              <b>{cmp.before}개</b>
            </li>
          )}
        </ul>
      </div>
    </>
  );
}

/** 월·년: 9×9 를 그 기간에 실천을 한 만큼 칠해요(B1). 실천 칸을 누르면 그 실천을 한 날짜가 아래에 펼쳐져요 */
function NineHeat({ board, record, today, range }: RecordContext & { range: PeriodRange }) {
  const [picked, setPicked] = useState<number | null>(null);
  const dates = range.dates.filter((date) => date <= today);
  const counts = actionCounts(record, dates);
  const subs = subTotals(counts);
  const max = Math.max(0, ...counts);
  const maxSub = Math.max(0, ...subs);
  const total = counts.reduce((a, b) => a + b, 0);
  const top = counts.reduce((best, value, i) => (value > counts[best] ? i : best), 0);
  const blank = board.subs.reduce((sum, sub, s) => sum + sub.actions.filter((text, a) => text.trim() && counts[s * ACTION_COUNT + a] === 0).length, 0);
  const pickedDates = picked === null ? [] : dates.filter((date) => checksOn(record, date).includes(picked));
  const scope = scopeWord(range);
  return (
    <>
      <div className="rc-head">
        <p className="rc-head-label">
          {range.label} · 도장 {total}개
        </p>
        <p className="rc-head-title">{scope} 만다라트</p>
        <p className="rc-head-text">자주 한 실천일수록 칸이 진해져요</p>
      </div>
      <div className="rc-nine" style={{ marginTop: 14 }} role="group" aria-label={`${range.label} 만다라트, 가장 많이 한 실천 ${actionTitle(board, top)} ${counts[top]}번`}>
        {Array.from({ length: 9 }, (_, block) => {
          if (block === CENTER) {
            return (
              <span key={block} className="rc-nine-block" style={{ background: withAlpha(brandColor, 0.08) }} aria-hidden>
                {Array.from({ length: 9 }, (_, cell) => {
                  if (cell === CENTER) {
                    return (
                      <span key={cell} className="rc-nine-cell" style={{ background: brandColor, color: colors.white }}>
                        {board.goal.trim().slice(0, 6) || '목표'}
                      </span>
                    );
                  }
                  const s = ringIndex(cell);
                  const level = relativeLevel(subs[s], maxSub);
                  return (
                    <span key={cell} className="rc-nine-cell" style={{ background: HEAT[level], color: level === 4 ? colors.white : colors.grey900 }}>
                      {subTitle(board, s).slice(0, 4)}
                    </span>
                  );
                })}
              </span>
            );
          }
          const s = ringIndex(block);
          return (
            <span key={block} className="rc-nine-block" style={{ background: colors.white }}>
              {Array.from({ length: 9 }, (_, cell) => {
                if (cell === CENTER) {
                  return (
                    <span key={cell} className="rc-nine-cell" aria-hidden style={{ background: colors.white, color: colors.grey800, boxShadow: `inset 0 0 0 1.5px ${colors.grey300}` }}>
                      {subTitle(board, s).slice(0, 4)}
                    </span>
                  );
                }
                const index = s * ACTION_COUNT + ringIndex(cell);
                const text = board.subs[s]?.actions[ringIndex(cell)]?.trim();
                const background = HEAT[relativeLevel(counts[index], max)];
                if (!text && counts[index] === 0) return <span key={cell} className="rc-nine-cell" aria-hidden style={{ background: colors.grey50 }} />;
                return (
                  <button
                    key={cell}
                    type="button"
                    className="rc-nine-cell"
                    aria-label={`${actionTitle(board, index)}, ${counts[index]}번`}
                    aria-pressed={picked === index}
                    style={{ background, boxShadow: picked === index ? `inset 0 0 0 2px ${colors.grey900}` : undefined }}
                    onClick={() => setPicked(picked === index ? null : index)}
                  />
                );
              })}
            </span>
          );
        })}
      </div>
      <div className="rc-legend" aria-hidden>
        <span style={{ marginRight: 2 }}>적게</span>
        {HEAT.map((color) => (
          <i key={color} style={{ background: color }} />
        ))}
        <span style={{ marginLeft: 2 }}>많이</span>
      </div>
      {picked !== null && (
        <div className="rc-card" aria-live="polite">
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
            {actionTitle(board, picked)} · {counts[picked]}번
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: '20px', color: colors.grey700 }}>{pickedDates.length > 0 ? datesText(pickedDates) : `${scope}엔 아직 안 했어요`}</p>
        </div>
      )}
      <div className="rc-card">
        <ul className="rc-rows">
          <li>
            <span>가장 진한 칸</span>
            <b>{counts[top] > 0 ? `${actionTitle(board, top)} · ${counts[top]}번` : '–'}</b>
          </li>
          <li>
            <span>아직 하얀 칸</span>
            <b>{blank}개</b>
          </li>
        </ul>
      </div>
    </>
  );
}

/** 만다라트 대시보드: 주 = 3×3 차오름, 월·년 = 9×9 진하기 */
export function BoardDashboard(props: RecordContext & { range: PeriodRange; onMove: (offset: number) => void }) {
  const { record, today, range, onMove, board } = props;
  const empty = computeStats(board, record, range, today).checks === 0;
  return (
    <>
      <PeriodNav range={range} record={record} onMove={onMove} />
      {empty ? (
        <EmptyLine text={range.offset === 0 ? `${scopeWord(range)} 첫 도장을 찍어 봐요` : '이 기간은 쉬어 갔어요'} />
      ) : range.period === 'week' ? (
        <WeekFill {...props} />
      ) : (
        <NineHeat key={range.start} {...props} />
      )}
    </>
  );
}
