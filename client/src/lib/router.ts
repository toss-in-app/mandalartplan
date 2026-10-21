import { Environment, graniteEvent } from '@apps-in-toss/web-framework';
import { useEffect, useState } from 'react';

import { isRecordWidgetId, type RecordWidgetId } from './widgets';

/**
 * 해시 기반 화면 전환.
 *
 * 토스앱의 네비게이션 바 뒤로가기(‹)와 Android 백버튼은 웹뷰 히스토리 뒤로가기로 동작하고,
 * 히스토리 바닥(첫 화면)에서는 토스앱이 종료 확인 창을 띄워요(커뮤니티 3052, 토스 답변).
 * 그래서 화면 전환은 `history.pushState` 로만 쌓고, `replaceState` 는 쓰지 않아요 —
 * replaceState 를 하면 첫 화면 판정이 깨져 종료 창이 안 뜨는 사례가 있어요(커뮤니티 852·3107).
 *
 * 딥링크(`intoss://mandalartplan/today`)는 `Environment.initialURL` 로 읽어, 히스토리 바닥 항목이
 * 그릴 화면(`baseRoute`)만 메모리에 바꿔요. URL 은 건드리지 않아요.
 */

export type Route =
  | { name: 'home' }
  | { name: 'sub'; sub: number }
  /**
   * 예전 편집 화면 링크(콘솔 앱 내 기능 '만다라트 작성' = `block/4`). 편집 화면은 2.1 에서 없어져
   * 그 3×3 화면(가운데 = 홈, 둘레 = 세부 목표 화면)을 편집 모드로 열어요. cell 이 있으면 그 칸 입력창도
   */
  | { name: 'block'; block: number; cell?: number }
  | { name: 'overview' }
  /** 기록 위젯 판 (3.0 — 이름은 예전 '오늘 기록' 그대로라 딥링크 `today` 도 여기로) */
  | { name: 'today' }
  /** 위젯을 눌러 여는 그 위젯의 대시보드 (3.0) */
  | { name: 'record'; widget: RecordWidgetId }
  | { name: 'share' }
  | { name: 'settings' }
  /** AI 초안 만들기 (2.0) */
  | { name: 'draft' }
  /** 1분 체험판 (2.1) — 예시 판에서 도장·편집·AI 를 미리 해 봐요. 저장하지 않아요 */
  | { name: 'trial' };

const HOME: Route = { name: 'home' };

export function parseRoute(hash: string): Route {
  const block = /^#\/block\/([0-8])(?:\/([0-8]))?$/.exec(hash);
  if (block) return block[2] === undefined ? { name: 'block', block: Number(block[1]) } : { name: 'block', block: Number(block[1]), cell: Number(block[2]) };
  const sub = /^#\/sub\/([0-7])$/.exec(hash);
  if (sub) return { name: 'sub', sub: Number(sub[1]) };
  const record = /^#\/record\/([a-z0-9]+)$/.exec(hash);
  if (record && isRecordWidgetId(record[1])) return { name: 'record', widget: record[1] };
  if (hash === '#/overview') return { name: 'overview' };
  if (hash === '#/today' || hash === '#/checkin') return { name: 'today' };
  if (hash === '#/share') return { name: 'share' };
  if (hash === '#/settings') return { name: 'settings' };
  if (hash === '#/draft') return { name: 'draft' };
  if (hash === '#/trial') return { name: 'trial' };
  return HOME;
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'block':
      // 뒤의 칸 번호는 편집 모드로 열며 입력창을 띄울 칸
      return route.cell === undefined ? `#/block/${route.block}` : `#/block/${route.block}/${route.cell}`;
    case 'sub':
      return `#/sub/${route.sub}`;
    case 'record':
      return `#/record/${route.widget}`;
    case 'home':
      return '#/';
    default:
      return `#/${route.name}`;
  }
}

/** `intoss://mandalartplan/today?x=1` 같은 스킴 URL 에서 첫 화면을 골라요. 모르면 null. */
export function routeFromSchemeUrl(url: string): Route | null {
  const match = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]+\/?([^?#]*)/i.exec(url.trim());
  if (!match) return null;
  const path = match[1].replace(/\/+$/, '');
  if (path === '') return HOME;
  return parseRoute(`#/${path}`);
}

/** 해시가 비어 있으면(히스토리 바닥) base 화면, 아니면 해시가 가리키는 화면 */
export function resolveHash(hash: string, base: Route): Route {
  if (!hash || hash === '#' || hash === '#/') return base;
  return parseRoute(hash);
}

/** 히스토리 바닥 항목이 그리는 화면. 딥링크로 들어오면 그 화면, 아니면 홈 */
let baseRoute: Route = HOME;

function currentRoute(): Route {
  return resolveHash(window.location.hash, baseRoute);
}

function initialRoute(): Route {
  try {
    const fromScheme = routeFromSchemeUrl(Environment.initialURL ?? '');
    if (fromScheme && fromScheme.name !== 'home') baseRoute = fromScheme;
  } catch {
    /* 브라우저 등 브릿지가 없으면 홈 */
  }
  return currentRoute();
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

/** 지금 화면이 히스토리 바닥(첫 화면 또는 딥링크로 바로 들어온 화면)인지. 여기서 뒤로가기는 미니앱 종료예요. */
export function atHistoryBottom(): boolean {
  return currentDepth() === 0;
}

export function navigate(route: Route): void {
  const hash = routeToHash(route);
  if (window.location.hash === hash) return;
  window.history.pushState({ depth: currentDepth() + 1 }, '', hash);
  emit();
}

/** 이전 화면으로. 히스토리 바닥(딥링크로 바로 들어온 화면)이면 URL 은 그대로 두고 홈을 그려요. */
export function goBack(): void {
  if (currentDepth() > 0) {
    window.history.back();
    return;
  }
  baseRoute = HOME;
  emit();
}

/**
 * 개발 빌드 전용. AIT Devtools 의 모의 네비게이션 바 뒤로가기(‹)는 히스토리를 움직이지 않고
 * `backEvent` 만 쏘기 때문에, 여기서 받아 실제 토스앱과 같은 동작(히스토리 뒤로가기)을 흉내 내요.
 * 출시 번들에는 들어가지 않아요 — 토스앱에서는 backEvent 를 구독하면 기본 뒤로가기·종료 창이 막혀요.
 */
export function installDevBackHandler(): () => void {
  if (!import.meta.env.DEV) return () => {};
  try {
    return graniteEvent.addEventListener('backEvent', {
      onEvent: () => {
        if (currentDepth() > 0) window.history.back();
        else console.info('[mandalart] 첫 화면에서 뒤로가기 — 토스앱에서는 종료 확인 창이 떠요');
      },
    });
  } catch {
    return () => {};
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(initialRoute);

  useEffect(() => {
    const update = () => setRoute(currentRoute());
    listeners.add(update);
    window.addEventListener('popstate', update);
    window.addEventListener('hashchange', update);
    const uninstall = installDevBackHandler();
    return () => {
      listeners.delete(update);
      window.removeEventListener('popstate', update);
      window.removeEventListener('hashchange', update);
      uninstall();
    };
  }, []);

  return route;
}
