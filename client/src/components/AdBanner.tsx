import { TossAds, type TossAdsAttachBannerResult } from '@apps-in-toss/web-framework';
import { useEffect, useRef, useState } from 'react';

import { ensureBannerSdk } from '../ads/banner';
import { bannerAdsEnabled } from '../ads/config';

interface AdBannerProps {
  adGroupId: string;
}

type Status = 'loading' | 'shown' | 'hidden';

/**
 * 토스 배너 1개 (TossAds.attachBanner, 카드형·라이트·회색 톤). 광고 UI 는 SDK 가 그려요 — 색·글꼴·문구를 바꾸지 않아요(SSP 정책).
 * 초기화 실패·광고 없음·렌더 실패면 영역을 숨기고, 화면을 떠나면 destroy 해요. 자체 refresh 없음.
 * 배너 스위치(`.env` VITE_BANNER_ADS)가 꺼져 있으면(3.0.4~) 아무것도 그리지 않아요 — 부착 요소가 없으니 SDK 초기화도 안 해요.
 */
export function AdBanner({ adGroupId }: AdBannerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const enabled = bannerAdsEnabled();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    let attached: TossAdsAttachBannerResult | null = null;
    void ensureBannerSdk().then((ok) => {
      if (cancelled) return;
      if (!ok) {
        setStatus('hidden');
        return;
      }
      try {
        attached = TossAds.attachBanner(adGroupId, el, {
          theme: 'light',
          tone: 'grey',
          variant: 'card',
          callbacks: {
            onAdRendered: () => {
              if (!cancelled) setStatus('shown');
            },
            onNoFill: () => {
              if (!cancelled) setStatus('hidden');
            },
            onAdFailedToRender: () => {
              if (!cancelled) setStatus('hidden');
            },
          },
        });
      } catch {
        setStatus('hidden');
      }
    });
    return () => {
      cancelled = true;
      try {
        attached?.destroy();
      } catch {
        /* 무시 */
      }
    };
  }, [adGroupId]);

  if (!enabled) return null;
  // 부착 요소 안은 비워 둬요(가이드). 너비는 화면 너비(100%), 높이는 SDK 가 정해요.
  return <div ref={ref} data-testid="ad-banner" style={{ width: '100%', display: status === 'hidden' ? 'none' : 'block' }} />;
}
