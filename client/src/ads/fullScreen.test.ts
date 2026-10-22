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
const touch = () => document.dispatchEvent(new Event('pointerdown', { bubbles: true }));

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

  it('안드로이드처럼 이벤트가 광고가 닫힐 때 한꺼번에 와도(50초 뒤) 보상을 받아요 — 2026-10-22 실기기 영상', async () => {
    const video = showAd('g');
    const videoFlag = flag(video);
    await vi.advanceTimersByTimeAsync(50_000); // 광고를 보는 동안 아무 이벤트도, 가림 신호도 없음
    expect(videoFlag.done).toBe(false); // 예전엔 8초에 '못 띄웠다'로 끝내 버렸어요
    shows[0].onEvent(reward);
    shows[0].onEvent({ type: 'dismissed' });
    await expect(video).resolves.toEqual({ shown: true, rewarded: true });

    const closedOnly = showAd('g'); // 닫힘 이벤트만 늦게 오면: 뜬 건 맞고 보상은 1.5초 더 기다려요
    await vi.advanceTimersByTimeAsync(30_000);
    shows[1].onEvent({ type: 'dismissed' });
    await vi.advanceTimersByTimeAsync(1_501);
    await expect(closedOnly).resolves.toEqual({ shown: true, rewarded: false });
  });

  it('failedToShow · onError 는 바로 실패. 신호가 없으면 8초 뒤 화면 터치가 "안 떴다"의 신호, 터치도 없으면 120초에 포기', async () => {
    const failed = showAd('g');
    shows[0].onEvent({ type: 'failedToShow' });
    await expect(failed).resolves.toEqual({ shown: false, rewarded: false, cause: 'failed_to_show' });

    const errored = showAd('g');
    shows[1].onError(new Error('not loaded'));
    await expect(errored).resolves.toEqual({ shown: false, rewarded: false, cause: 'show_error' });

    const touched = showAd('g');
    const touchedFlag = flag(touched);
    await vi.advanceTimersByTimeAsync(3_000);
    touch(); // 8초 전의 터치는 무시(광고가 막 뜨려는 참일 수 있어요)
    await vi.advanceTimersByTimeAsync(5_001);
    expect(touchedFlag.done).toBe(false);
    touch();
    await expect(touched).resolves.toEqual({ shown: false, rewarded: false, cause: 'show_timeout' });

    const untouched = showAd('g');
    const untouchedFlag = flag(untouched);
    await vi.advanceTimersByTimeAsync(119_000);
    expect(untouchedFlag.done).toBe(false);
    await vi.advanceTimersByTimeAsync(1_001);
    await expect(untouched).resolves.toEqual({ shown: false, rewarded: false, cause: 'show_timeout' });
  });

  it('show 이벤트가 안 와도 광고가 화면을 덮어 hidden/blur 가 되면 뜬 것으로, 닫힘 이벤트가 안 와도 다시 보이면 1.5초 뒤 닫힌 것으로 봐요', async () => {
    const pending = showAd('g');
    const pendingFlag = flag(pending);
    setVisibility('hidden'); // 아무 이벤트 없이 가려짐
    await vi.advanceTimersByTimeAsync(9_000);
    touch(); // 가려진 뒤의 터치는 신호가 아니에요
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

    const blurred = showAd('g'); // visibilitychange 대신 창 blur/focus 만 오는 기기
    const blurredFlag = flag(blurred);
    window.dispatchEvent(new Event('blur'));
    await vi.advanceTimersByTimeAsync(20_000);
    expect(blurredFlag.done).toBe(false);
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(1_501);
    await expect(blurred).resolves.toEqual({ shown: true, rewarded: false });
  });

  it('판정한 뒤 120초 안에 온 보상은 onLateReward 로 한 번 알리고, 그 뒤에 온 것은 무시해요', async () => {
    const late = vi.fn();
    const silent = showAd('g', { onLateReward: late });
    await vi.advanceTimersByTimeAsync(8_001);
    touch();
    await expect(silent).resolves.toEqual({ shown: false, rewarded: false, cause: 'show_timeout' });
    await vi.advanceTimersByTimeAsync(60_000);
    shows[0].onEvent(reward);
    shows[0].onEvent(reward);
    expect(late).toHaveBeenCalledTimes(1);

    const tooLate = vi.fn();
    const gone = showAd('g', { onLateReward: tooLate });
    await vi.advanceTimersByTimeAsync(8_001);
    touch();
    await expect(gone).resolves.toMatchObject({ shown: false });
    await vi.advanceTimersByTimeAsync(120_001);
    shows[1].onEvent(reward);
    expect(tooLate).not.toHaveBeenCalled();

    const none = showAd('g'); // 콜백이 없으면 듣지 않아요
    await vi.advanceTimersByTimeAsync(8_001);
    touch();
    await expect(none).resolves.toMatchObject({ shown: false });
    shows[2].onEvent(reward);
    expect(late).toHaveBeenCalledTimes(1);
  });
});
