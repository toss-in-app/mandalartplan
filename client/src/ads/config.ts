import { Device } from '@apps-in-toss/web-framework';

/**
 * 광고 그룹 ID (계약 contract/events.md '광고 그룹').
 * 라이브 ID 는 콘솔 인앱 광고에서 만든 광고 그룹의 groupId → `.env.production` 의 VITE_AD_GROUP_* (출시 빌드 `vite build` 가 읽어요).
 *
 * 출시 빌드(MODE=production)에는 테스트 ID 문자열이 한 글자도 들어가면 안 돼요 — 콘솔이 번들을 정적으로 검사해
 * 'ait-ad-test-…' 가 있으면 검토를 자동 반려해요(2026-10-19 반려). 그래서 테스트 ID 는 production 이 아닌 모드
 * (개발 서버·vitest·`npm run build:test-ads`)에서만 코드에 남고, 출시 빌드에서는 아래 상수가 null 로 접혀 번들에서 사라져요.
 * `npm run build` 뒤 `scripts/check-release-bundle.mjs` 가 dist 를 다시 검사해요.
 * 개발·QR 테스트는 테스트 ID 로만 — 라이브 ID 로 테스트하면 정책 위반이에요.
 */
const IS_RELEASE_BUILD = import.meta.env.MODE === 'production';

/** 앱인토스 공식 테스트 광고 그룹 ID. 출시 빌드에서는 null. */
export const TEST_AD_GROUPS: { interstitial: string; rewarded: string; banner: string } | null = IS_RELEASE_BUILD
  ? null
  : {
      interstitial: 'ait-ad-test-interstitial-id',
      rewarded: 'ait-ad-test-rewarded-id',
      banner: 'ait-ad-test-banner-id',
    };

function pick(value: string | undefined, fallback: string | undefined): string {
  const v = (value ?? '').trim();
  return v.length > 0 ? v : (fallback ?? '');
}

export const AD_GROUPS = {
  /** `interstitial-today`: 홈 '기록 보기' → today 전환 (전면, 하루 1회) */
  interstitialToday: pick(import.meta.env.VITE_AD_GROUP_INTERSTITIAL_TODAY, TEST_AD_GROUPS?.interstitial),
  /** `rewarded-hd-image`: 공유 '고화질로 저장' (리워드) */
  rewardedHdImage: pick(import.meta.env.VITE_AD_GROUP_REWARDED_HD_IMAGE, TEST_AD_GROUPS?.rewarded),
  /** `rewarded-extra-board`: 설정 '두 번째 만다라트 판' (리워드, 기능 7) */
  rewardedExtraBoard: pick(import.meta.env.VITE_AD_GROUP_REWARDED_EXTRA_BOARD, TEST_AD_GROUPS?.rewarded),
  /** `banner-today`: 기록 화면 맨 아래, 모든 탭 (배너 1개) */
  bannerToday: pick(import.meta.env.VITE_AD_GROUP_BANNER_TODAY, TEST_AD_GROUPS?.banner),
  /** `rewarded-ai-draft`: AI 초안 만들기·다시 만들기·빈 칸 채우기·실천 추천 (리워드, 2.0 — 광고 1회 = AI 1회). 3.0.3 까지 '두 번째 판' 지면을 같이 쓰고 전용 지면은 3.0.4 부터(예정) */
  rewardedAiDraft: pick(import.meta.env.VITE_AD_GROUP_REWARDED_AI_DRAFT, TEST_AD_GROUPS?.rewarded),
} as const;

/** 하나라도 비어 있거나 테스트 ID 면 true. 출시 번들에서는 false 여야 해요. */
export const USING_TEST_AD_GROUPS = Object.values(AD_GROUPS).some(
  (id) => id.length === 0 || (TEST_AD_GROUPS !== null && (Object.values(TEST_AD_GROUPS) as string[]).includes(id)),
);

/**
 * 전면·리워드 광고를 띄울지. `.env` 의 `VITE_FULL_SCREEN_ADS`:
 * - 'on': 모두 띄워요(3.0.0 까지, 3.0.3 부터 다시 — 사용자 2026-10-29 '안드로이드도 다시 켜')
 * - 'ios': iOS 토스앱에서만 띄워요(3.0.2, 사용자 2026-10-23 결정 '지금 현재 배포된 것에서 iOS 만') — 안드로이드는 off 와 같아요
 * - 그 밖(off): 띄우지 않아요(3.0.1, 사용자 2026-10-22 결정 '토스 쪽 광고 문제가 해결될 때까지 리워드 광고를 띄우지 말자, 배너만 남기자' ·
 *   3.0.4, 사용자 2026-10-29 '광고 다 떼어버려 지금 광고에 문제 있어' — 이때는 배너도 꺼요)
 * 띄우지 않을 때는 전면(홈 '기록 보기')·리워드(고화질 저장·두 번째 판·AI 초안)를 부르지 않고 그 기능은 광고 없이 바로 열어 줘요(AD 표시·'광고 보고' 문구도 빠져요).
 * 배너(기록 화면)는 따로 `VITE_BANNER_ADS`(bannerAdsEnabled)가 정해요.
 * 배경: 안드로이드 토스앱이 광고 이벤트를 늦게/안 보내 광고를 다 보고도 보상이 인정되지 않던 것(2026-10-22 실기기 영상, 개발자 커뮤니티 공지 4304·4529).
 * iOS 는 이벤트가 정상이라 3.0.2 부터 iOS 만 켜요. 안드로이드가 고쳐지면 `.env` 를 on 으로 바꾸고 빌드만 하면 돼요 — 코드·광고 그룹 ID·콘솔 지면은 그대로예요.
 * 테스트는 vite.config 의 test.env 로 on 이라 광고 흐름을 계속 검사하고, off·ios 는 `vi.stubEnv` 로 따로 검사해요(config.test.ts·App.adsOff.test.tsx).
 */
export function fullScreenAdsEnabled(): boolean {
  const mode = import.meta.env.VITE_FULL_SCREEN_ADS;
  if (mode === 'on') return true;
  if (mode === 'ios') return platformIsIos();
  return false;
}

/**
 * 배너 광고를 붙일지. `.env` 의 `VITE_BANNER_ADS` 가 'on' 일 때만 — 기록 화면·기록 자세히·주간 리포트 마지막 장의 배너 1개(`banner-today`).
 * 3.0.3 까지는 스위치 없이 늘 붙였고, 3.0.4 부터 off(사용자 2026-10-29 '광고 다 떼어버려 지금 광고에 문제 있어').
 * 끄면 배너 자리(위아래 여백)도 빼고, AdBanner 는 아무것도 그리지 않아 배너 SDK 를 초기화하지도 않아요.
 * 테스트는 vite.config 의 test.env 로 on 이고, off 는 `vi.stubEnv` 로 따로 검사해요(config.test.ts·AdBanner.test.tsx·records.test.tsx).
 */
export function bannerAdsEnabled(): boolean {
  return import.meta.env.VITE_BANNER_ADS === 'on';
}

/**
 * 토스앱이 iOS 인지. `Device.os` 는 호스트가 주입한 상수를 읽는 가벼운 값이라 부를 때마다 읽어요(캐시 없음) — 예외나 'ios' 가 아닌 값이면 false(광고 없음).
 * AIT Devtools 가 붙은 개발 서버·vitest 에서는 Devtools 모의 브릿지가 패널의 Environment > OS 값을 돌려줘요(기본 ios, 2026-10-23 확인) —
 * 개발 서버에선 테스트 광고가 켜진 채로 보이고, 패널에서 android 로 바꾸면 다음 렌더부터 꺼져요(패널 값은 새로고침하면 ios 로 돌아가요).
 * 호스트도 Devtools 도 없는 보통 브라우저에서는 SDK 가 예외를 던져 광고 없음.
 */
function platformIsIos(): boolean {
  try {
    return Device.os === 'ios';
  } catch {
    return false;
  }
}
