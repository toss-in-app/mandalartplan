import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetBannerSdkForTests } from '../ads/banner';
import { AdBanner } from './AdBanner';

/** Devtools mock: initialize → onInitialized, attachBanner → 100ms 뒤 자리표시 div + onAdRendered */
describe('AdBanner', () => {
  beforeEach(() => {
    resetBannerSdkForTests();
  });

  it('초기화 뒤 배너를 붙이고, 화면을 떠나면 지워요', async () => {
    const { unmount } = render(<AdBanner adGroupId="ait-ad-test-banner-id" />);
    const container = screen.getByTestId('ad-banner');
    await waitFor(() => expect(container.querySelector('[data-ait-slot-id]')).not.toBeNull());
    expect(container.style.display).toBe('block');
    unmount();
    expect(document.querySelector('[data-ait-slot-id]')).toBeNull();
  });
});
