/**
 * 알림 동의 (Notification.requestAgreement) — 콘솔 스마트 발송의 기능성 템플릿(정기 발송 "오늘 실천 체크")에 연결된 알림 동의문을 띄워요.
 * 설계(흐름 문서 '알림 동의 흐름'): 진입·뒤로가기·이탈 때는 절대 묻지 않고, 홈 행·오늘 기록 버튼·설정 행을 사용자가 누른 뒤에만.
 * 결과는 settings.notification(agreed/declined)에 남기고, 거부하면 설정에서만 다시 켤 수 있어요.
 */
import { Notification } from '@apps-in-toss/web-framework';

/**
 * 콘솔 → 스마트 발송 → 기능성 탭의 발송 코드(= 알림 동의문이 연결된 템플릿 코드). 반드시 `mandalartplan-` 로 시작해요(공식 규칙).
 * 콘솔에서 템플릿을 만들면 `.env` 의 VITE_NOTIFICATION_TEMPLATE_CODE 에 넣어요. 개발 빌드에서만 설계상의 코드로 대신해요.
 */
export const NOTIFICATION_TEMPLATE_CODE: string =
  (import.meta.env.VITE_NOTIFICATION_TEMPLATE_CODE ?? '').trim() || (import.meta.env.DEV ? 'mandalartplan-daily-checkin' : '');

/** 알림 동의 기능을 쓸 수 있는지: 템플릿 코드가 있고 토스앱 버전(5.255.0+)이 지원할 때 */
export function notificationAvailable(): boolean {
  if (!NOTIFICATION_TEMPLATE_CODE) return false;
  try {
    return Notification.requestAgreement.isSupported();
  } catch {
    return false;
  }
}

export type AgreementResult = 'agreed' | 'alreadyAgreed' | 'declined' | 'unsupported' | 'failed';

/** 사용자가 동의 화면에서 고르는 시간. 그 안에 결과가 없으면 실패로 봐요 */
const AGREEMENT_TIMEOUT_MS = 120_000;

/** 알림 동의 화면을 띄우고 결과를 기다려요. 던지지 않아요. */
export function requestNotificationAgreement(templateCode: string = NOTIFICATION_TEMPLATE_CODE): Promise<AgreementResult> {
  return new Promise((resolve) => {
    if (!templateCode) {
      resolve('unsupported');
      return;
    }
    let settled = false;
    // 실기기에서 반환값이 함수가 아닌 경우가 있어요(Devtools 메모) → 함수일 때만 해제해요
    let cleanup: unknown = null;
    const finish = (result: AgreementResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (typeof cleanup === 'function') {
        try {
          (cleanup as () => void)();
        } catch {
          /* 무시 */
        }
      }
      resolve(result);
    };
    const timer = setTimeout(() => finish('failed'), AGREEMENT_TIMEOUT_MS);
    try {
      if (!Notification.requestAgreement.isSupported()) {
        finish('unsupported');
        return;
      }
      cleanup = Notification.requestAgreement({
        options: { templateCode },
        onEvent: (result) => {
          switch (result.type) {
            case 'newAgreement':
              finish('agreed');
              break;
            case 'alreadyAgreed':
              finish('alreadyAgreed');
              break;
            case 'agreementRejected':
              finish('declined');
              break;
            default:
              finish('failed');
          }
        },
        onError: (error: unknown) => {
          const code = (error as { code?: unknown } | null)?.code;
          finish(code === 'UNSUPPORTED_APP_VERSION' ? 'unsupported' : 'failed');
        },
      });
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      finish(code === 'UNSUPPORTED_APP_VERSION' ? 'unsupported' : 'failed');
    }
  });
}
