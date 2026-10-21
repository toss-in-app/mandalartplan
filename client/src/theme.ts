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

/** '완료' 도장 잉크(오늘 한 실천). 브랜드 색 그대로는 옅은 칸 위 글자 대비가 4.4:1 이라 15% 어둡게 — 5.7:1 */
export const stampInk = shade(brandColor, 0.15);
