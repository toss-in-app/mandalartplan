import { useEffect, useState } from 'react';

/**
 * 해시 기반 화면 전환.
 *
 * `history.pushState` 로 히스토리를 쌓기 때문에 앱인토스 네비게이션 바의 뒤로가기와
 * Android 시스템 백버튼이 그대로 "이전 화면" 으로 동작하고, 첫 화면에서는 미니앱이 종료돼요.
 * `history.state.depth` 로 앱 안에서 쌓은 깊이를 기억해, 딥링크로 블록 화면에 바로 들어온
 * 경우에는 뒤로가기 대신 홈으로 바꿔요.
 */

export type Route = { name: 'home' } | { name: 'block'; block: number };

export function parseRoute(hash: string): Route {
  const match = /^#\/block\/([0-8])$/.exec(hash);
  if (match) return { name: 'block', block: Number(match[1]) };
  return { name: 'home' };
}

export function routeToHash(route: Route): string {
  return route.name === 'block' ? `#/block/${route.block}` : '#/';
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
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

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
