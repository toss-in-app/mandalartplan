// vitest 공통 설정: jest-dom 매처 + jsdom 에 없는 브라우저 API 흉내
import '@testing-library/jest-dom/vitest';
import { webcrypto } from 'node:crypto';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
if (!window.ResizeObserver) window.ResizeObserver = NoopObserver as unknown as typeof ResizeObserver;
if (!window.IntersectionObserver) window.IntersectionObserver = NoopObserver as unknown as typeof IntersectionObserver;
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

// TDS(Radix focus guard)가 난독화된 선택자로 querySelectorAll 을 호출하는데 jsdom 이 "Invalid selector" 로 던져요.
// 브라우저에서는 문제없는 코드라, 테스트에서만 잘못된 선택자를 빈 결과로 돌려줘요.
for (const proto of [Document.prototype, Element.prototype, DocumentFragment.prototype]) {
  const original = proto.querySelectorAll;
  proto.querySelectorAll = function patched(this: ParentNode, selectors: string) {
    try {
      return original.call(this, selectors);
    } catch (error) {
      // jsdom 의 DOMException 은 Error 의 instanceof 가 아니라 name/code 로 봐요
      const e = error as { name?: string; code?: number } | null;
      if (e && (e.name === 'SyntaxError' || e.code === 12)) return [] as unknown as NodeListOf<Element>;
      throw error;
    }
  } as typeof proto.querySelectorAll;
}

// jsdom 에는 crypto.subtle 이 없어요 → Node 의 Web Crypto 로 (백업 키 sha256)
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
