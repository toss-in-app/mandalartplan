import { useCallback, useEffect, useRef } from 'react';

import { type AdFailCause, fullScreenAdSupported, loadAd, showAd } from './fullScreen';

export type RewardedOutcome = 'rewarded' | 'dismissed' | 'unavailable';
/** unavailable 의 까닭(분석 이벤트 cause). busy = 이미 광고를 보여주는 중에 또 부름 */
export type RewardedFailCause = AdFailCause | 'busy';

/** 불러오기에 실패하면 이만큼 뒤에 한 번 더 */
const RETRY_DELAY_MS = 5_000;

export interface RewardedAd {
  /** 광고를 보여주고 결과를 돌려줘요. 보상은 'rewarded'(userEarnedReward) 일 때만 주세요 */
  watch: () => Promise<RewardedOutcome>;
  /** 이 토스앱 버전이 전면·리워드 광고를 지원하는지 */
  supported: boolean;
  /** 마지막 watch 가 unavailable 이었던 까닭(분석용). 성공했거나 아직이면 null */
  failCause: () => RewardedFailCause | null;
}

/**
 * 리워드 광고 1개 (공유 '고화질로 저장', 설정 '두 번째 판'(기능 7), AI 초안(2.0)).
 * active 인 동안 미리 불러오고, watch() 가 보여준 뒤 결과를 돌려줘요. 보상은 'rewarded'(userEarnedReward) 일 때만 주세요.
 * 같은 그룹을 동시에 두 번 불러오지 않아요(공식 가이드).
 *
 * 안드로이드 토스앱의 이벤트 지연(2026-10-22, ads/fullScreen.ts 주석)에 대비해
 * - 불러오기에 실패하면 5초 뒤 한 번 자동으로 다시 불러와요(watch 를 부를 때마다 다시 1회).
 * - 판정이 끝난 뒤 늦게 온 보상은 크레딧으로 남겨 다음 watch 는 광고 없이 바로 'rewarded' — onLateReward 로 알려 주니 토스트로 안내하세요.
 */
export function useRewardedAd(adGroupId: string, active: boolean, onLateReward?: () => void): RewardedAd {
  const ready = useRef(false);
  const loading = useRef<Promise<boolean> | null>(null);
  const showing = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const lateRef = useRef(onLateReward);
  lateRef.current = onLateReward;
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 이번 실패 뒤 자동 재시도를 이미 했는지 */
  const retried = useRef(false);
  /** 마지막 불러오기의 실패 까닭(성공하면 null) */
  const loadCause = useRef<AdFailCause | null>(null);
  /** 마지막 watch 가 unavailable 이었던 까닭 — 뒤에 이어지는 미리 불러오기가 지우지 않아요 */
  const watchCause = useRef<RewardedFailCause | null>(null);
  /** 늦게 온 보상: 다음 watch 는 광고 없이 rewarded */
  const credit = useRef(false);
  const loadRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));

  const load = useCallback((): Promise<boolean> => {
    if (ready.current) return Promise.resolve(true);
    if (!fullScreenAdSupported()) {
      loadCause.current = 'unsupported';
      return Promise.resolve(false);
    }
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    if (!loading.current) {
      loading.current = loadAd(adGroupId).then((result) => {
        ready.current = result.ok;
        loading.current = null;
        if (result.ok) {
          loadCause.current = null;
          retried.current = false;
          return true;
        }
        loadCause.current = result.cause ?? 'load_error';
        if (!retried.current && activeRef.current) {
          retried.current = true;
          retryTimer.current = setTimeout(() => {
            retryTimer.current = null;
            if (activeRef.current && !ready.current) void loadRef.current();
          }, RETRY_DELAY_MS);
        }
        return false;
      });
    }
    return loading.current;
  }, [adGroupId]);
  loadRef.current = load;

  useEffect(() => {
    if (!active) return;
    retried.current = false;
    void load();
  }, [active, load]);

  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  const watch = useCallback(async (): Promise<RewardedOutcome> => {
    if (showing.current) {
      watchCause.current = 'busy';
      return 'unavailable';
    }
    if (credit.current) {
      credit.current = false;
      watchCause.current = null;
      return 'rewarded';
    }
    retried.current = false;
    const ok = await load();
    if (!ok) {
      watchCause.current = loadCause.current ?? 'load_error';
      return 'unavailable';
    }
    showing.current = true;
    ready.current = false;
    const result = await showAd(adGroupId, {
      onLateReward: () => {
        credit.current = true;
        lateRef.current?.();
      },
    });
    showing.current = false;
    void load(); // load → show → 다음 load
    if (result.rewarded || result.shown) {
      watchCause.current = null;
      return result.rewarded ? 'rewarded' : 'dismissed';
    }
    watchCause.current = result.cause ?? 'show_timeout';
    return 'unavailable';
  }, [adGroupId, load]);

  return { watch, supported: fullScreenAdSupported(), failCause: () => watchCause.current ?? loadCause.current };
}
