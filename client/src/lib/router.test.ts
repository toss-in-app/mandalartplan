import { describe, expect, it } from 'vitest';

import { parseRoute, resolveHash, routeFromSchemeUrl, routeToHash } from './router';

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
    ];
    for (const route of routes) expect(parseRoute(routeToHash(route))).toEqual(route);
  });

  it('모르는 해시·범위 밖 번호는 홈이고, 예전 checkin 은 today 예요', () => {
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/sub/8')).toEqual({ name: 'home' });
    expect(parseRoute('#/block/9')).toEqual({ name: 'home' });
    expect(parseRoute('#/nope')).toEqual({ name: 'home' });
    expect(parseRoute('#/checkin')).toEqual({ name: 'today' });
  });
});

describe('routeFromSchemeUrl', () => {
  it('딥링크 경로를 화면으로 바꿔요', () => {
    expect(routeFromSchemeUrl('intoss://mandalartplan')).toEqual({ name: 'home' });
    expect(routeFromSchemeUrl('intoss://mandalartplan/')).toEqual({ name: 'home' });
    expect(routeFromSchemeUrl('intoss://mandalartplan/today?from=push')).toEqual({ name: 'today' });
    expect(routeFromSchemeUrl('intoss-private://mandalartplan/sub/2')).toEqual({ name: 'sub', sub: 2 });
    expect(routeFromSchemeUrl('https://mandalartplan.apps.tossmini.com/share')).toEqual({ name: 'share' });
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
