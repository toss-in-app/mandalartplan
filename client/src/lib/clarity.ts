import Clarity from '@microsoft/clarity';

/**
 * Microsoft Clarity(화면 녹화·히트맵, 3.0.3). 출시 빌드(MODE=production)에서 `.env.production` 의 VITE_CLARITY_PROJECT_ID 가 있고
 * 설정 '사용 기록 분석'(settings.analytics.replay)이 켜져 있을 때만 App 이 불러요 — 개발 서버·vitest·QR 테스트 광고 번들(`build:test-ads`)은 녹화하지 않아요.
 * 가림은 콘솔 마스킹 '균형 잡힘'(사용자 2026-10-29)을 따라요: 입력칸·숫자·이메일은 가리고, 화면 글(적은 목표·실천 포함)은 녹화에 담겨요 — 개인정보처리방침 4-1.
 * 토스 사용자 식별값은 보내지 않아요(identify 안 씀). 불러오다 실패해도 앱은 그대로예요.
 */
export function startClarity({ mode, projectId, version }: { mode: string; projectId: string | undefined; version: string }): boolean {
  const id = (projectId ?? '').trim();
  if (mode !== 'production' || id.length === 0) return false;
  try {
    Clarity.init(id);
    Clarity.setTag('app_version', version);
    return true;
  } catch {
    return false;
  }
}

/**
 * '사용 기록 분석'을 끌 때: 클라리티 쿠키를 바로 지워요(consent false). 열려 있는 동안 기록을 멈추는 공식 API 는 없어서,
 * 다음에 앱을 열 때부터는 App 이 아예 불러오지 않아요. 불러온 적이 없으면 아무것도 하지 않아요.
 */
export function stopClarity(): void {
  try {
    if (typeof window.clarity === 'function') Clarity.consent(false);
  } catch {
    // 실패해도 앱은 그대로
  }
}

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}
