/** AI 초안 안내 문구 (화면 시안 plans/2.0-ai-mockup, 토스 라이팅: 해요체·느낌표 없음) */
import { fullScreenAdsEnabled } from '../ads/config';
import { AI_DAILY_RUNS } from './rules';

/** 3.0.1: 리워드 광고를 띄우지 않는 동안엔 '광고를 보면' 문구를 빼요(ads/config.ts) */
const ads = () => fullScreenAdsEnabled();

export const AI_MESSAGES = {
  /** 목표 입력 '광고 보고 만들기' 위 */
  draftCaption: (left: number) => (ads() ? `광고를 끝까지 보면 AI가 초안을 만들어요 · 오늘 ${left}번 남았어요` : `AI가 세부 목표와 실천 초안을 만들어요 · 오늘 ${left}번 남았어요`),
  /** 칸을 일부 채운 판: 목표 입력 '광고 보고 채우기' 위 */
  fillDraftCaption: (left: number) => (ads() ? `광고를 끝까지 보면 AI가 빈 칸을 채워요 · 오늘 ${left}번 남았어요` : `AI가 빈 칸을 채워요 · 오늘 ${left}번 남았어요`),
  /** 칸을 일부 채운 판: 목표 입력 화면 부제 */
  fillDraftSubtitle: (empty: number) => (empty > 0 ? `적어 둔 칸은 그대로 두고 빈 칸 ${empty}개만 채워요` : '채울 빈 칸이 없어요. 칸을 비우면 AI가 채울 수 있어요'),
  /** 미리보기 '다시 만들기' 위 */
  remakeCaption: (left: number) => (ads() ? `다시 만들기는 광고를 한 번 더 봐요 · 오늘 ${left}번 남았어요` : `다시 만들면 오늘 횟수를 한 번 더 써요 · 오늘 ${left}번 남았어요`),
  /** 홈·세부 목표 화면 채우기 버튼 아래 */
  fillCaption: (what: string, left: number) => (ads() ? `${what} 광고를 끝까지 보면 채워져요 · 오늘 ${left}번 남았어요` : `${what} 오늘 ${left}번 남았어요`),
  limit: `오늘 AI 초안 ${AI_DAILY_RUNS}번을 다 썼어요. 내일 다시 만들 수 있어요`,
  /** 거절·실패 뒤: 광고는 봤지만 횟수에는 넣지 않았어요 */
  notCounted: (left: number) => (ads() ? `방금 본 광고는 오늘 횟수에서 빼지 않았어요 · ${left}번 남았어요` : `오늘 횟수에서 빼지 않았어요 · ${left}번 남았어요`),
  refused: '이 목표로는 초안을 만들 수 없어요. 다른 목표로 적어 보세요.',
  /** 홈·세부 목표 화면 채우기가 거절됐을 때 토스트 */
  get refusedFill() {
    return ads() ? '이 내용으로는 AI가 채울 수 없어요. 방금 본 광고는 오늘 횟수에서 빼지 않았어요' : '이 내용으로는 AI가 채울 수 없어요. 오늘 횟수에서 빼지 않았어요';
  },
  dismissed: '광고를 끝까지 보면 AI가 초안을 만들어요',
  serverLimited: '오늘은 AI 초안을 더 만들 수 없어요. 내일 다시 해 주세요',
  retryLater: '잠시 뒤에 다시 해 주세요',
  noAdTitle: '지금은 광고를 불러올 수 없어요',
  noAdBody: 'AI 초안은 광고를 끝까지 본 뒤에 만들어요. 잠시 뒤에 다시 해 주세요.',
  failTitle: '지금은 초안을 만들 수 없어요',
  get failBody() {
    return ads() ? '잠시 뒤에 다시 해 주세요. 방금 본 광고는 오늘 횟수에서 빼지 않았어요.' : '잠시 뒤에 다시 해 주세요. 오늘 횟수에서 빼지 않았어요.';
  },
  careTitle: '지금 마음이 힘들다면',
  careBody: '자살예방 상담전화 109에서 언제든 이야기를 들어 줘요. 이 내용으로는 초안을 만들지 않아요.',
  careCall: '109에 전화하기',
} as const;

/** 자살예방 상담전화 (보건복지부, 24시간) */
export const CARE_PHONE_URL = 'tel:109';
