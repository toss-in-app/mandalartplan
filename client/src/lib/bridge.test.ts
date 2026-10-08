import { afterEach, describe, expect, it, vi } from 'vitest';

// 권한·사진첩·공유 브릿지를 흉내 내요 (Devtools mock 은 requestPermission 거부를 흉내 내지 못해요).
const sdk = vi.hoisted(() => ({
  permission: 'allowed' as 'allowed' | 'denied' | 'throw',
  save: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  link: vi.fn<() => Promise<string>>(() => Promise.resolve('https://toss.im/share/abc')),
  minSupported: true,
}));
vi.mock('@apps-in-toss/web-framework', () => ({
  requestPermission: (p: { name: string; access: string }) => {
    if (sdk.permission === 'throw') throw new Error('no bridge');
    return Promise.resolve(p.name === 'photos' ? sdk.permission : 'allowed');
  },
  File: { saveBase64: Object.assign(() => sdk.save(), { MIN_TOSS_APP_VERSION: { android: '5.218.0', ios: '5.216.0' } }) },
  Share: { createLink: () => sdk.link(), sendMessage: () => Promise.resolve() },
  Device: { triggerHaptic: () => Promise.resolve(), openURL: () => Promise.resolve() },
  isMinVersionSupported: () => sdk.minSupported,
}));

import { APP_DEEP_LINK, canSaveImage, createShareLink, saveImageToPhotos } from './bridge';

describe('bridge (사진첩 저장 권한 · 공유 링크)', () => {
  afterEach(() => {
    sdk.permission = 'allowed';
    sdk.minSupported = true;
    sdk.save.mockReset();
    sdk.save.mockImplementation(() => Promise.resolve());
    sdk.link.mockReset();
    sdk.link.mockImplementation(() => Promise.resolve('https://toss.im/share/abc'));
  });

  it('권한을 거부하면 저장하지 않고 denied — 글·링크 공유는 호출한 쪽에서 그대로예요', async () => {
    sdk.permission = 'denied';
    expect(await saveImageToPhotos('QUJD', 'mandalart-2026-10-08.png')).toBe('denied');
    expect(sdk.save).not.toHaveBeenCalled();
  });

  it('허용하면 File.saveBase64 로 저장하고, 저장이 실패하면 failed', async () => {
    expect(await saveImageToPhotos('QUJD', 'mandalart-2026-10-08.png')).toBe('saved');
    expect(sdk.save).toHaveBeenCalledTimes(1);
    sdk.save.mockImplementation(() => Promise.reject(new Error('disk')));
    expect(await saveImageToPhotos('QUJD', 'mandalart-2026-10-08.png')).toBe('failed');
  });

  it('권한 브릿지가 없는 환경에서는 바로 저장을 시도해요', async () => {
    sdk.permission = 'throw';
    expect(await saveImageToPhotos('QUJD', 'x.png')).toBe('saved');
  });

  it('공유 링크는 intoss:// 딥링크로 만들고, 못 만들면 null. 토스앱 버전이 낮으면 이미지 저장을 숨겨요', async () => {
    expect(APP_DEEP_LINK).toBe('intoss://mandalartplan');
    expect(await createShareLink('https://toss-in-app.github.io/mandalartplan/og.png')).toBe('https://toss.im/share/abc');
    sdk.link.mockImplementation(() => Promise.reject(new Error('unsupported')));
    expect(await createShareLink()).toBeNull();
    expect(canSaveImage()).toBe(true);
    sdk.minSupported = false;
    expect(canSaveImage()).toBe(false);
  });
});
