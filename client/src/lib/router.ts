import { Environment } from '@apps-in-toss/web-framework';
import { useEffect, useState } from 'react';

/**
 * 해시 기반 화면 전환.
 *
 * `history.pushState` 로 히스토리를 쌓기 때문에 앱인토스 네비게이션 바의 뒤로가기와
 * Android 시스템 백버튼이 그대로 "이전 화면" 으로 동작하고, 첫 화면에서는 미니앱이 종료돼요.
 * `history.state.depth` 로 앱 안에서 쌓은 깊이를 기억해, 딥링크로 바로 들어온 화면에서는
 * '완료' 가 뒤로가기 대신 홈으로 바꿔요.
 *
 * 딥링크(`intoss://mandalart/checkin`)는 `Environment.initialURL` 로 읽어 첫 화면을 정해요.
 */

export type Route =
  | { name: 'home' }
  | { name: 'block'; block: number }
  | { name: 'checkin' }
  | { name: 'share' }
  | { name: 'settings' };

export function parseRoute(hash: string): Route {
  const block = /^#\/block\/([0-8])$/.exec(hash);
  if (block) return { name: 'block', block: Number(block[1]) };
  if (hash === '#/checkin') return { name: 'checkin' };
  if (hash === '#/share') return { name: 'share' };
  if (hash === '#/settings') return { name: 'settings' };
  return { name: 'home' };
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'block':
      return `#/block/${route.block}`;
    case 'home':
      return '#/';
    default:
      return `#/${route.name}`;
  }
}

/** `intoss://mandalart/checkin?x=1` 같은 스킴 URL 에서 첫 화면을 골라요. 모르면 null. */
export function routeFromSchemeUrl(url: string): Route | null {
  const match = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]+\/?([^?#]*)/i.exec(url.trim());
  if (!match) return null;
  const path = match[1].replace(/\/+$/, '');
  if (path === '') return { name: 'home' };
  return parseRoute(`#/${path}`);
}

function initialRoute(): Route {
  const fromHash = window.location.hash;
  if (fromHash && fromHash !== '#/' && fromHash !== '#') return parseRoute(fromHash);
  try {
    const route = routeFromSchemeUrl(Environment.initialURL ?? '');
    if (route && route.name !== 'home') {
      window.history.replaceState({ depth: 0 }, '', routeToHash(route));
      return route;
    }
  } catch {
    /* 브라우저 등 브릿지가 없으면 홈 */
  }
  return { name: 'home' };
}

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function currentDepth(): number {
  const state: unknown = window.history.state;
  if (state && typeof state === 'object' && typeof (state as { depth?: unknown }).depth === 'number') {
    return (state as { depth: number }).depth;
  }
  return 0;
}

export function navigate(route: Route): void {
  const hash = routeToHash(route);
  if (window.location.hash === hash) return;
  window.history.pushState({ depth: currentDepth() + 1 }, '', hash);
  emit();
}

export function goBack(): void {
  if (currentDepth() > 0) {
    window.history.back();
    return;
  }
  window.history.replaceState({ depth: 0 }, '', '#/');
  emit();
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(initialRoute);

  useEffect(() => {
    const update = () => setRoute(parseRoute(window.location.hash));
    listeners.add(update);
    window.addEventListener('popstate', update);
    window.addEventListener('hashchange', update);
    return () => {
      listeners.delete(update);
      window.removeEventListener('popstate', update);
      window.removeEventListener('hashchange', update);
    };
  }, []);

  return route;
}
