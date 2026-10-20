import { brandColor, withAlpha } from '../theme';

/** 브랜드 보라 틴트 위에서 글자 대비 4.5:1 이상이 되도록 한 단계 진한 보라 */
const BADGE_TEXT = '#5443e6';

/**
 * 'AI 초안' 표시 (서비스 오픈 정책 2-4: AI 결과물에 바로 알아볼 수 있는 표시). 제목 위(Top subtitleTop)에 둬요.
 * TDS Badge 색(blue·teal·green·red·yellow·elephant)은 브랜드 보라와 맞지 않아 직접 그려요.
 */
export function AiDraftBadge() {
  return (
    <span
      style={{
        display: 'inline-block',
        // Top 의 subtitleTop 자리는 세로 flex 라 그대로 두면 폭이 늘어나요 → 글자만큼만
        alignSelf: 'flex-start',
        width: 'fit-content',
        padding: '3px 8px',
        borderRadius: 6,
        background: withAlpha(brandColor, 0.12),
        color: BADGE_TEXT,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: '16px',
      }}
    >
      AI 초안
    </span>
  );
}

/** 버튼 안의 AD 표시(광고가 나오는 버튼, 노출 정책 UX 원칙 2). onBrand = 브랜드 색 버튼 위 */
export function AdMark({ onBrand }: { onBrand: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        padding: '1px 5px',
        borderRadius: 4,
        background: onBrand ? '#ffffff' : brandColor,
        color: onBrand ? brandColor : '#ffffff',
        fontSize: 11,
        fontWeight: 700,
        lineHeight: '16px',
      }}
    >
      AD
    </span>
  );
}
