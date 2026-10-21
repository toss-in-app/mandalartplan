import { colors } from '@toss/tds-colors';
import { Text } from '@toss/tds-mobile';
import type { CSSProperties } from 'react';

import { computeBadges, latestBadge } from '../../lib/badges';
import {
  actionCounts,
  compareWithPrevious,
  cumulativeSummary,
  dayWord,
  lastMonthReview,
  milestoneName,
  monthDay,
  periodBars,
  recentDays,
  restDaysThisMonth,
  scoreSummary,
  streakSummary,
  subTitle,
  subTotals,
  weekdaySummary,
  type RecentDay,
  type WeekdayWindow,
} from '../../lib/records';
import { WEEKDAY_LABELS, computeStats, periodRange, rangeLabel, type PeriodRange } from '../../lib/stats';
import { brandColor, stampInk, withAlpha } from '../../theme';
import { CountUp } from './CountUp';
import { stagger } from './motion';
import { PeriodNav } from './PeriodNav';
import { scopeWord, type RecordContext } from './shared';

/** 대시보드 안 기록이 없을 때 한 줄 */
export function EmptyLine({ text }: { text: string }) {
  return (
    <div style={{ padding: '32px 24px 8px', textAlign: 'center' }}>
      <Text typography="t6" color={colors.grey700} display="block">
        {text}
      </Text>
    </div>
  );
}

/** 막대 묶음: 막대 위 숫자(note), 아래 이름. highlight 는 브랜드 색, 나머지는 옅게. 왼쪽부터 차례로 아래에서 차올라요(기간을 바꾸면 key 로 다시) */
export function Bars({ items, label }: { items: Array<{ key: string; label: string; value: number; note: string; highlight?: boolean; muted?: boolean }>; label: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="rc-bars" role="img" aria-label={label} style={{ marginTop: 16 }}>
      {items.map((item, i) => (
        <span key={item.key} className="rc-bar" aria-hidden>
          <span className="rc-anim-fade" style={{ color: item.highlight ? stampInk : colors.grey700, fontWeight: item.highlight ? 700 : 400, ...stagger(i, 70, 500) }}>
            {item.note}
          </span>
          <i
            className="rc-anim-grow-y"
            style={{
              height: item.value > 0 ? Math.max(6, Math.round((item.value / max) * 120)) : 3,
              background: item.value === 0 || item.muted ? colors.grey200 : item.highlight ? brandColor : withAlpha(brandColor, 0.35),
              ...stagger(i, 70, 100),
            }}
          />
          <span style={{ color: item.highlight ? stampInk : colors.grey600, fontWeight: item.highlight ? 700 : 400 }}>{item.label}</span>
        </span>
      ))}
    </div>
  );
}

function Rows({ rows }: { rows: Array<[string, string, CSSProperties?]> }) {
  return (
    <div className="rc-card">
      <ul className="rc-rows">
        {rows.map(([label, value, style]) => (
          <li key={label}>
            <span>{label}</span>
            <b style={style}>{value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────────── 연속 ─────────────────────────

function dayCircle(day: RecentDay, today: string): CSSProperties {
  if (day.count > 0) return { background: day.date === today ? brandColor : withAlpha(brandColor, 0.45) };
  if (day.before) return { background: colors.grey100 };
  return day.date === today ? { background: colors.white, boxShadow: `inset 0 0 0 2px ${colors.grey400}` } : { background: colors.grey200 };
}

/** 연속(E1): 큰 고리 · 다음 고비까지 · 최근 14일 · 최고 기록 · 이번 달 쉰 날. '끊기면 잃어요' 같은 겁주는 말은 쓰지 않아요 */
export function StreakDashboard({ record, today }: RecordContext) {
  const s = streakSummary(record, today);
  const days = recentDays(record, today, 14);
  const rest = restDaysThisMonth(record, today);
  const left = s.next - s.current;
  const r = 74;
  const length = 2 * Math.PI * r;
  const progress = s.next > 0 ? s.current / s.next : 0;
  const title = s.todayDone ? `오늘 도장으로 ${s.current}일째가 됐어요` : `오늘 도장을 찍으면 ${s.current + 1}일째예요`;
  return (
    <>
      <div className="rc-ring" role="img" aria-label={`지금 ${s.current}일째 연속, 다음 고비 ${milestoneName(s.next)}`}>
        <svg width="172" height="172" viewBox="0 0 172 172" aria-hidden>
          <circle cx="86" cy="86" r={r} fill="none" stroke={colors.grey100} strokeWidth="12" />
          <circle
            cx="86"
            cy="86"
            r={r}
            fill="none"
            stroke={brandColor}
            strokeWidth="12"
            strokeLinecap="round"
            className="rc-anim-draw"
            strokeDasharray={`${length} ${length}`}
            strokeDashoffset={length * (1 - progress)}
            style={{ ['--rc-from' as string]: length }}
            transform="rotate(-90 86 86)"
          />
        </svg>
        <div aria-hidden>
          <span style={{ fontSize: 52, lineHeight: '56px', fontWeight: 700, color: stampInk, fontVariantNumeric: 'tabular-nums' }}>
            <CountUp value={s.current} duration={1100} />
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: colors.grey700 }}>일째 연속</span>
        </div>
      </div>
      <div style={{ padding: '16px 24px 0', textAlign: 'center' }}>
        <p className="rc-head-title" style={{ fontSize: 19, lineHeight: '28px' }}>
          {title}
        </p>
        <p className="rc-head-text">
          {dayWord(left)}만 더 이으면 {milestoneName(s.next)}이에요
        </p>
      </div>
      <div className="rc-card">
        <p style={{ margin: '0 0 10px', fontSize: 13, color: colors.grey700 }}>최근 14일</p>
        <div className="rc-days" role="img" aria-label={`최근 14일 중 ${days.filter((d) => d.count > 0).length}일 실천`}>
          {days.map((day, i) => (
            <span key={day.date} className="rc-day" aria-hidden>
              <i className={day.count > 0 ? 'rc-anim-stamp' : 'rc-anim-fade'} style={{ ...dayCircle(day, today), ...stagger(i, 55, 300) }} />
              <span style={day.date === today ? { color: stampInk, fontWeight: 700 } : undefined}>{day.date === today ? '오늘' : Number(day.date.slice(8))}</span>
            </span>
          ))}
        </div>
      </div>
      <Rows
        rows={[
          ['최고 기록', s.best ? `${s.best.length}일 · ${rangeLabel(s.best.start, s.best.end)}` : '아직 없어요'],
          ['다음 고비', `${milestoneName(s.next)} · ${monthDay(s.nextDate)}`],
        ]}
      />
      <p className="rc-note">{rest > 0 ? `쉬어 간 날이 있어도 기록은 그대로 남아요. 이번 달 쉰 날 ${rest}일.` : '쉬어 간 날이 있어도 기록은 그대로 남아요.'}</p>
    </>
  );
}

// ───────────────────────── 도장 ─────────────────────────

/** 도장(C1): 기간 주·월·년 — 큰 숫자 · 지난 기간 이맘때와 한 문장 · 막대 · 지난 기간 전체·많이 한 가지·아직 안 한 가지 */
export function StampsDashboard({ board, record, today, range, onMove }: RecordContext & { range: PeriodRange; onMove: (offset: number) => void }) {
  const stats = computeStats(board, record, range, today);
  const scope = scopeWord(range);
  const bars = periodBars(record, range, today);
  const current = range.offset === 0;
  const cmp = compareWithPrevious(record, range.period, today);
  const previous = periodRange(range.period, today, range.offset - 1);
  const previousStats = computeStats(board, record, previous, today);
  const subs = subTotals(actionCounts(record, range.dates.filter((date) => date <= today)));
  const top = subs.reduce((best, value, s) => (value > subs[best] ? s : best), 0);
  const resting = stats.bySub.filter((sub) => sub.count === 0).map((sub) => sub.title);

  let sentence = `${scope}에 ${stats.activeDays}일 실천했어요`;
  if (current && cmp.known) {
    const diff = cmp.now - cmp.before;
    sentence =
      diff > 0
        ? `${cmp.label} 이맘때보다 ${diff}개 더 찍었어요`
        : diff === 0
          ? `${cmp.label} 이맘때만큼 찍었어요`
          : `오늘 ${-diff}개 더 찍으면 ${cmp.label} 이맘때(${cmp.before}개)만큼이에요`;
  }
  const previousName = range.period === 'week' ? (current ? '지난주' : '그 전 주') : range.period === 'month' ? (current ? '지난달' : '그 전 달') : current ? '작년' : '그 전 해';
  return (
    <>
      <PeriodNav range={range} record={record} onMove={onMove} />
      {stats.checks === 0 ? (
        <EmptyLine text={current ? `${scope} 첫 도장을 찍어 봐요` : '이 기간은 쉬어 갔어요'} />
      ) : (
        <>
          <div className="rc-head">
            <p className="rc-head-label">{scope} 찍은 도장</p>
            <p className="rc-head-number">
              <CountUp value={stats.checks} format={(n) => `${n}개`} />
            </p>
            <p className="rc-head-text">{sentence}</p>
          </div>
          <Bars
            key={range.start + range.period}
            label={`${range.label} 도장: ${bars.filter((b) => !b.future).map((b) => `${b.label} ${b.value}`).join(', ')}`}
            items={bars.map((b) => ({ key: b.label, label: b.current ? (range.period === 'week' ? '오늘' : b.label) : b.label, value: b.value, note: b.future ? '' : String(b.value), highlight: b.current }))}
          />
          <Rows
            rows={[
              ...(previousStats.checks > 0 ? ([[`${previousName} 전체`, `${previousStats.checks}개 · ${previousStats.activeDays}일`]] as Array<[string, string]>) : []),
              [`${scope} 많이 한 가지`, subs[top] > 0 ? subTitle(board, top) : '–'],
              ...(resting.length > 0 ? ([[`${scope} 아직인 가지`, resting.length > 2 ? `${resting.slice(0, 2).join(' · ')} 외 ${resting.length - 2}개` : resting.join(' · ')]] as Array<[string, string]>) : []),
            ]}
          />
        </>
      )}
    </>
  );
}

// ───────────────────────── 배지 ─────────────────────────

/** 배지(E2): 12개 격자 — 받은 것은 받은 날, 아직인 것은 남은 양 */
export function BadgesDashboard({ record, today }: RecordContext) {
  const badges = computeBadges(record, today);
  const earned = badges.filter((b) => b.earned).length;
  const latest = latestBadge(badges);
  return (
    <>
      <div className="rc-head" style={{ paddingBottom: 20 }}>
        <p className="rc-head-title">{earned > 0 ? `배지 ${earned}개를 모았어요` : '첫 배지를 모아 봐요'}</p>
        <p className="rc-head-text">{latest ? `12개 중 · 가장 최근 '${latest.title}' ${monthDay(latest.earned!)}` : '도장을 찍으면 배지가 하나씩 열려요'}</p>
      </div>
      <ul className="rc-badges">
        {badges.map((b, i) => (
          <li key={b.id} aria-label={`${b.title}, ${b.earned ? `받음 ${monthDay(b.earned)}` : `아직, ${b.progress}`}`}>
            <span
              className={`rc-badge ${b.earned ? 'rc-anim-stamp' : 'rc-anim-fade'}`}
              aria-hidden
              style={{
                ...(b.earned
                  ? { border: `3px solid ${stampInk}`, boxShadow: `inset 0 0 0 3px ${colors.white}, inset 0 0 0 5px ${stampInk}`, background: withAlpha(brandColor, 0.08), color: stampInk }
                  : { border: `2px dashed ${colors.grey300}`, background: colors.white, color: colors.grey500 }),
                fontSize: b.mark.length >= 3 ? 17 : 22,
                ...stagger(i, 90, 200),
              }}
            >
              {b.mark}
            </span>
            <span aria-hidden style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600, color: b.earned ? colors.grey900 : colors.grey700 }}>
              {b.title}
            </span>
            <span aria-hidden style={{ fontSize: 12, lineHeight: '16px', color: colors.grey600 }}>
              {b.earned ? monthDay(b.earned) : b.progress}
            </span>
          </li>
        ))}
      </ul>
      <div style={{ height: 8 }} />
    </>
  );
}

// ───────────────────────── 꾸준함 점수 ─────────────────────────

/** 꾸준함 점수(C5): 반원 게이지 · 지난주보다 · 8주 추세 · 가지마다 점수 */
export function ScoreDashboard({ board, record, today }: RecordContext) {
  const s = scoreSummary(record, today);
  if (!s) return <EmptyLine text="도장을 찍으면 점수가 생겨요" />;
  const d = s.score - s.weekAgo;
  const change = !s.weekAgoKnown ? '도장을 찍을수록 올라가요' : d > 0 ? `지난주보다 ${d}점 올랐어요` : d < 0 ? `지난주보다 ${-d}점 내렸어요` : '지난주와 같아요';
  const r = 100;
  const half = Math.PI * r;
  const points = s.weekly.map((v, i) => `${s.weekly.length === 1 ? 160 : 16 + (i * 288) / (s.weekly.length - 1)},${56 - (v / 100) * 48}`).join(' ');
  const subs = Array.from({ length: 8 }, (_, i) => i).filter((i) => board.subs[i]?.title.trim() || board.subs[i]?.actions.some((a) => a.trim()));
  return (
    <>
      <div style={{ position: 'relative', width: 240, height: 136, margin: '16px auto 0' }} role="img" aria-label={`꾸준함 점수 100점 중 ${s.score}점`}>
        <svg width="240" height="136" viewBox="0 0 240 136" aria-hidden>
          <path d="M20 120 A100 100 0 0 1 220 120" fill="none" stroke={colors.grey100} strokeWidth="16" strokeLinecap="round" />
          <path
            className="rc-anim-draw"
            d="M20 120 A100 100 0 0 1 220 120"
            fill="none"
            stroke={brandColor}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${half} ${half}`}
            strokeDashoffset={half * (1 - s.score / 100)}
            style={{ ['--rc-from' as string]: half, animationDuration: '1.3s' }}
          />
        </svg>
        <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 48, lineHeight: '52px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            <CountUp value={s.score} duration={1300} />
          </span>
          <span style={{ fontSize: 13, color: colors.grey700 }}>꾸준함 점수</span>
        </div>
      </div>
      <div style={{ padding: '12px 24px 0', textAlign: 'center' }}>
        <p className="rc-head-text" style={{ color: colors.grey900, fontWeight: 600 }}>
          {change}
        </p>
        <p className="rc-note" style={{ margin: '4px 0 0' }}>
          최근 날일수록 무겁게 세서, 하루 쉬어도 0점이 되지 않아요
        </p>
      </div>
      {s.weekly.length > 1 && (
        <div className="rc-card">
          <p style={{ margin: '0 0 6px', fontSize: 13, color: colors.grey700 }}>{s.weekly.length - 1}주 동안</p>
          <svg width="100%" height="64" viewBox="0 0 320 64" preserveAspectRatio="none" role="img" aria-label={`주마다 점수: ${s.weekly.join(', ')}`}>
            <polyline
              className="rc-anim-draw"
              points={points}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={0}
              style={{ ['--rc-from' as string]: 1, ...stagger(0, 0, 400) }}
              fill="none"
              stroke={brandColor}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <p style={{ margin: '4px 0 0', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: colors.grey600 }}>
            <span>{s.weekly[0]}점</span>
            <span>지금 {s.score}점</span>
          </p>
        </div>
      )}
      {subs.length > 0 && (
        <>
          <h2 className="rc-section-title">가지마다 점수</h2>
          <ul className="rc-rows" style={{ padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 24 }}>
            {subs.map((i) => (
              <li key={i}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subTitle(board, i)}</span>
                <b>{s.bySub[i]}</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

// ───────────────────────── 요일별 평균 ─────────────────────────

/** 요일별 평균(D3): 기간 4주·8주·전체 — 가장 많이 하는 요일·쉬어 가는 요일 · 요일 막대 · 요일마다 많이 한 가지 */
export function WeekdayDashboard({ board, record, today, span }: RecordContext & { span: WeekdayWindow }) {
  const w = weekdaySummary(record, today, span);
  const days = w.stats.reduce((sum, s) => sum + s.days, 0);
  if (w.from === null || days === 0) return <EmptyLine text="도장을 찍으면 요일마다 평균이 보여요" />;
  const scope = span === 'all' ? '처음부터' : `최근 ${span === '4w' ? 4 : 8}주`;
  const title =
    w.best === null || days < 7
      ? '일주일쯤 쓰면 요일마다 달라지는 게 보여요'
      : w.worst !== null
        ? `${WEEKDAY_LABELS[w.best]}요일에 가장 많이,\n${WEEKDAY_LABELS[w.worst]}요일엔 쉬어 가요`
        : `${WEEKDAY_LABELS[w.best]}요일에 가장 많이 해요`;
  return (
    <>
      <div className="rc-head">
        <p className="rc-head-label">{scope} · 요일마다 하루 평균</p>
        <p className="rc-head-title" style={{ whiteSpace: 'pre-line' }}>
          {title}
        </p>
      </div>
      <Bars
        key={span}
        label={`요일별 하루 평균 도장: ${w.stats.map((s) => `${WEEKDAY_LABELS[s.weekday]} ${s.average.toFixed(1)}`).join(', ')}`}
        items={w.stats.map((s) => ({
          key: String(s.weekday),
          label: WEEKDAY_LABELS[s.weekday],
          value: s.average,
          note: s.days > 0 ? s.average.toFixed(1) : '',
          highlight: s.weekday === w.best,
          muted: s.weekday === w.worst,
        }))}
      />
      {w.stats.some((s) => s.topSub !== null) && (
        <>
          <h2 className="rc-section-title">요일마다 많이 한 가지</h2>
          <ul className="rc-rows" style={{ padding: '0 24px' }}>
            {w.stats
              .filter((s) => s.topSub !== null)
              .map((s) => (
                <li key={s.weekday}>
                  <span style={{ display: 'flex', gap: 12, minWidth: 0 }}>
                    <b style={{ color: s.weekday === w.best ? stampInk : colors.grey900 }}>{WEEKDAY_LABELS[s.weekday]}</b>
                    <span style={{ color: colors.grey900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subTitle(board, s.topSub!)}</span>
                  </span>
                  <span style={{ color: colors.grey700, fontWeight: 400 }}>평균 {s.topSubAverage.toFixed(1)}번</span>
                </li>
              ))}
          </ul>
        </>
      )}
    </>
  );
}

// ───────────────────────── 지난달 회고 ─────────────────────────

/** 지난달 회고(F2): n월 돌아보기 · 잘한 실천 3 · 한 번도 못 한 실천. '다음 달 집중할 실천 고르기'는 3.0 에서 뺐어요(홈 3×3 까지 바뀌어서) */
export function ReviewDashboard({ board, record, today }: RecordContext) {
  const review = lastMonthReview(board, record, today);
  const month = Number(periodRange('month', today, -1).start.slice(5, 7));
  if (!review) return <EmptyLine text={`${month}월은 기록이 없어요. 다음 달 1일에 이번 달 회고가 나와요`} />;
  const shown = review.untouched.slice(0, 3).map((a) => a.text);
  return (
    <>
      <div className="rc-head">
        <p className="rc-head-label">{month}월 돌아보기</p>
        <p className="rc-head-title">
          {review.activeDays}일 동안 도장 {review.checks}개{review.best ? ', 가장 많이 한 달이었어요' : '를 찍었어요'}
        </p>
      </div>
      <h2 className="rc-section-title">잘한 실천</h2>
      <ol style={{ margin: 0, padding: '0 20px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {review.top.map((a, i) => (
          <li
            key={a.index}
            className="rc-anim-rise"
            style={{
              display: 'grid',
              gridTemplateColumns: '20px 1fr auto',
              gap: 8,
              padding: '12px 14px',
              borderRadius: 14,
              background: i === 0 ? withAlpha(brandColor, 0.08) : colors.grey50,
              fontSize: 15,
              ...stagger(i, 120, 150),
            }}
          >
            <b style={{ color: stampInk }}>{i + 1}</b>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.text}</span>
            <b>
              <CountUp value={a.count} format={(n) => `${n}번`} delay={150 + i * 120} />
            </b>
          </li>
        ))}
      </ol>
      {review.untouched.length > 0 && (
        <>
          <h2 className="rc-section-title">한 번도 못 한 실천 · {review.untouched.length}개</h2>
          <p className="rc-note" style={{ marginTop: 0, color: colors.grey700, fontSize: 14 }}>
            {shown.join(' · ')}
            {review.untouched.length > shown.length ? ` 외 ${review.untouched.length - shown.length}개` : ''}
          </p>
        </>
      )}
    </>
  );
}

// ───────────────────────── 누적 도장 ─────────────────────────

/** 누적 도장(D4): 첫 도장부터 · 다음 고비까지·지금 속도 · 달마다 누적 선 · 지나온 길 */
export function TotalDashboard({ record, today }: RecordContext) {
  const c = cumulativeSummary(record, today);
  if (!c.first) return <EmptyLine text="첫 도장을 찍으면 여기서부터 쌓여요" />;
  const top = Math.max(c.next, 1);
  const n = c.months.length;
  const x = (i: number) => (n === 1 ? 160 : 20 + (i * 280) / (n - 1));
  const y = (v: number) => 150 - (v / top) * 130;
  return (
    <>
      <div className="rc-head">
        <p className="rc-head-label">{monthDay(c.first)} 첫 도장부터</p>
        <p className="rc-head-number">
          <CountUp value={c.total} format={(v) => `도장 ${v}개`} duration={1200} />
        </p>
        <p className="rc-head-text">
          {c.next}개까지 <b style={{ color: stampInk }}>{c.left}개</b> 남았어요{c.eta ? ` · 지금 속도면 ${c.eta}` : ''}
        </p>
      </div>
      <svg width="100%" height="190" viewBox="0 0 320 190" role="img" aria-label={`달마다 누적 도장: ${c.months.map((m) => `${m.label} ${m.total}`).join(', ')}, 다음 고비 ${c.next}개`} style={{ display: 'block', marginTop: 16, padding: '0 16px', boxSizing: 'border-box' }}>
        <line x1="20" x2="300" y1={y(c.next)} y2={y(c.next)} stroke={withAlpha(brandColor, 0.5)} strokeWidth="1.5" strokeDasharray="5 4" />
        <text x="300" y={y(c.next) - 6} textAnchor="end" fontSize="11" fill={stampInk} fontWeight="700">
          {c.next}
        </text>
        {n > 1 && (
          <polyline
            className="rc-anim-draw"
            points={c.months.map((m, i) => `${x(i)},${y(m.total)}`).join(' ')}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={0}
            style={{ ['--rc-from' as string]: 1, animationDuration: '1.2s' }}
            fill="none"
            stroke={brandColor}
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {c.months.map((m, i) => (
          <g key={m.month}>
            <circle
              className="rc-anim-fade"
              cx={x(i)}
              cy={y(m.total)}
              r={i === n - 1 ? 5 : 3.5}
              fill={i === n - 1 ? brandColor : colors.white}
              stroke={brandColor}
              strokeWidth="2"
              style={stagger(i, n > 1 ? Math.round(900 / (n - 1)) : 0, 150)}
            />
            <text x={x(i)} y="178" textAnchor="middle" fontSize="11" fill={i === n - 1 ? stampInk : colors.grey600} fontWeight={i === n - 1 ? 700 : 400}>
              {i === n - 1 ? '지금' : m.label}
            </text>
          </g>
        ))}
      </svg>
      <h2 className="rc-section-title">지나온 길</h2>
      <ul className="rc-rows" style={{ padding: '0 24px', fontSize: 15 }}>
        {c.reached.map((r) => (
          <li key={r.count}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: colors.grey900 }}>
              <i aria-hidden style={{ width: 18, height: 18, boxSizing: 'border-box', borderRadius: '50%', border: `2.5px solid ${stampInk}` }} />
              {r.count === 1 ? '첫 도장' : `도장 ${r.count}개`}
            </span>
            <span style={{ color: colors.grey700 }}>{monthDay(r.date)}</span>
          </li>
        ))}
        <li>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: colors.grey700 }}>
            <i aria-hidden style={{ width: 18, height: 18, boxSizing: 'border-box', borderRadius: '50%', border: `2px dashed ${colors.grey400}` }} />
            도장 {c.next}개
          </span>
          <span style={{ color: colors.grey700 }}>{c.left}개 남음</span>
        </li>
      </ul>
    </>
  );
}
