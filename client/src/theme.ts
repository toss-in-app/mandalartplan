import { colors } from '@toss/tds-colors';

import config from '../apps-in-toss.config';

/** apps-in-toss.config.ts 의 브랜드 색. TDS 버튼에도 같은 색이 들어가요. */
export const brandColor = config.brand.primaryColor;

/** `#RRGGBB` 를 투명도가 있는 rgba 로 바꿔요. 형식이 다르면 그대로 돌려줘요. */
export function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const n = parseInt(match[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** `#RRGGBB` 를 검정과 섞어 어둡게 해요(amount 0~1). 형식이 다르면 그대로 돌려줘요. */
export function shade(hex: string, amount: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const n = parseInt(match[1], 16);
  const channel = (v: number) => Math.round(v * (1 - amount)).toString(16).padStart(2, '0');
  return `#${channel((n >> 16) & 255)}${channel((n >> 8) & 255)}${channel(n & 255)}`;
}

/** 두 `#RRGGBB` 색을 t(0~1)만큼 섞어 `#rrggbb` 로 돌려줘요 */
function mix(from: string, to: string, t: number): string {
  const rgb = (hex: string) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const a = rgb(from);
  const b = rgb(to);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** `withAlpha(hex, alpha)` 를 흰 바탕 위에 올린 것과 같은 불투명 색. 들어 올린 칸처럼 다른 칸 위를 지나가도 밑이 비치지 않아야 할 때 */
export function opaqueTint(hex: string, alpha: number): string {
  return /^#([0-9a-f]{6})$/i.test(hex.trim()) ? mix('#ffffff', hex.trim(), alpha) : hex;
}

/** 실천을 오늘 다 한 세부 목표 칸: 흰 바탕에 브랜드 색 48% — 꽉 찬 핵심 목표 칸보다는 확실히 연하고, grey900 글자 대비 8:1 이상 */
const SUB_DONE_FILL = mix('#ffffff', brandColor, 0.48);

/**
 * 세부 목표 칸 바탕 — 오늘 진행을 보여 주는 화면(홈·세부 목표 화면 가운데·전체 보기·공유 이미지). 2.1 사용자 결정:
 * 아직 하나도 안 했으면 실천 칸처럼 회색, 하는 중엔 회색과 '다 함' 색 사이를 오늘 한 비율만큼 섞어 점점 보라로 차올라요
 * (첫 도장에서 20% 지점부터 시작해 변화가 바로 보이고, 8개 중 7개여도 80% 지점 아래라) 다 하는 순간 SUB_DONE_FILL 로
 * 한 번 더 확 진해져요(+ 모서리 도장).
 * 오늘 정보가 없는 화면(편집 모드·AI 초안 미리보기)은 이 함수를 쓰지 않고 옅은 보라 14% 그대로
 */
export function subProgressFill(progress: number, completed: boolean): string {
  if (completed) return SUB_DONE_FILL;
  if (progress <= 0) return colors.grey100;
  return mix(colors.grey100, SUB_DONE_FILL, 0.2 + 0.6 * Math.min(progress, 1));
}

/** '완료' 도장 잉크(오늘 한 실천). 브랜드 색 그대로는 옅은 칸 위 글자 대비가 4.4:1 이라 15% 어둡게 — 5.7:1 */
export const stampInk = shade(brandColor, 0.15);
