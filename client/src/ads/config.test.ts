import { afterEach, describe, expect, it, vi } from 'vitest';

// 3.0.2: 'ios' 스위치는 토스앱 플랫폼(Device.os)을 봐요. 브릿지를 흉내 내서 iOS·안드로이드·모름(예외)을 돌려 봐요.
// (Device 를 spread 하면 os getter 가 그 자리에서 실행돼 던지니, 프로토타입 체인 위에 getter 만 얹어요)
const platform = vi.hoisted(() => ({ os: 'ios' as string | undefined, throws: false }));
vi.mock('@apps-in-toss/web-framework', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apps-in-toss/web-framework')>();
  const Device = Object.create(actual.Device, {
    os: {
      get() {
        if (platform.throws) throw new Error('no bridge');
        return platform.os;
      },
    },
  }) as typeof actual.Device;
  return { ...actual, Device };
});

import { fullScreenAdsEnabled } from './config';

describe('fullScreenAdsEnabled (VITE_FULL_SCREEN_ADS: on / ios / off)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    platform.os = 'ios';
    platform.throws = false;
  });

  it("'on' 이면 플랫폼과 무관하게 true, 'off'·빈 값이면 false", () => {
    vi.stubEnv('VITE_FULL_SCREEN_ADS', 'on');
    platform.os = 'android';
    expect(fullScreenAdsEnabled()).toBe(true);
    vi.stubEnv('VITE_FULL_SCREEN_ADS', 'off');
    expect(fullScreenAdsEnabled()).toBe(false);
    vi.stubEnv('VITE_FULL_SCREEN_ADS', '');
    expect(fullScreenAdsEnabled()).toBe(false);
  });

  it("3.0.2 'ios': iOS 토스앱에서만 true, 안드로이드는 false — 부를 때마다 다시 읽어요(Devtools 패널에서 바꾸면 다음 렌더에 반영)", () => {
    vi.stubEnv('VITE_FULL_SCREEN_ADS', 'ios');
    expect(fullScreenAdsEnabled()).toBe(true);
    platform.os = 'android';
    expect(fullScreenAdsEnabled()).toBe(false);
    platform.os = 'ios';
    expect(fullScreenAdsEnabled()).toBe(true);
  });

  it("'ios' 인데 플랫폼을 알 수 없으면(예외·다른 값) false", () => {
    vi.stubEnv('VITE_FULL_SCREEN_ADS', 'ios');
    platform.throws = true;
    expect(fullScreenAdsEnabled()).toBe(false);
    platform.throws = false;
    platform.os = undefined;
    expect(fullScreenAdsEnabled()).toBe(false);
    platform.os = 'ios';
    expect(fullScreenAdsEnabled()).toBe(true);
  });
});
