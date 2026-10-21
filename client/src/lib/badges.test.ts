import { describe, expect, it } from 'vitest';

import { computeBadges, latestBadge, type BadgeId } from './badges';
import { ACTION_COUNT, actionIndex } from './mandalart';
import type { CheckinRecord } from './state';
import { addDays } from './stats';

const TODAY = '2026-10-21';

function rec(days: Record<string, number[]>): CheckinRecord {
  return { days, lastCompletedAt: 1 };
}

function run(start: string, n: number, indices: number[]): Record<string, number[]> {
  return Object.fromEntries(Array.from({ length: n }, (_, i) => [addDays(start, i), indices]));
}

const byId = (record: CheckinRecord | undefined, today = TODAY) => Object.fromEntries(computeBadges(record, today).map((b) => [b.id, b])) as Record<BadgeId, ReturnType<typeof computeBadges>[number]>;

describe('배지 12개 (3.0)', () => {
  it('기록이 없으면 아무것도 없고, 아직일 때 글이 나와요', () => {
    const badges = computeBadges(undefined, TODAY);
    expect(badges).toHaveLength(12);
    expect(badges.every((b) => b.earned === null)).toBe(true);
    const b = byId(undefined);
    expect(b.first.progress).toBe('첫 도장을 찍어 봐요');
    expect(b.streak7.progress).toBe('7일 이어 가요');
    expect(b.total100.progress).toBe('100개 남았어요');
    expect(b.all64.progress).toBe('64칸 남았어요');
    expect(b.balanced10.progress).toBe('0번 했어요');
    expect(latestBadge(badges)).toBeNull();
  });

  it('첫 도장·연속: 받은 날은 조건을 처음 채운 날, 아직이면 지금 연속으로 남은 날', () => {
    const b = byId(rec({ ...run('2026-09-01', 8, [0]), ...run('2026-10-15', 7, [0]) }));
    expect(b.first.earned).toBe('2026-09-01');
    expect(b.streak7.earned).toBe('2026-09-07');
    expect(b.streak14.earned).toBeNull();
    expect(b.streak14.progress).toBe('7일 남았어요'); // 지금 7일째
    const rested = byId(rec(run('2026-09-01', 8, [0])));
    expect(rested.streak14.progress).toBe('최고 8일'); // 지금은 끊겨 있어요
  });

  it('누적 도장 100개를 넘긴 날', () => {
    const b = byId(rec(run('2026-10-01', 21, [0, 1, 2, 3, 4])));
    expect(b.total100.earned).toBe('2026-10-20'); // 20일째에 100개
    expect(b.total300.progress).toBe('195개 남았어요');
  });

  it('하루에 여덟 가지·고루 한 날 10번·한 달 20일·한 실천 30번·64칸 모두', () => {
    const allSubs = Array.from({ length: 8 }, (_, s) => actionIndex(s, 0));
    const six = allSubs.slice(0, 6);
    const b = byId(rec({ ...run('2026-09-01', 9, six), '2026-09-10': allSubs, ...run('2026-09-11', 21, [0]) }));
    expect(b.allSubs.earned).toBe('2026-09-10');
    expect(b.balanced10.earned).toBe('2026-09-10');
    expect(b.month20.earned).toBe('2026-09-20');
    expect(b.action30.earned).toBe('2026-09-30'); // 실천 0 을 9 + 1 + 20일
    expect(b.all64.progress).toBe(`${64 - 8}칸 남았어요`);
    const every = Array.from({ length: 64 }, (_, n) => n);
    // 하루에 앞 세부 목표 4개(실천 32칸), 다음 날 뒤 4개 — 64칸은 둘째 날 다 차지만 '하루에 여덟 가지'는 아니에요
    const full = byId(rec({ '2026-10-01': every.slice(0, 4 * ACTION_COUNT), '2026-10-02': every.slice(4 * ACTION_COUNT) }));
    expect(full.all64.earned).toBe('2026-10-02');
    expect(full.allSubs.earned).toBeNull();
    expect(full.allSubs.progress).toBe('최고 4가지');
  });

  it('가장 최근 배지는 받은 날이 가장 늦은 것(같은 날이면 목록 뒤쪽)', () => {
    // 10월 20일에 도장 100개와 한 달 20일을 같이 받아요 → 목록 뒤쪽인 한 달 20일
    const badges = computeBadges(rec(run('2026-10-01', 21, [0, 1, 2, 3, 4])), TODAY);
    expect(latestBadge(badges)?.id).toBe('month20');
  });
});
