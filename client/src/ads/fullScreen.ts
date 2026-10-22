/**
 * 전면·리워드 광고 브릿지(loadFullScreenAd / showFullScreenAd)를 약속(Promise)으로 감싼 것.
 * 두 유형은 같은 API 를 쓰고 광고 그룹 ID 로 유형이 정해져요. 순서는 반드시 load → (loaded 이벤트) → show → (다음 load).
 * 실패·미지원·시간 초과는 모두 "광고 없음" 으로 돌려주고 던지지 않아요 — 호출한 쪽은 광고 없이 흐름을 이어가요.
 *
 * 안드로이드 토스앱은 광고 이벤트가 늦거나 안 오는 일이 있어요(앱인토스 공지 '[공지] Android 광고 로드 관련 이슈 및 개선 사항 안내',
 * '[공지] Android 광고 로드 실패 시 에러 콜백이 호출되지 않는 현상', 공식 FAQ 5.255.0 dismissed 미발생 — 2026-10-22 사용자 실기기 재현).
 * 그래서 이벤트만 믿지 않아요:
 * - 불러오기는 공식 상한인 60초까지 기다려요(토스 측 권고).
 * - 광고가 화면을 덮어 문서가 hidden 이 되면 show 이벤트가 없어도 '떴다'로 봐요. 네이티브가 요청을 받았다(requested)고 하면 뜰 때까지 더 기다려요.
 * - 닫히거나(dismissed) 다시 보이면 1.5초 동안 늦은 userEarnedReward 를 기다린 뒤 판정해요.
 * - 판정한 뒤 10초 안에 온 보상은 onLateReward 로 알려요(호출한 쪽이 다음 번엔 광고 없이 이어가게).
 * - 실패하면 까닭(cause)을 돌려줘 분석 이벤트에 남겨요.
 */
import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';

/** 광고 없음의 까닭(분석 이벤트 cause). unsupported = 이 토스앱 버전이 브릿지를 지원하지 않음 */
export type AdFailCause = 'unsupported' | 'load_timeout' | 'load_error' | 'show_timeout' | 'failed_to_show' | 'show_error';

/** 토스 애즈는 1~2초, 애드몹은 5~20초(최대 60초)까지 걸릴 수 있어요(공식 FAQ). 공식 상한까지 기다려요 */
const LOAD_TIMEOUT_MS = 60_000;
/** show 를 불렀는데 아무 이벤트도 없이 이만큼 지나면 실패로 봐요 */
const SHOW_START_TIMEOUT_MS = 8_000;
/** 네이티브가 요청을 받았다(requested)고 한 뒤에는 뜰 때까지 이만큼 기다려요 */
const SHOW_REQUESTED_TIMEOUT_MS = 20_000;
/** 닫힘·다시 보임 뒤 늦은 userEarnedReward 를 기다리는 시간 */
const REWARD_GRACE_MS = 1_500;
/** 판정한 뒤에도 늦은 보상을 듣는 시간 */
const LATE_REWARD_MS = 10_000;
/** 떠 있는 광고가 닫힘 이벤트 없이 이만큼 지나면 닫힌 것으로 봐요(안전장치) */
const DISMISS_FALLBACK_MS = 120_000;

let supportedCache: boolean | null = null;

/** 이 토스앱 버전이 통합 전면 광고를 지원하는지. 브릿지가 없는 브라우저에서는 false. */
export function fullScreenAdSupported(): boolean {
  if (supportedCache === null) {
    try {
      supportedCache = loadFullScreenAd.isSupported() && showFullScreenAd.isSupported();
    } catch {
      supportedCache = false;
    }
  }
  return supportedCache;
}

export interface LoadAdResult {
  ok: boolean;
  /** ok 가 false 일 때의 까닭 */
  cause?: AdFailCause;
}

/** 광고를 미리 불러와요. loaded 가 오면 ok, 실패·시간 초과면 까닭과 함께 ok=false. */
export function loadAd(adGroupId: string): Promise<LoadAdResult> {
  return new Promise((resolve) => {
    let settled = false;
    let unregister: () => void = () => {};
    const finish = (result: LoadAdResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        unregister();
      } catch {
        /* 무시 */
      }
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, cause: 'load_timeout' }), LOAD_TIMEOUT_MS);
    try {
      unregister = loadFullScreenAd({
        options: { adGroupId },
        onEvent: (event) => {
          if (event.type === 'loaded') finish({ ok: true });
        },
        onError: () => finish({ ok: false, cause: 'load_error' }),
      });
    } catch {
      finish({ ok: false, cause: 'load_error' });
    }
  });
}

export interface ShowAdResult {
  /** 광고가 화면에 떴는지 (미로딩·표시 실패면 false) */
  shown: boolean;
  /** 리워드 광고를 끝까지 봐서 userEarnedReward 가 왔는지. 보상은 이 값이 true 일 때만 줘요 */
  rewarded: boolean;
  /** shown 이 false 일 때의 까닭 */
  cause?: AdFailCause;
}

export interface ShowAdOptions {
  /** 판정이 끝난 뒤 10초 안에 늦게 온 userEarnedReward(리워드 광고만). 한 번만 불러요 */
  onLateReward?: () => void;
}

/** 미리 불러온 광고를 보여주고 닫힐 때까지 기다려요. */
export function showAd(adGroupId: string, { onLateReward }: ShowAdOptions = {}): Promise<ShowAdResult> {
  return new Promise((resolve) => {
    let settled = false;
    let listening = true;
    let shown = false;
    let rewarded = false;
    let wasHidden = false;
    let cause: AdFailCause | undefined;
    let startTimer: ReturnType<typeof setTimeout> | null = null;
    let fallback: ReturnType<typeof setTimeout> | null = null;
    let grace: ReturnType<typeof setTimeout> | null = null;
    let lateTimer: ReturnType<typeof setTimeout> | null = null;
    let unregister: () => void = () => {};

    /** 브릿지 듣기를 끝내요 */
    const release = () => {
      listening = false;
      if (lateTimer) {
        clearTimeout(lateTimer);
        lateTimer = null;
      }
      const off = unregister;
      unregister = () => {};
      try {
        off();
      } catch {
        /* 무시 */
      }
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      for (const timer of [startTimer, fallback, grace]) if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      // 보상 없이 판정했으면 잠깐 더 듣고 있다가 늦게 온 보상을 알려요(안드로이드 이벤트 지연)
      if (!rewarded && onLateReward) lateTimer = setTimeout(release, LATE_REWARD_MS);
      else release();
      resolve({ shown, rewarded, cause: shown ? undefined : (cause ?? 'show_timeout') });
    };
    /** 닫힘·다시 보임: 늦은 보상을 잠깐 기다렸다가 판정해요 */
    const settleSoon = () => {
      if (settled) return;
      if (rewarded) {
        finish();
        return;
      }
      if (!grace) grace = setTimeout(finish, REWARD_GRACE_MS);
    };
    const armStart = (ms: number) => {
      if (startTimer) clearTimeout(startTimer);
      startTimer = setTimeout(() => {
        if (shown) return;
        cause = 'show_timeout';
        finish();
      }, ms);
    };
    const markShown = () => {
      if (shown || settled) return;
      shown = true;
      if (startTimer) {
        clearTimeout(startTimer);
        startTimer = null;
      }
      fallback = setTimeout(finish, DISMISS_FALLBACK_MS);
    };
    /** 광고가 화면을 덮으면 hidden, 닫히면 visible — show·dismissed 이벤트가 안 오는 기기(Android 토스앱 5.255.0 등, 공식 FAQ)의 대비 */
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        wasHidden = true;
        markShown();
        return;
      }
      if (shown && wasHidden) settleSoon();
    };
    armStart(SHOW_START_TIMEOUT_MS);
    document.addEventListener('visibilitychange', onVisibility);

    try {
      unregister = showFullScreenAd({
        options: { adGroupId },
        onEvent: (event) => {
          if (settled) {
            // 판정한 뒤 늦게 온 보상
            if (event.type === 'userEarnedReward' && !rewarded && listening) {
              rewarded = true;
              release();
              onLateReward?.();
            }
            return;
          }
          switch (event.type) {
            case 'requested': // 요청은 받았으니 뜰 때까지 더 기다려요
              if (!shown) armStart(SHOW_REQUESTED_TIMEOUT_MS);
              break;
            case 'show':
            case 'impression':
            case 'clicked':
              markShown();
              break;
            case 'userEarnedReward':
              markShown();
              rewarded = true;
              if (grace) finish(); // 닫힌 뒤 늦게 온 보상 → 바로 판정
              break;
            case 'dismissed':
              settleSoon();
              break;
            case 'failedToShow':
              if (!shown) cause = 'failed_to_show';
              finish();
              break;
            default:
              break;
          }
        },
        onError: () => {
          if (!settled && !shown) cause = 'show_error';
          finish();
        },
      });
    } catch {
      cause = 'show_error';
      finish();
    }
  });
}

/** 테스트용: 지원 여부 캐시를 비워요 */
export function resetFullScreenAdCacheForTests(): void {
  supportedCache = null;
}
