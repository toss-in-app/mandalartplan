import { useCallback, useEffect, useRef } from 'react';

import { fullScreenAdSupported, loadAd, showAd } from './fullScreen';

type Phase = 'idle' | 'loading' | 'ready' | 'showing';

/**
 * 전면 광고 1개 (홈 '오늘 기록 보기' → today 전환).
 * eligible 이 true 가 되면 미리 불러오고, show() 는 준비된 광고가 있을 때만 보여줘요 — 없으면 바로 'skipped' 라 전환이 막히지 않아요.
 * 불러오기는 2번까지만 시도하고, 보여준 뒤에는 다시 불러오지 않아요(하루 1회는 호출한 쪽이 settings 로 막아요).
 */
export function useInterstitial(adGroupId: string, eligible: boolean) {
  const phase = useRef<Phase>('idle');
  const attempts = useRef(0);

  const preload = useCallback(() => {
    if (!fullScreenAdSupported() || phase.current !== 'idle' || attempts.current >= 2) return;
    phase.current = 'loading';
    attempts.current += 1;
    void loadAd(adGroupId).then((ok) => {
      if (phase.current === 'loading') phase.current = ok ? 'ready' : 'idle';
    });
  }, [adGroupId]);

  useEffect(() => {
    if (eligible) preload();
  }, [eligible, preload]);

  /** 준비된 광고를 보여주고 닫힐 때까지 기다려요. 준비 안 됐으면 바로 'skipped'. */
  const show = useCallback(async (): Promise<'shown' | 'skipped'> => {
    if (phase.current !== 'ready') return 'skipped';
    phase.current = 'showing';
    const result = await showAd(adGroupId);
    phase.current = 'idle';
    return result.shown ? 'shown' : 'skipped';
  }, [adGroupId]);

  return { show };
}
