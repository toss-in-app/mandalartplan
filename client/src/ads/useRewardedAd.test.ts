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

import { useRewardedAd } from './useRewardedAd';

describe('useRewardedAd (보상은 userEarnedReward 일 때만)', () => {
  afterEach(() => {
    ad.supported = true;
    ad.load.mockReset();
    ad.show.mockReset();
  });

  it('끝까지 보면 rewarded, 중간에 닫으면 dismissed, 못 띄우면 unavailable. 보여준 뒤 다음 광고를 미리 불러와요', async () => {
    ad.load.mockResolvedValue(true);
    ad.show
      .mockResolvedValueOnce({ shown: true, rewarded: true })
      .mockResolvedValueOnce({ shown: true, rewarded: false })
      .mockResolvedValueOnce({ shown: false, rewarded: false });
    const { result } = renderHook(() => useRewardedAd('r', true));
    await act(async () => {});
    expect(ad.load).toHaveBeenCalledTimes(1);
    expect(await result.current.watch()).toBe('rewarded');
    expect(ad.load).toHaveBeenCalledTimes(2); // load → show → 다음 load
    expect(await result.current.watch()).toBe('dismissed');
    expect(await result.current.watch()).toBe('unavailable');
  });

  it('불러오지 못했거나 미지원이면 unavailable 이고 show 를 부르지 않아요', async () => {
    ad.load.mockResolvedValue(false);
    const { result } = renderHook(() => useRewardedAd('r', true));
    await act(async () => {});
    expect(await result.current.watch()).toBe('unavailable');
    expect(ad.show).not.toHaveBeenCalled();
    ad.supported = false;
    const second = renderHook(() => useRewardedAd('r', true));
    expect(second.result.current.supported).toBe(false);
    expect(await second.result.current.watch()).toBe('unavailable');
  });

  it('같은 그룹을 동시에 두 번 불러오거나 두 번 띄우지 않아요', async () => {
    let resolveLoad: (ok: boolean) => void = () => {};
    ad.load.mockImplementation(() => new Promise<boolean>((r) => (resolveLoad = r)));
    let resolveShow: (v: { shown: boolean; rewarded: boolean }) => void = () => {};
    ad.show.mockImplementation(() => new Promise((r) => (resolveShow = r)));
    const { result, rerender } = renderHook(({ active }) => useRewardedAd('r', active), { initialProps: { active: true } });
    rerender({ active: false });
    rerender({ active: true });
    expect(ad.load).toHaveBeenCalledTimes(1); // 로딩 중이면 다시 부르지 않아요
    const first = result.current.watch();
    resolveLoad(true);
    await act(async () => {});
    const second = result.current.watch(); // 보여주는 중 → 바로 unavailable
    expect(await second).toBe('unavailable');
    resolveShow({ shown: true, rewarded: true });
    expect(await first).toBe('rewarded');
    expect(ad.show).toHaveBeenCalledTimes(1);
  });
});
