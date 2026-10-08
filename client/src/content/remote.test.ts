import { afterEach, describe, expect, it, vi } from 'vitest';

import { CONTENT_CLIENT_VERSION, fetchRemoteContent, getBundledContent } from './index';

/** 원격 content.json 을 흉내 내요. 응답이 없거나(네트워크) 형식이 다르면 번들본을 써야 해요. */
function stubFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

describe('fetchRemoteContent (원격 실패 시 번들 대체)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('네트워크 실패·HTTP 오류·깨진 JSON 은 null → 호출한 쪽이 번들본을 그대로 써요', async () => {
    stubFetch(() => Promise.reject(new TypeError('offline')));
    expect(await fetchRemoteContent('https://example.test/content.json')).toBeNull();
    stubFetch(() => json({ error: 'down' }, 503));
    expect(await fetchRemoteContent('https://example.test/content.json')).toBeNull();
    stubFetch(() => Promise.resolve(new Response('not json', { status: 200 })));
    expect(await fetchRemoteContent('https://example.test/content.json')).toBeNull();
  });

  it('minClientVersion 이 클라보다 높거나 contentVersion 이 번들보다 낮으면 버려요', async () => {
    const bundled = getBundledContent();
    stubFetch(() => json({ ...bundled, contentVersion: bundled.contentVersion + 1, minClientVersion: CONTENT_CLIENT_VERSION + 1 }));
    expect(await fetchRemoteContent('https://example.test/content.json')).toBeNull();
    stubFetch(() => json({ ...bundled, contentVersion: bundled.contentVersion - 1 }));
    expect(await fetchRemoteContent('https://example.test/content.json')).toBeNull();
  });

  it('계약대로인 새 버전이면 그걸 써요 (공지·시즌 갱신)', async () => {
    const bundled = getBundledContent();
    stubFetch(() => json({ ...bundled, contentVersion: bundled.contentVersion + 1, notice: '새 공지예요' }));
    const remote = await fetchRemoteContent('https://example.test/content.json');
    expect(remote?.contentVersion).toBe(bundled.contentVersion + 1);
    expect(remote?.notice).toBe('새 공지예요');
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('https://example.test/content.json', { cache: 'no-store' });
  });
});
