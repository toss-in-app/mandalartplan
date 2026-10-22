/**
 * 전면·리워드 광고 브릿지(loadFullScreenAd / showFullScreenAd)를 약속(Promise)으로 감싼 것.
 * 두 유형은 같은 API 를 쓰고 광고 그룹 ID 로 유형이 정해져요. 순서는 반드시 load → (loaded 이벤트) → show → (다음 load).
 * 실패·미지원·시간 초과는 모두 "광고 없음" 으로 돌려주고 던지지 않아요 — 호출한 쪽은 광고 없이 흐름을 이어가요.
 *
 * 안드로이드 토스앱은 광고 이벤트가 늦거나 안 와요(앱인토스 공지 '[공지] Android 광고 로드 관련 이슈 및 개선 사항 안내',
 * '[공지] Android 광고 로드 실패 시 에러 콜백이 호출되지 않는 현상', 공식 FAQ 5.255.0 dismissed 미발생).
 * 사용자 2026-10-22 실기기 영상(라이브 2.0.0): 누르자마자 광고가 뜨고 50초를 다 봐 광고 쪽은 '리워드 지급됨'까지 띄웠는데,
 * 앱에는 show·userEarnedReward 가 8초 안에 안 와 "못 띄웠다"로 판정하고 '지금은 광고를 불러올 수 없어요'를 띄웠어요.
 * 그래서 이벤트만 믿지 않아요:
 * - 불러오기는 공식 상한인 60초까지 기다려요(토스 측 권고).
 * - 광고가 화면을 덮으면 문서가 hidden 이 되거나 창이 blur 돼요 → show 이벤트가 없어도 '떴다'로 봐요.
 * - 8초 동안 아무 신호가 없어도 실패로 단정하지 않아요. 광고가 덮고 있으면 화면을 누를 수 없으니, 그 뒤 화면을 누르면 '안 떴다',
 *   누르지 않으면 이벤트·가림이 풀릴 때까지(최대 120초) 기다려요 — 이벤트가 광고가 닫힐 때 한꺼번에 와도 보상을 받아요.
 * - 닫히거나(dismissed) 다시 보이면 1.5초 동안 늦은 userEarnedReward 를 기다린 뒤 판정해요.
 * - 판정한 뒤 120초 안에 온 보상은 onLateReward 로 알려요(호출한 쪽이 다음 번엔 광고 없이 이어가게).
 * - 실패하면 까닭(cause)을 돌려줘 분석 이벤트에 남겨요.
 */
import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';

/** 광고 없음의 까닭(분석 이벤트 cause). unsupported = 이 토스앱 버전이 브릿지를 지원하지 않음 */
export type AdFailCause = 'unsupported' | 'load_timeout' | 'load_error' | 'show_timeout' | 'failed_to_show' | 'show_error';

/** 토스 애즈는 1~2초, 애드몹은 5~20초(최대 60초)까지 걸릴 수 있어요(공식 FAQ). 공식 상한까지 기다려요 */
const LOAD_TIMEOUT_MS = 60_000;
/** show 를 부른 뒤 아무 신호도 없이 이만큼 지나면 '떴는지 모르는' 상태 — 그때부터 화면 터치를 "안 떴다"의 신호로 봐요 */
const SHOW_SIGNAL_MS = 8_000;
/** 아무 신호도 없이 이만큼 지나면 못 띄운 것으로 봐요(리워드 광고 최대 길이보다 길게) */
const SHOW_HARD_CAP_MS = 120_000;
/** 닫힘·다시 보임 뒤 늦은 userEarnedReward 를 기다리는 시간 */
const REWARD_GRACE_MS = 1_500;
/** 판정한 뒤에도 늦은 보상을 듣는 시간 — 광고를 다 보는 동안 이벤트가 밀릴 수 있어 광고 길이만큼 */
const LATE_REWARD_MS = 120_000;
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
  /** 판정이 끝난 뒤 120초 안에 늦게 온 userEarnedReward(리워드 광고만). 한 번만 불러요 */
  onLateReward?: () => void;
}

/** 미리 불러온 광고를 보여주고 닫힐 때까지 기다려요. */
export function showAd(adGroupId: string, { onLateReward }: ShowAdOptions = {}): Promise<ShowAdResult> {
  return new Promise((resolve) => {
    let settled = false;
    let listening = true;
    let shown = false;
    let rewarded = false;
    /** 광고(또는 다른 화면)가 덮어 문서가 가려졌거나 창이 blur 됐는지 */
    let covered = false;
    /** 8초 동안 아무 신호가 없어 떴는지 모르는 상태 */
    let uncertain = false;
    let cause: AdFailCause | undefined;
    let signalTimer: ReturnType<typeof setTimeout> | null = null;
    let capTimer: ReturnType<typeof setTimeout> | null = null;
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
    const removeListeners = () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onCover);
      window.removeEventListener('focus', onUncover);
      document.removeEventListener('pointerdown', onPointer, true);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      for (const timer of [signalTimer, capTimer, fallback, grace]) if (timer) clearTimeout(timer);
      removeListeners();
      // 보상 없이 판정했으면 광고 길이만큼 더 듣고 있다가 늦게 온 보상을 알려요(안드로이드 이벤트 지연)
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
    const markShown = () => {
      if (shown || settled) return;
      shown = true;
      for (const timer of [signalTimer, capTimer]) if (timer) clearTimeout(timer);
      signalTimer = capTimer = null;
      fallback = setTimeout(finish, DISMISS_FALLBACK_MS);
    };
    /** 광고가 화면을 덮으면 hidden/blur, 닫히면 visible/focus — show·dismissed 이벤트가 안 오는 기기의 대비 */
    const onCover = () => {
      covered = true;
      markShown();
    };
    const onUncover = () => {
      if (shown && covered) settleSoon();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onCover();
      else onUncover();
    };
    /** 신호 없이 8초가 지난 뒤 화면을 누르면 광고가 덮고 있지 않은 것 → 못 띄운 것으로 */
    const onPointer = () => {
      if (!uncertain || shown || settled) return;
      cause = 'show_timeout';
      finish();
    };
    signalTimer = setTimeout(() => {
      if (!shown) uncertain = true;
    }, SHOW_SIGNAL_MS);
    capTimer = setTimeout(() => {
      if (shown) return;
      cause = 'show_timeout';
      finish();
    }, SHOW_HARD_CAP_MS);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onCover);
    window.addEventListener('focus', onUncover);
    document.addEventListener('pointerdown', onPointer, true);

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
              markShown(); // 닫힘이 왔다면 떴던 거예요(이벤트가 닫힐 때 몰려오는 기기)
              settleSoon();
              break;
            case 'failedToShow':
              if (!shown) cause = 'failed_to_show';
              finish();
              break;
            default:
              break; // requested: 요청만 성공, 아직 안 뜸
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
