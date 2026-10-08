import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ad = vi.hoisted(() => ({
  supported: true,
  load: vi.fn<(id: string) => Promise<boolean>>(),
  show: vi.fn<(id: string) => Promise<{ shown: boolean; rewarded: boolean }>>(),
}));
vi.mock('./fullScreen', () => ({
  fullScreenAdSupported: () => ad.supported,
  loadAd: (id: string) => ad.load(id),
  showAd: (id: string) => ad.show(id),
}));

import { useInterstitial } from './useInterstitial';

describe('useInterstitial (전면: 미리 불러오고, 준비된 것만 보여줘요)', () => {
  afterEach(() => {
    ad.supported = true;
    ad.load.mockReset();
    ad.show.mockReset();
  });

  it('조건이 맞으면 미리 불러오고, 준비됐을 때만 보여줘요. 보여준 뒤엔 다시 불러오지 않아요', async () => {
    ad.load.mockResolvedValue(true);
    ad.show.mockResolvedValue({ shown: true, rewarded: false });
    const { result, rerender } = renderHook(({ eligible }) => useInterstitial('g', eligible), { initialProps: { eligible: false } });
    expect(ad.load).not.toHaveBeenCalled();
    expect(await result.current.show()).toBe('skipped'); // 아직 안 불러옴 → 전환은 막히지 않아요
    rerender({ eligible: true });
    await act(async () => {});
    expect(ad.load).toHaveBeenCalledWith('g');
    expect(await result.current.show()).toBe('shown');
    expect(ad.show).toHaveBeenCalledTimes(1);
    expect(await result.current.show()).toBe('skipped'); // 하루 1회는 호출한 쪽이 막고, 훅은 재로딩하지 않아요
    expect(ad.load).toHaveBeenCalledTimes(1);
  });

  it('불러오기 실패는 2번까지만 다시 시도하고, 띄우다 실패하면 failed', async () => {
    ad.load.mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockResolvedValue(true);
    ad.show.mockResolvedValue({ shown: false, rewarded: false });
    const { result, rerender } = renderHook(({ eligible }) => useInterstitial('g', eligible), { initialProps: { eligible: true } });
    await act(async () => {});
    expect(await result.current.show()).toBe('skipped'); // 1차 실패
    rerender({ eligible: false });
    rerender({ eligible: true });
    await act(async () => {});
    expect(ad.load).toHaveBeenCalledTimes(2);
    expect(await result.current.show()).toBe('failed');
    rerender({ eligible: false });
    rerender({ eligible: true });
    await act(async () => {});
    expect(ad.load).toHaveBeenCalledTimes(2); // 3번째는 없어요
  });

  it('토스앱이 전면 광고를 지원하지 않으면 아무것도 하지 않아요', async () => {
    ad.supported = false;
    const { result } = renderHook(() => useInterstitial('g', true));
    await act(async () => {});
    expect(ad.load).not.toHaveBeenCalled();
    expect(await result.current.show()).toBe('skipped');
  });
});
