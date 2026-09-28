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
