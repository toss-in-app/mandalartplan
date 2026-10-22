import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = { onEvent: (event: { type: string; data?: unknown }) => void; onError: (error: Error) => void };
const loads: Handler[] = [];
const shows: Handler[] = [];

// 브릿지를 직접 흉내 내서 이벤트 순서를 제어해요 (Devtools mock 은 리워드를 안 줘요).
vi.mock('@apps-in-toss/web-framework', () => ({
  loadFullScreenAd: Object.assign(
    (params: Handler) => {
      loads.push(params);
      return () => {};
    },
    { isSupported: () => true },
  ),
  showFullScreenAd: Object.assign(
    (params: Handler) => {
      shows.push(params);
      return () => {};
    },
    { isSupported: () => true },
  ),
}));

import { fullScreenAdSupported, loadAd, resetFullScreenAdCacheForTests, showAd } from './fullScreen';

const reward = { type: 'userEarnedReward', data: { unitType: 'hd', unitAmount: 1 } };

/** 약속이 아직 안 끝났는지 보는 깃발 */
function flag<T>(promise: Promise<T>): { done: boolean } {
  const f = { done: false };
  void promise.then(() => {
    f.done = true;
  });
  return f;
}

describe('fullScreen ads', () => {
  let visibility: ReturnType<typeof vi.spyOn>;
  const setVisibility = (state: 'hidden' | 'visible') => {
    visibility.mockReturnValue(state);
    document.dispatchEvent(new Event('visibilitychange'));
  };

  beforeEach(() => {
    loads.length = 0;
    shows.length = 0;
    resetFullScreenAdCacheForTests();
    vi.useFakeTimers();
    visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  });
  afterEach(() => {
    visibility.mockRestore();
    vi.useRealTimers();
  });

  it('지원 여부를 캐시하고, loaded 면 ok · 에러면 load_error · 60초(공식 상한) 안에 안 오면 load_timeout', async () => {
    expect(fullScreenAdSupported()).toBe(true);

    const ok = loadAd('g');
    loads[0].onEvent({ type: 'loaded' });
    await expect(ok).resolves.toEqual({ ok: true });

    const bad = loadAd('g');
    loads[1].onError(new Error('no fill'));
    await expect(bad).resolves.toEqual({ ok: false, cause: 'load_error' });

    const slow = loadAd('g');
    const slowFlag = flag(slow);
    await vi.advanceTimersByTimeAsync(59_000); // 예전 30초에서는 포기했을 시간
    expect(slowFlag.done).toBe(false);
    await vi.advanceTimersByTimeAsync(1_001);
    await expect(slow).resolves.toEqual({ ok: false, cause: 'load_timeout' });
  });

  it('show → dismissed 는 1.5초 동안 늦은 보상을 기다렸다 shown, userEarnedReward 가 왔으면 바로 rewarded', async () => {
    const plain = showAd('g');
    const plainFlag = flag(plain);
    shows[0].onEvent({ type: 'requested' });
    shows[0].onEvent({ type: 'show' });
    shows[0].onEvent({ type: 'dismissed' });
    await vi.advanceTimersByTimeAsync(1_400);
    expect(plainFlag.done).toBe(false); // 아직 보상이 올 수 있어요
    await vi.advanceTimersByTimeAsync(101);
    await expect(plain).resolves.toEqual({ shown: true, rewarded: false });

    const rewarded = showAd('g');
    shows[1].onEvent({ type: 'show' });
    shows[1].onEvent(reward);
    shows[1].onEvent({ type: 'dismissed' });
    await expect(rewarded).resolves.toEqual({ shown: true, rewarded: true }); // 기다리지 않아요

    const late = showAd('g'); // 닫힌 뒤 1.5초 안에 온 보상(안드로이드 이벤트 지연)
    shows[2].onEvent({ type: 'show' });
    shows[2].onEvent({ type: 'dismissed' });
    await vi.advanceTimersByTimeAsync(800);
    shows[2].onEvent(reward);
    await expect(late).resolves.toEqual({ shown: true, rewarded: true });
  });

  it('failedToShow · onError · 아무 이벤트 없이 8초면 shown=false 와 까닭. requested 가 왔으면 20초까지 기다려요', async () => {
    const failed = showAd('g');
    shows[0].onEvent({ type: 'failedToShow' });
    await expect(failed).resolves.toEqual({ shown: false, rewarded: false, cause: 'failed_to_show' });

    const errored = showAd('g');
    shows[1].onError(new Error('not loaded'));
    await expect(errored).resolves.toEqual({ shown: false, rewarded: false, cause: 'show_error' });

    const silent = showAd('g');
    await vi.advanceTimersByTimeAsync(8_001);
    await expect(silent).resolves.toEqual({ shown: false, rewarded: false, cause: 'show_timeout' });

    const requested = showAd('g');
    const requestedFlag = flag(requested);
    shows[3].onEvent({ type: 'requested' });
    await vi.advanceTimersByTimeAsync(8_001);
    expect(requestedFlag.done).toBe(false);
    await vi.advanceTimersByTimeAsync(12_000);
    await expect(requested).resolves.toEqual({ shown: false, rewarded: false, cause: 'show_timeout' });
  });

  it('show 이벤트가 안 와도 광고가 화면을 덮어 hidden 이 되면 뜬 것으로, 닫힘 이벤트가 안 와도 다시 보이면 1.5초 뒤 닫힌 것으로 봐요', async () => {
    const pending = showAd('g');
    const pendingFlag = flag(pending);
    setVisibility('hidden'); // 아무 이벤트 없이 가려짐
    await vi.advanceTimersByTimeAsync(9_000); // 8초 타임아웃이 켜져 있으면 여기서 실패했을 거예요
    expect(pendingFlag.done).toBe(false);
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(1_400);
    expect(pendingFlag.done).toBe(false);
    await vi.advanceTimersByTimeAsync(101);
    await expect(pending).resolves.toEqual({ shown: true, rewarded: false });

    const rewardedWhileBack = showAd('g'); // 다시 보인 직후 몰려온 이벤트
    setVisibility('hidden');
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(300);
    shows[1].onEvent(reward);
    await expect(rewardedWhileBack).resolves.toEqual({ shown: true, rewarded: true });
  });

  it('판정한 뒤 10초 안에 온 보상은 onLateReward 로 한 번 알리고, 그 뒤에 온 것은 무시해요', async () => {
    const late = vi.fn();
    const silent = showAd('g', { onLateReward: late });
    await vi.advanceTimersByTimeAsync(8_001);
    await expect(silent).resolves.toEqual({ shown: false, rewarded: false, cause: 'show_timeout' });
    await vi.advanceTimersByTimeAsync(3_000);
    shows[0].onEvent(reward);
    shows[0].onEvent(reward);
    expect(late).toHaveBeenCalledTimes(1);

    const tooLate = vi.fn();
    const gone = showAd('g', { onLateReward: tooLate });
    await vi.advanceTimersByTimeAsync(8_001);
    await expect(gone).resolves.toMatchObject({ shown: false });
    await vi.advanceTimersByTimeAsync(10_001);
    shows[1].onEvent(reward);
    expect(tooLate).not.toHaveBeenCalled();

    const none = showAd('g'); // 콜백이 없으면 듣지 않아요
    await vi.advanceTimersByTimeAsync(8_001);
    await expect(none).resolves.toMatchObject({ shown: false });
    shows[2].onEvent(reward);
    expect(late).toHaveBeenCalledTimes(1);
  });
});
