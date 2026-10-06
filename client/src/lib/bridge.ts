import { Device, File, Share, isMinVersionSupported, requestPermission, type HapticFeedbackType } from '@apps-in-toss/web-framework';

import config from '../../apps-in-toss.config';
import { withTimeout } from './async';

const BRIDGE_TIMEOUT_MS = 3000;
/** 권한 창은 사용자가 고르는 시간이 필요해요 */
const PERMISSION_TIMEOUT_MS = 60_000;
/** 사진첩에 쓰는 시간 */
const SAVE_TIMEOUT_MS = 20_000;

/** 이 미니앱을 여는 딥링크. 공유 링크(Share.createLink)의 path 로 써요. */
export const APP_DEEP_LINK = `intoss://${config.appName}`;

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

/**
 * 토스앱 버전이 이미지 저장(File.saveBase64)을 지원하는지. 미지원이면 저장 버튼을 숨겨요(흐름 문서 '토스앱 버전 낮음').
 * 브릿지가 없는 개발 브라우저에서는 확인할 수 없으니 true 로 보고 저장을 시도해요.
 */
export function canSaveImage(): boolean {
  try {
    return isMinVersionSupported(File.saveBase64.MIN_TOSS_APP_VERSION);
  } catch {
    return true;
  }
}

export type SaveImageResult = 'saved' | 'denied' | 'failed';

/**
 * PNG(base64 본문)를 사진첩에 저장해요. 누른 뒤에만 photos(write) 권한을 묻고, 거부하면 저장하지 않아요.
 * 권한 API 가 없는 환경(브라우저 등)에서는 바로 저장을 시도해요.
 */
export async function saveImageToPhotos(base64: string, fileName: string): Promise<SaveImageResult> {
  try {
    const status = await withTimeout(requestPermission({ name: 'photos', access: 'write' }), PERMISSION_TIMEOUT_MS);
    if (status === 'denied') return 'denied';
  } catch {
    /* 권한 브릿지 없음 → 저장 시도 */
  }
  try {
    await withTimeout(File.saveBase64({ data: base64, fileName, mimeType: 'image/png' }), SAVE_TIMEOUT_MS);
    return 'saved';
  } catch {
    return 'failed';
  }
}

/** 토스 공유 링크(토스앱이 없으면 스토어로). 못 만들면 null. 개인 데이터는 링크에 싣지 않아요. */
export async function createShareLink(ogImageUrl?: string): Promise<string | null> {
  try {
    const link = await withTimeout(Share.createLink({ path: APP_DEEP_LINK, ogImageUrl }), BRIDGE_TIMEOUT_MS);
    return typeof link === 'string' && link.length > 0 ? link : null;
  } catch {
    return null;
  }
}
