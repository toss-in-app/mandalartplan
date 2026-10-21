/**
 * 배지 12개 (3.0 배지 대시보드, plans/3.0-records-widgets-design.md '배지').
 * 저장하지 않고 체크 기록에서 계산해요. 받은 날 = 조건을 처음 채운 날.
 * 한계: 체크 기록은 400일만 남아서(MAX_CHECKIN_DAYS) 그보다 오래 쓰면 오래된 날이 빠져 배지가 줄 수 있어요 — 다음 버전 후보.
 */
import { SUB_COUNT, TOTAL_ACTIONS } from './mandalart';
import { addDays } from './stats';
import { bestRun, checksOn, recordDates, subOf } from './records';
import { streak, type CheckinRecord } from './state';

export type BadgeId = 'first' | 'streak7' | 'streak14' | 'streak30' | 'total100' | 'total300' | 'total500' | 'allSubs' | 'action30' | 'month20' | 'all64' | 'balanced10';

export interface Badge {
  id: BadgeId;
  /** 동그라미 안 글('첫'·'7'·'30번'…) */
  mark: string;
  title: string;
  /** 받은 날 'YYYY-MM-DD'. 아직이면 null */
  earned: string | null;
  /** 아직일 때 아래 글(남은 양·최고 기록) */
  progress: string;
}

/** 고루 한 날: 세부 목표 6개 이상에 도장을 찍은 날 */
export const BALANCED_SUBS = 6;

interface Tally {
  first: string | null;
  run: { last: string | null; length: number };
  streakAt: Partial<Record<7 | 14 | 30, string>>;
  total: number;
  totalAt: Partial<Record<100 | 300 | 500, string>>;
  maxSubs: number;
  allSubsAt: string | null;
  actionDays: number[];
  action30At: string | null;
  monthDays: Map<string, number>;
  month20At: string | null;
  touched: Set<number>;
  all64At: string | null;
  balanced: number;
  balanced10At: string | null;
}

/** 기록을 오래된 날부터 한 번 훑어 조건을 처음 채운 날들을 모아요 */
function tally(record: CheckinRecord | undefined): Tally {
  const t: Tally = {
    first: null,
    run: { last: null, length: 0 },
    streakAt: {},
    total: 0,
    totalAt: {},
    maxSubs: 0,
    allSubsAt: null,
    actionDays: new Array<number>(TOTAL_ACTIONS).fill(0),
    action30At: null,
    monthDays: new Map(),
    month20At: null,
    touched: new Set(),
    all64At: null,
    balanced: 0,
    balanced10At: null,
  };
  for (const date of recordDates(record)) {
    const indices = checksOn(record, date);
    t.first ??= date;
    t.run = { last: date, length: t.run.last !== null && addDays(t.run.last, 1) === date ? t.run.length + 1 : 1 };
    for (const n of [7, 14, 30] as const) if (t.run.length >= n) t.streakAt[n] ??= date;
    t.total += indices.length;
    for (const n of [100, 300, 500] as const) if (t.total >= n) t.totalAt[n] ??= date;
    const subs = new Set(indices.map(subOf)).size;
    t.maxSubs = Math.max(t.maxSubs, subs);
    if (subs === SUB_COUNT) t.allSubsAt ??= date;
    for (const n of indices) {
      t.actionDays[n] += 1;
      if (t.actionDays[n] >= 30) t.action30At ??= date;
      t.touched.add(n);
    }
    if (t.touched.size === TOTAL_ACTIONS) t.all64At ??= date;
    const month = date.slice(0, 7);
    t.monthDays.set(month, (t.monthDays.get(month) ?? 0) + 1);
    if ((t.monthDays.get(month) ?? 0) >= 20) t.month20At ??= date;
    if (subs >= BALANCED_SUBS) {
      t.balanced += 1;
      if (t.balanced >= 10) t.balanced10At ??= date;
    }
  }
  return t;
}

export function computeBadges(record: CheckinRecord | undefined, today: string): Badge[] {
  const t = tally(record);
  const current = streak(record, today);
  const best = bestRun(record)?.length ?? 0;
  const streakProgress = (n: number) => (current > 0 ? `${n - current}일 남았어요` : best > 0 ? `최고 ${best}일` : `${n}일 이어 가요`);
  const totalProgress = (n: number) => `${n - t.total}개 남았어요`;
  const maxActionDays = Math.max(0, ...t.actionDays);
  const maxMonthDays = Math.max(0, ...t.monthDays.values());
  return [
    { id: 'first', mark: '첫', title: '첫 도장', earned: t.first, progress: '첫 도장을 찍어 봐요' },
    { id: 'streak7', mark: '7', title: '7일 연속', earned: t.streakAt[7] ?? null, progress: streakProgress(7) },
    { id: 'streak14', mark: '14', title: '14일 연속', earned: t.streakAt[14] ?? null, progress: streakProgress(14) },
    { id: 'streak30', mark: '30', title: '30일 연속', earned: t.streakAt[30] ?? null, progress: streakProgress(30) },
    { id: 'total100', mark: '100', title: '도장 100개', earned: t.totalAt[100] ?? null, progress: totalProgress(100) },
    { id: 'total300', mark: '300', title: '도장 300개', earned: t.totalAt[300] ?? null, progress: totalProgress(300) },
    { id: 'total500', mark: '500', title: '도장 500개', earned: t.totalAt[500] ?? null, progress: totalProgress(500) },
    { id: 'allSubs', mark: '8', title: '하루에 여덟 가지', earned: t.allSubsAt, progress: t.maxSubs > 0 ? `최고 ${t.maxSubs}가지` : '세부 목표 8개를 하루에' },
    { id: 'action30', mark: '30번', title: '한 실천 30번', earned: t.action30At, progress: maxActionDays > 0 ? `최고 ${maxActionDays}번` : '한 실천을 30일' },
    { id: 'month20', mark: '20일', title: '한 달 20일', earned: t.month20At, progress: maxMonthDays > 0 ? `최고 ${maxMonthDays}일` : '한 달에 20일 실천' },
    { id: 'all64', mark: '64', title: '64칸 모두 한 번씩', earned: t.all64At, progress: `${TOTAL_ACTIONS - t.touched.size}칸 남았어요` },
    { id: 'balanced10', mark: '고루', title: '고루 한 날 10번', earned: t.balanced10At, progress: `${t.balanced}번 했어요` },
  ];
}

/** 가장 최근에 받은 배지(같은 날이면 목록 뒤쪽). 없으면 null */
export function latestBadge(badges: readonly Badge[]): Badge | null {
  return badges.reduce<Badge | null>((latest, badge) => (badge.earned && (!latest || badge.earned >= (latest.earned ?? '')) ? badge : latest), null);
}
