import { describe, expect, it } from 'vitest';

import { atHistoryBottom, goHome, navigate, parseRoute, resolveHash, routeFromSchemeUrl, routeToHash } from './router';

/** jsdom 의 히스토리 되감기는 비동기라 잠깐 기다려요 */
const settled = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('parseRoute / routeToHash', () => {
  it('해시와 라우트가 서로 바뀌어요', () => {
    const routes = [
      { name: 'home' as const },
      { name: 'sub' as const, sub: 7 },
      { name: 'block' as const, block: 4 },
      { name: 'overview' as const },
      { name: 'today' as const },
      { name: 'share' as const },
      { name: 'settings' as const },
      { name: 'draft' as const },
      { name: 'trial' as const },
      { name: 'record' as const, widget: 'board' as const },
      { name: 'record' as const, widget: 'year' as const },
    ];
    for (const route of routes) expect(parseRoute(routeToHash(route))).toEqual(route);
  });

  it('모르는 해시·범위 밖 번호는 홈이고, 예전 checkin 은 today 예요', () => {
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/sub/8')).toEqual({ name: 'home' });
    expect(parseRoute('#/block/9')).toEqual({ name: 'home' });
    expect(parseRoute('#/block/4/7')).toEqual({ name: 'block', block: 4, cell: 7 });
    expect(routeToHash({ name: 'block', block: 4, cell: 7 })).toBe('#/block/4/7');
    expect(parseRoute('#/block/4/9')).toEqual({ name: 'home' });
    expect(parseRoute('#/nope')).toEqual({ name: 'home' });
    expect(parseRoute('#/checkin')).toEqual({ name: 'today' });
    // 위젯 대시보드(3.0): 모르는 위젯은 홈
    expect(parseRoute('#/record/streak')).toEqual({ name: 'record', widget: 'streak' });
    expect(parseRoute('#/record/nope')).toEqual({ name: 'home' });
  });
});

describe('routeFromSchemeUrl', () => {
  it('딥링크 경로를 화면으로 바꿔요', () => {
    expect(routeFromSchemeUrl('intoss://mandalartplan')).toEqual({ name: 'home' });
    expect(routeFromSchemeUrl('intoss://mandalartplan/')).toEqual({ name: 'home' });
    expect(routeFromSchemeUrl('intoss://mandalartplan/today?from=push')).toEqual({ name: 'today' });
    expect(routeFromSchemeUrl('intoss-private://mandalartplan/sub/2')).toEqual({ name: 'sub', sub: 2 });
    expect(routeFromSchemeUrl('https://mandalartplan.apps.tossmini.com/share')).toEqual({ name: 'share' });
    expect(routeFromSchemeUrl('intoss://mandalartplan/draft')).toEqual({ name: 'draft' });
    expect(routeFromSchemeUrl('intoss://mandalartplan/record/calendar')).toEqual({ name: 'record', widget: 'calendar' });
    expect(routeFromSchemeUrl('')).toBeNull();
    expect(routeFromSchemeUrl('not a url')).toBeNull();
  });
});

describe('resolveHash', () => {
  it('해시가 비어 있으면 바닥 화면(딥링크), 있으면 해시 화면이에요', () => {
    const base = { name: 'today' as const };
    expect(resolveHash('', base)).toEqual(base);
    expect(resolveHash('#', base)).toEqual(base);
    expect(resolveHash('#/', base)).toEqual(base);
    expect(resolveHash('#/sub/3', base)).toEqual({ name: 'sub', sub: 3 });
  });
});

describe('goHome (3.0 — 세부 목표 화면 가운데 이름표)', () => {
  it('몇 단계를 거쳤어도 히스토리를 바닥(홈)까지 되감아요', async () => {
    window.history.replaceState(null, '', '#/');
    navigate({ name: 'overview' });
    navigate({ name: 'sub', sub: 2 });
    expect(atHistoryBottom()).toBe(false);
    expect(window.location.hash).toBe('#/sub/2');
    goHome();
    await settled();
    expect(atHistoryBottom()).toBe(true);
    expect(window.location.hash).toBe('#/');
  });

  it('이미 바닥이면 히스토리를 움직이지 않아요', async () => {
    window.history.replaceState(null, '', '#/');
    goHome();
    await settled();
    expect(atHistoryBottom()).toBe(true);
    expect(window.location.hash).toBe('#/');
  });
});
