import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

type LoadResult = { ok: boolean; cause?: string };
type ShowOptions = { onLateReward?: () => void };
type ShowResult = { shown: boolean; rewarded: boolean; cause?: string };
const ad = vi.hoisted(() => ({
  supported: true,
  load: vi.fn<(id: string) => Promise<{ ok: boolean; cause?: string }>>(),
  show: vi.fn<(id: string, options?: { onLateReward?: () => void }) => Promise<{ shown: boolean; rewarded: boolean; cause?: string }>>(),
}));
vi.mock('./fullScreen', () => ({
  fullScreenAdSupported: () => ad.supported,
  loadAd: (id: string) => ad.load(id),
  showAd: (id: string, options?: ShowOptions) => ad.show(id, options),
}));

import { useRewardedAd } from './useRewardedAd';

const shown = (rewarded: boolean): ShowResult => ({ shown: true, rewarded });

describe('useRewardedAd (보상은 userEarnedReward 일 때만)', () => {
  afterEach(() => {
    ad.supported = true;
    ad.load.mockReset();
    ad.show.mockReset();
    vi.useRealTimers();
  });

  it('끝까지 보면 rewarded, 중간에 닫으면 dismissed, 못 띄우면 unavailable. 보여준 뒤 다음 광고를 미리 불러와요', async () => {
    ad.load.mockResolvedValue({ ok: true });
    ad.show
      .mockResolvedValueOnce(shown(true))
      .mockResolvedValueOnce(shown(false))
      .mockResolvedValueOnce({ shown: false, rewarded: false, cause: 'failed_to_show' });
    const { result } = renderHook(() => useRewardedAd('r', true));
    await act(async () => {});
    expect(ad.load).toHaveBeenCalledTimes(1);
    expect(await result.current.watch()).toBe('rewarded');
    expect(ad.load).toHaveBeenCalledTimes(2); // load → show → 다음 load
    expect(result.current.failCause()).toBeNull();
    expect(await result.current.watch()).toBe('dismissed');
    expect(await result.current.watch()).toBe('unavailable');
    expect(result.current.failCause()).toBe('failed_to_show');
  });

  it('불러오지 못했거나 미지원이면 unavailable 이고 show 를 부르지 않아요. 까닭을 남겨요', async () => {
    ad.load.mockResolvedValue({ ok: false, cause: 'load_timeout' });
    const { result } = renderHook(() => useRewardedAd('r', true));
    await act(async () => {});
    expect(await result.current.watch()).toBe('unavailable');
    expect(result.current.failCause()).toBe('load_timeout');
    expect(ad.show).not.toHaveBeenCalled();
    ad.supported = false;
    const second = renderHook(() => useRewardedAd('r', true));
    expect(second.result.current.supported).toBe(false);
    expect(await second.result.current.watch()).toBe('unavailable');
    expect(second.result.current.failCause()).toBe('unsupported');
  });

  it('같은 그룹을 동시에 두 번 불러오거나 두 번 띄우지 않아요', async () => {
    let resolveLoad: (result: LoadResult) => void = () => {};
    ad.load.mockImplementation(() => new Promise<LoadResult>((r) => (resolveLoad = r)));
    let resolveShow: (v: ShowResult) => void = () => {};
    ad.show.mockImplementation(() => new Promise((r) => (resolveShow = r)));
    const { result, rerender } = renderHook(({ active }) => useRewardedAd('r', active), { initialProps: { active: true } });
    rerender({ active: false });
    rerender({ active: true });
    expect(ad.load).toHaveBeenCalledTimes(1); // 로딩 중이면 다시 부르지 않아요
    const first = result.current.watch();
    resolveLoad({ ok: true });
    await act(async () => {});
    const second = result.current.watch(); // 보여주는 중 → 바로 unavailable
    expect(await second).toBe('unavailable');
    expect(result.current.failCause()).toBe('busy');
    resolveShow(shown(true));
    expect(await first).toBe('rewarded');
    expect(ad.show).toHaveBeenCalledTimes(1);
  });

  it('불러오기에 실패하면 5초 뒤 한 번만 자동으로 다시 불러와요 (안드로이드 이벤트 누락 대비)', async () => {
    vi.useFakeTimers();
    ad.load.mockResolvedValueOnce({ ok: false, cause: 'load_timeout' }).mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useRewardedAd('r', true));
    await act(async () => {});
    expect(ad.load).toHaveBeenCalledTimes(1);
    expect(result.current.failCause()).toBe('load_timeout');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_999);
    });
    expect(ad.load).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2);
    });
    expect(ad.load).toHaveBeenCalledTimes(2);
    expect(result.current.failCause()).toBeNull(); // 재시도가 성공

    ad.load.mockReset();
    ad.load.mockResolvedValue({ ok: false, cause: 'load_error' });
    const twice = renderHook(() => useRewardedAd('r2', true));
    await act(async () => {});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_001);
    });
    expect(ad.load).toHaveBeenCalledTimes(2); // 1차 + 자동 재시도
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(ad.load).toHaveBeenCalledTimes(2); // 자동 재시도는 한 번만
    expect(twice.result.current.failCause()).toBe('load_error');
    expect(await twice.result.current.watch()).toBe('unavailable'); // 누르면 다시 한 번 불러 봐요
    expect(ad.load).toHaveBeenCalledTimes(3);
    expect(ad.show).not.toHaveBeenCalled();
  });

  it('판정한 뒤 늦게 온 보상은 알려 주고 크레딧으로 남겨, 다음 watch 는 광고 없이 rewarded', async () => {
    ad.load.mockResolvedValue({ ok: true });
    let lateReward: (() => void) | undefined;
    ad.show.mockImplementation(async (_id, options) => {
      lateReward = options?.onLateReward;
      return { shown: false, rewarded: false, cause: 'show_timeout' };
    });
    const onLate = vi.fn();
    const { result } = renderHook(() => useRewardedAd('r', true, onLate));
    await act(async () => {});
    expect(await result.current.watch()).toBe('unavailable'); // 이벤트가 늦어 못 띄운 것으로 판정
    expect(result.current.failCause()).toBe('show_timeout');
    act(() => lateReward?.()); // 그 뒤 도착한 userEarnedReward
    expect(onLate).toHaveBeenCalledTimes(1);
    expect(await result.current.watch()).toBe('rewarded');
    expect(ad.show).toHaveBeenCalledTimes(1); // 광고를 다시 보여주지 않아요
    expect(await result.current.watch()).toBe('unavailable'); // 크레딧은 한 번만
  });
});
