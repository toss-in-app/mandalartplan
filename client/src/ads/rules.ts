import type { SettingsState } from '../lib/state';

/**
 * 전면 광고를 보여줄 수 있는 조건(설계 v2): 오늘 체크가 1개 이상 · 오늘 아직 안 보여줌.
 * 사전 로딩·표시 실패·미지원은 훅(useInterstitial)이 따로 건너뛰어요.
 */
export function interstitialEligible(settings: SettingsState, today: string, todayChecks: number): boolean {
  return todayChecks > 0 && settings.ads.lastInterstitialDate !== today;
}
