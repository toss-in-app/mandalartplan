import { useCallback, useEffect, useRef } from 'react';

import { fullScreenAdsEnabled } from './config';
import { fullScreenAdSupported, loadAd, showAd } from './fullScreen';

export type RewardedOutcome = 'rewarded' | 'dismissed' | 'unavailable';

/**
 * 리워드 광고 1개 (공유 '고화질로 저장', 설정 '두 번째 판'(기능 7)).
 * active 인 동안 미리 불러오고, watch() 가 보여준 뒤 결과를 돌려줘요. 보상은 'rewarded'(userEarnedReward) 일 때만 주세요.
 * 같은 그룹을 동시에 두 번 불러오지 않아요(공식 가이드).
 * 3.0.1: 리워드 광고를 띄우지 않는 동안(`fullScreenAdsEnabled()` false, `free`)은 불러오지 않고 watch() 가 바로 'rewarded' — 기능은 광고 없이 열어 줘요.
 */
export function useRewardedAd(adGroupId: string, active: boolean) {
  const free = !fullScreenAdsEnabled();
  const ready = useRef(false);
  const loading = useRef<Promise<boolean> | null>(null);
  const showing = useRef(false);

  const load = useCallback((): Promise<boolean> => {
    if (ready.current) return Promise.resolve(true);
    if (!fullScreenAdSupported()) return Promise.resolve(false);
    if (!loading.current) {
      loading.current = loadAd(adGroupId).then((ok) => {
        ready.current = ok;
        loading.current = null;
        return ok;
      });
    }
    return loading.current;
  }, [adGroupId]);

  useEffect(() => {
    if (active && !free) void load();
  }, [active, free, load]);

  const watch = useCallback(async (): Promise<RewardedOutcome> => {
    if (free) return 'rewarded';
    if (showing.current) return 'unavailable';
    const ok = await load();
    if (!ok) return 'unavailable';
    showing.current = true;
    ready.current = false;
    const result = await showAd(adGroupId);
    showing.current = false;
    void load(); // load → show → 다음 load
    if (result.rewarded) return 'rewarded';
    return result.shown ? 'dismissed' : 'unavailable';
  }, [adGroupId, free, load]);

  /** supported: 광고 없이 여는 동안엔 토스앱 버전과 상관없이 true. free: 광고 없이 바로 열어 주는 중(AD 표시·안내 문구를 빼요) */
  return { watch, supported: free || fullScreenAdSupported(), free };
}
