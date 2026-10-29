import Clarity from '@microsoft/clarity';

/**
 * Microsoft Clarity(화면 녹화·히트맵, 3.0.3). 출시 빌드(MODE=production)에서 `.env.production` 의 VITE_CLARITY_PROJECT_ID 가 있을 때만 켜요 —
 * 개발 서버·vitest·QR 테스트 광고 번들(`build:test-ads`)은 녹화하지 않아요.
 * 화면 글자는 index.html 의 `<body data-clarity-mask="True">` 로 전부 가려요(가린 내용은 보내지 않아요 — 콘솔 마스킹 Strict 와 별개로 코드에서 보장).
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
