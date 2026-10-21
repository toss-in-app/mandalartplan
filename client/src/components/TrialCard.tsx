import { colors } from '@toss/tds-colors';
import { Button, Text } from '@toss/tds-mobile';

import { brandColor, stampInk, withAlpha } from '../theme';

interface TrialCardProps {
  /** AI 초안을 쓸 수 있는 기기면 체험판에 AI 미리보기 단계가 있어요 → 문구에 AI 를 넣어요 */
  ai: boolean;
  onOpen: () => void;
  onClose: () => void;
}

/** 카드 왼쪽의 작은 판 그림(장식): 가운데는 핵심 목표, 왼쪽 위 칸에는 '완료' 도장 */
function MiniBoard() {
  return (
    <span
      aria-hidden
      style={{
        flexShrink: 0,
        width: 64,
        height: 64,
        padding: 7,
        boxSizing: 'border-box',
        borderRadius: 12,
        background: colors.white,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 3,
      }}
    >
      {Array.from({ length: 9 }, (_, cell) => (
        <span
          key={cell}
          style={{
            borderRadius: 3,
            background: cell === 4 ? brandColor : cell === 0 ? colors.grey100 : colors.grey200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {cell === 0 && <span style={{ width: 10, height: 10, borderRadius: '50%', border: `1.5px solid ${stampInk}`, boxSizing: 'border-box' }} />}
        </span>
      ))}
    </span>
  );
}

/**
 * 홈 맨 위 '1분 체험' 안내 카드(2.1, 사용자 결정 2026-10-21 — 강조 시안 A). 처음 온 사람에게만 보여요:
 * 실천을 적기 전, ✕로 닫거나 체험판을 끝까지 하기 전까지(`settings.trial.cardDismissedAt`).
 * 화면을 가리지 않는 제자리 카드라 들어오자마자 띄워도 돼요(앱인토스 다크패턴은 진입 즉시 화면을 가리는 바텀시트).
 */
export function TrialCard({ ai, onOpen, onClose }: TrialCardProps) {
  return (
    <section
      aria-label="1분 체험 안내"
      style={{
        position: 'relative',
        margin: '0 20px 16px',
        padding: 16,
        borderRadius: 16,
        background: withAlpha(brandColor, 0.08),
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
      }}
    >
      <MiniBoard />
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4, paddingRight: 24 }}>
        <Text typography="t5" fontWeight="bold" color={colors.grey900} display="block">
          처음이세요? 1분 체험부터
        </Text>
        <Text typography="t7" color={colors.grey700} display="block">
          {ai ? '예시 판에서 도장 찍기·고치기·AI를 미리 해 봐요.' : '예시 판에서 도장 찍기·고치기를 미리 해 봐요.'} 저장되지 않아요.
        </Text>
        <div style={{ marginTop: 8 }}>
          <Button size="small" onClick={onOpen}>
            1분 체험해 보기
          </Button>
        </div>
      </div>
      <button
        type="button"
        aria-label="안내 닫기"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 44,
          height: 44,
          padding: 0,
          border: 0,
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.grey600} strokeWidth={2} strokeLinecap="round" aria-hidden focusable="false">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </section>
  );
}
