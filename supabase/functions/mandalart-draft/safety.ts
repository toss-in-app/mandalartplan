/**
 * 자해·자살 표현 (설계 '안전'). 걸리면 Claude 를 부르지 않고 `self_harm` 을 돌려줘요(하루 호출 수에도 넣지 않음).
 * 앱(`client/src/ai/safety.ts`)에도 같은 목록이 있어요 — 바꾸면 둘 다(앱 테스트 `safety.test.ts` 가 맞춰 봐요).
 * 띄어쓰기를 지운 글에서 찾아요. '유서 깊은'·'목매다(매달리다)' 처럼 다른 뜻으로 흔히 쓰는 말은 넣지 않았어요.
 */
export const SELF_HARM_SOURCES: readonly string[] = [
  '죽고싶',
  '자살(?!예방)',
  '자해',
  '극단적인?선택',
  '목숨을?끊',
  '스스로목숨',
  '생을마감',
  '삶을끝',
  '사라지고싶',
  '없어지고싶',
  '살기싫',
  '손목을?긋',
];

const PATTERNS = SELF_HARM_SOURCES.map((source) => new RegExp(source));

export function looksLikeSelfHarm(...texts: string[]): boolean {
  return texts.some((text) => {
    const compact = text.replace(/\s+/g, '');
    return compact.length > 0 && PATTERNS.some((pattern) => pattern.test(compact));
  });
}
