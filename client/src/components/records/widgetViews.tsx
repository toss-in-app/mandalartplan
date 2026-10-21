import { colors } from '@toss/tds-colors';
import type { CSSProperties, ReactNode } from 'react';

import { computeBadges } from '../../lib/badges';
import {
  actionCounts,
  checksIn,
  checksOn,
  compareWithPrevious,
  cumulativeSummary,
  lastMonthReview,
  lastWeekReport,
  monthDay,
  periodBars,
  recentDays,
  scoreSummary,
  streakSummary,
  subTitle,
  subTotals,
  weekdaySummary,
  TOTAL_MILESTONES,
  type RecentDay,
} from '../../lib/records';
import { WEEKDAY_LABELS, addDays, datesBetween, heatLevel, monthRange, weekRange, weekdayIndex, yearRange } from '../../lib/stats';
import type { RecordWidgetId } from '../../lib/widgets';
import { brandColor, stampInk, withAlpha } from '../../theme';
import { CountUp } from './CountUp';
import { stagger } from './motion';
import { DAY_HEAT, type RecordContext } from './shared';
import { Label, Meter, MiniBars, MiniBoard, MiniCalendar } from './WidgetParts';

export interface WidgetView {
  /** 위젯 버튼 이름(스크린리더) — 위젯 이름 + 숫자 요약 */
  aria: string;
  /** 아직 열 대시보드가 없어요(지난주 리포트 첫 주·쉰 주, 지난달 기록 없음) */
  locked?: boolean;
  /** 위젯 바탕(없으면 회색) */
  background?: string;
  /** chevron = 평소(누르면 열려요), 편집 모드에선 빼요 */
  content: (chevron: boolean) => ReactNode;
}

function dotStyle(day: RecentDay, today: string): CSSProperties {
  if (day.count > 0) return { background: day.date === today ? brandColor : withAlpha(brandColor, 0.45) };
  if (day.before) return { background: colors.grey100 };
  // 오늘은 아직(빈 동그라미), 지난날은 쉰 날(회색) — 빠졌다고 겁주지 않게 같은 회색 계열로
  return day.date === today ? { background: colors.white, boxShadow: `inset 0 0 0 1.5px ${colors.grey400}` } : { background: colors.grey200 };
}

function scoreChange(score: number, weekAgo: number, known: boolean): string {
  if (!known) return '도장을 찍을수록 올라가요';
  const d = score - weekAgo;
  return d > 0 ? `지난주보다 ${d}점 올랐어요` : d < 0 ? `지난주보다 ${-d}점 내렸어요` : '지난주와 같아요';
}

/** 위젯 하나의 모양과 읽어 줄 이름 */
export function describeWidget(id: RecordWidgetId, { board, record, today }: RecordContext): WidgetView {
  switch (id) {
    case 'streak': {
      const s = streakSummary(record, today);
      const days = recentDays(record, today, 7);
      return {
        aria: `연속 ${s.current}일${s.best ? `, 최고 ${s.best.length}일` : ''}`,
        content: (chevron) => (
          <>
            <Label text="연속" chevron={chevron} />
            <span className="rc-widget-value" style={{ color: stampInk }}>
              {s.current > 0 ? <CountUp value={s.current} format={(n) => `${n}일째`} /> : '0일'}
            </span>
            <span className="rc-widget-foot rc-dots" aria-hidden>
              {days.map((day, i) => (
                <i key={day.date} className={day.count > 0 ? 'rc-anim-stamp' : 'rc-anim-fade'} style={{ ...dotStyle(day, today), ...stagger(i, 70, 150) }} />
              ))}
            </span>
          </>
        ),
      };
    }
    case 'week': {
      const cmp = compareWithPrevious(record, 'week', today);
      const bars = periodBars(record, weekRange(today, 0), today);
      return {
        aria: `이번 주 도장 ${cmp.now}개${cmp.known ? `, 지난주 이맘때 ${cmp.before}개` : ''}`,
        content: (chevron) => (
          <>
            <Label text="이번 주 도장" chevron={chevron} />
            <span className="rc-widget-value">
              <CountUp value={cmp.now} format={(n) => `${n}개`} />
            </span>
            <MiniBars values={bars.map((b) => b.value)} current={bars.findIndex((b) => b.current)} future={(i) => bars[i].future} />
          </>
        ),
      };
    }
    case 'board': {
      const month = monthRange(today, 0);
      const subs = subTotals(actionCounts(record, month.dates.filter((date) => date <= today)));
      const top = subs.reduce((best, value, s) => (value > subs[best] ? s : best), 0);
      const any = subs[top] > 0;
      return {
        aria: any ? `이번 달 만다라트, 가장 많이 한 가지 ${subTitle(board, top)} 도장 ${subs[top]}개` : '이번 달 만다라트, 아직 도장이 없어요',
        content: (chevron) => (
          <span className="rc-wide-row">
            <span className="rc-wide-text">
              <Label text="이번 달 만다라트" chevron={chevron} />
              <span className="rc-widget-value-text rc-clamp2">{any ? subTitle(board, top) : '아직 도장이 없어요'}</span>
              <span className="rc-widget-sub">{any ? `가장 많이 한 가지 · 도장 ${subs[top]}개` : '실천에 도장을 찍으면 칸이 진해져요'}</span>
            </span>
            <MiniBoard subs={subs} />
          </span>
        ),
      };
    }
    case 'calendar': {
      const month = monthRange(today, 0);
      const dates = month.dates.filter((date) => date <= today);
      const activeDays = dates.filter((date) => checksOn(record, date).length > 0).length;
      const checks = checksIn(record, dates);
      const name = `${Number(today.slice(5, 7))}월 달력`;
      return {
        aria: `${name}, ${activeDays}일 실천, 도장 ${checks}개`,
        content: (chevron) => (
          <span className="rc-wide-row">
            <span className="rc-wide-text">
              <Label text={name} chevron={chevron} />
              <span className="rc-widget-value" style={{ fontSize: 22, lineHeight: '30px' }}>
                <CountUp value={activeDays} format={(n) => `${n}일 실천`} />
              </span>
              <span className="rc-widget-sub">
                도장 {checks}개 · 오늘 {checksOn(record, today).length}개
              </span>
            </span>
            <MiniCalendar record={record} today={today} />
          </span>
        ),
      };
    }
    case 'badges': {
      const badges = computeBadges(record, today);
      const earned = badges.filter((b) => b.earned).sort((a, b) => (b.earned! > a.earned! ? 1 : b.earned! < a.earned! ? -1 : 0));
      const shown = earned.length > 0 ? earned.slice(0, 3) : badges.slice(0, 3);
      return {
        aria: `배지 12개 중 ${earned.length}개`,
        content: (chevron) => (
          <>
            <Label text="배지" chevron={chevron} />
            <span className="rc-widget-value">
              <CountUp value={earned.length} format={(n) => `${n}개`} />
              <span className="rc-widget-small">/ 12</span>
            </span>
            <span className="rc-widget-foot rc-badges-row" aria-hidden>
              {shown.map((b, i) => (
                <span
                  key={b.id}
                  className={`rc-badge-mini ${b.earned ? 'rc-anim-stamp' : 'rc-anim-fade'}`}
                  style={{
                    ...(b.earned
                      ? { border: `2px solid ${stampInk}`, background: withAlpha(brandColor, 0.08), color: stampInk }
                      : { border: `1.5px dashed ${colors.grey400}`, background: colors.white, color: colors.grey600 }),
                    ...stagger(i, 110, 250),
                  }}
                >
                  {b.mark}
                </span>
              ))}
            </span>
          </>
        ),
      };
    }
    case 'report': {
      const state = lastWeekReport(board, record, today);
      if (state.kind === 'ready') {
        const { report } = state;
        return {
          aria: `지난주 리포트, 도장 ${report.checks}개, ${report.range.label}`,
          background: withAlpha(brandColor, 0.08),
          content: (chevron) => (
            <>
              <Label text="지난주 리포트" chevron={chevron} />
              <span className="rc-widget-value" style={{ fontSize: 22, lineHeight: '30px' }}>
                <CountUp value={report.checks} format={(n) => `도장 ${n}개`} />
              </span>
              <span className="rc-widget-sub" style={{ marginTop: 'auto' }}>
                {report.range.label}
              </span>
            </>
          ),
        };
      }
      const first = state.kind === 'first';
      const line = first ? `${monthDay(state.nextMonday)} ${WEEKDAY_LABELS[weekdayIndex(state.nextMonday)]}요일` : '';
      return {
        aria: first ? `지난주 리포트, 첫 리포트는 ${line}` : '지난주 리포트, 지난주는 쉬어 갔어요',
        locked: true,
        content: () => (
          <>
            <Label text="지난주 리포트" chevron={false} />
            <span className="rc-widget-value-text" style={{ fontSize: 15, lineHeight: '22px', color: colors.grey800 }}>
              {first ? (
                <>
                  첫 리포트는
                  <br />
                  {line}
                </>
              ) : (
                '지난주는 쉬어 갔어요'
              )}
            </span>
            <span className="rc-widget-sub" style={{ marginTop: 'auto' }}>
              {first ? '한 주를 다 쓰면 나와요' : '이번 주 리포트는 다음 월요일에'}
            </span>
          </>
        ),
      };
    }
    case 'score': {
      const s = scoreSummary(record, today);
      const score = s?.score ?? 0;
      const change = s ? scoreChange(s.score, s.weekAgo, s.weekAgoKnown) : '도장을 찍으면 올라가요';
      return {
        aria: `꾸준함 점수 ${score}점, ${change}`,
        content: (chevron) => (
          <>
            <Label text="꾸준함 점수" chevron={chevron} />
            <span className="rc-widget-value">
              <CountUp value={score} />
              <span className="rc-widget-small">점</span>
            </span>
            <span className="rc-widget-sub">{change}</span>
            <Meter ratio={score / 100} />
          </>
        ),
      };
    }
    case 'year': {
      const year = yearRange(today, 0);
      const dates = year.dates.filter((date) => date <= today);
      const activeDays = dates.filter((date) => checksOn(record, date).length > 0).length;
      const checks = checksIn(record, dates);
      // 최근 15주(월요일 시작, 이번 주까지)
      const start = addDays(weekRange(today, 0).start, -14 * 7);
      const cells = datesBetween(start, addDays(start, 15 * 7 - 1));
      return {
        aria: `1년 잔디, 올해 ${activeDays}일 실천, 도장 ${checks}개`,
        content: (chevron) => (
          <span className="rc-wide-row">
            <span className="rc-wide-text">
              <Label text="1년 잔디" chevron={chevron} />
              <span className="rc-widget-value" style={{ fontSize: 22, lineHeight: '30px' }}>
                <CountUp value={activeDays} format={(n) => `${n}일 실천`} />
              </span>
              <span className="rc-widget-sub">올해 도장 {checks}개</span>
            </span>
            <span className="rc-minigrass" aria-hidden>
              {cells.map((date, i) => (
                <i
                  key={date}
                  className="rc-anim-fill"
                  style={{ background: date > today ? colors.grey50 : DAY_HEAT[heatLevel(checksOn(record, date).length)], ...stagger(Math.floor(i / 7), 35, 120) }}
                />
              ))}
            </span>
          </span>
        ),
      };
    }
    case 'weekday': {
      const w = weekdaySummary(record, today, '8w');
      const days = w.stats.reduce((sum, s) => sum + s.days, 0);
      const known = w.best !== null && days >= 7;
      return {
        aria: known ? `요일별 평균, ${WEEKDAY_LABELS[w.best!]}요일에 가장 많이 해요` : '요일별 평균, 일주일쯤 쓰면 보여요',
        content: (chevron) => (
          <>
            <Label text="요일별 평균" chevron={chevron} />
            <span className="rc-widget-value">{known ? `${WEEKDAY_LABELS[w.best!]}요일` : '–'}</span>
            <span className="rc-widget-sub">{known ? '가장 많이 해요' : '일주일쯤 쓰면 보여요'}</span>
            <MiniBars values={w.stats.map((s) => Math.round(s.average * 10))} current={known ? w.best! : -1} />
          </>
        ),
      };
    }
    case 'review': {
      const review = lastMonthReview(board, record, today);
      const month = Number(monthRange(today, -1).start.slice(5, 7));
      if (!review) {
        return {
          aria: `지난달 회고, ${month}월은 기록이 없어요`,
          locked: true,
          content: () => (
            <>
              <Label text="지난달 회고" chevron={false} />
              <span className="rc-widget-value-text" style={{ fontSize: 15, lineHeight: '22px', color: colors.grey800 }}>
                {month}월은 기록이 없어요
              </span>
              <span className="rc-widget-sub" style={{ marginTop: 'auto' }}>
                다음 달 1일에 이번 달 회고가 나와요
              </span>
            </>
          ),
        };
      }
      return {
        aria: `지난달 회고, ${month}월 도장 ${review.checks}개, ${review.activeDays}일 실천`,
        content: (chevron) => (
          <>
            <Label text="지난달 회고" chevron={chevron} />
            <span className="rc-widget-value" style={{ fontSize: 22, lineHeight: '30px' }}>
              <CountUp value={review.checks} format={(n) => `도장 ${n}개`} />
            </span>
            <span className="rc-widget-sub" style={{ marginTop: 'auto' }}>
              {month}월 · {review.activeDays}일 실천
            </span>
          </>
        ),
      };
    }
    case 'total': {
      const c = cumulativeSummary(record, today);
      const previous = [0, ...TOTAL_MILESTONES.filter((m) => m <= c.total)].pop() ?? 0;
      return {
        aria: `누적 도장 ${c.total}개, ${c.next}개까지 ${c.left}개`,
        content: (chevron) => (
          <>
            <Label text="누적 도장" chevron={chevron} />
            <span className="rc-widget-value">
              <CountUp value={c.total} format={(n) => `${n}개`} />
            </span>
            <span className="rc-widget-sub">
              {c.next}개까지 {c.left}개
            </span>
            <Meter ratio={(c.total - previous) / Math.max(1, c.next - previous)} />
          </>
        ),
      };
    }
  }
}
