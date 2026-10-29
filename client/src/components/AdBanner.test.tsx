import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetBannerSdkForTests } from '../ads/banner';
import { AdBanner } from './AdBanner';

/** Devtools mock: initialize → onInitialized, attachBanner → 100ms 뒤 자리표시 div + onAdRendered */
describe('AdBanner', () => {
  beforeEach(() => {
    resetBannerSdkForTests();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('초기화 뒤 배너를 붙이고, 화면을 떠나면 지워요', async () => {
    const { unmount } = render(<AdBanner adGroupId="ait-ad-test-banner-id" />);
    const container = screen.getByTestId('ad-banner');
    await waitFor(() => expect(container.querySelector('[data-ait-slot-id]')).not.toBeNull());
    expect(container.style.display).toBe('block');
    unmount();
    expect(document.querySelector('[data-ait-slot-id]')).toBeNull();
  });

  it("3.0.4: 배너 스위치(VITE_BANNER_ADS)가 'off' 면 아무것도 그리지 않고 배너를 붙이지 않아요", async () => {
    vi.stubEnv('VITE_BANNER_ADS', 'off');
    const { container } = render(<AdBanner adGroupId="ait-ad-test-banner-id" />);
    expect(container).toBeEmptyDOMElement();
    await new Promise((resolve) => setTimeout(resolve, 150)); // 붙였다면 Devtools mock 이 100ms 뒤 자리표시를 넣어요
    expect(document.querySelector('[data-ait-slot-id]')).toBeNull();
  });
});
