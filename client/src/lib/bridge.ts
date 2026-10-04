import { Device, Share, type HapticFeedbackType } from '@apps-in-toss/web-framework';

import { withTimeout } from './async';

const BRIDGE_TIMEOUT_MS = 3000;

/** 햅틱. 브라우저 등 미지원 환경에서는 조용히 넘어가요. */
export async function haptic(type: HapticFeedbackType): Promise<void> {
  try {
    await withTimeout(Device.triggerHaptic({ type }), BRIDGE_TIMEOUT_MS);
  } catch {
    /* 무시 */
  }
}

export type ShareResult = 'shared' | 'copied' | 'failed';

/**
 * 토스 공유 시트(Share.sendMessage) → Web Share API → 클립보드 순서로 시도해요.
 * 토스앱 밖(개발 브라우저)에서도 결과를 확인할 수 있게 하기 위한 대체 순서예요.
 */
export async function shareText(message: string): Promise<ShareResult> {
  try {
    await withTimeout(Share.sendMessage({ message }), BRIDGE_TIMEOUT_MS);
    return 'shared';
  } catch {
    /* 다음 수단으로 */
  }
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ text: message });
      return 'shared';
    }
  } catch {
    /* 사용자가 취소했거나 미지원 */
  }
  try {
    await navigator.clipboard.writeText(message);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/**
 * 약관·개인정보처리방침 같은 법적 고지 페이지를 열어요(외부 링크 예외 항목).
 * 토스앱에서는 `Device.openURL`, 브라우저에서는 새 탭.
 */
export async function openUrl(url: string): Promise<void> {
  try {
    await withTimeout(Device.openURL(url), BRIDGE_TIMEOUT_MS);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}
