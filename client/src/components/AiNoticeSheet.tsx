import { colors } from '@toss/tds-colors';
import { BottomSheet, CTAButton, Text, TextButton } from '@toss/tds-mobile';
import type { ReactNode } from 'react';

import { brandColor, withAlpha } from '../theme';

function NoticeIcon({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        background: withAlpha(brandColor, 0.1),
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={brandColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

function NoticeItem({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <NoticeIcon>{icon}</NoticeIcon>
      <Text typography="t6" color={colors.grey700} display="block">
        {children}
      </Text>
    </li>
  );
}

interface AiNoticeSheetProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onPrivacy: () => void;
}

/**
 * 생성형 AI 사전 고지 (서비스 오픈 정책 2-4). AI 버튼을 처음 누른 뒤 한 번만 — 화면에 들어오자마자 띄우지 않아요.
 * 닫으면 광고도 AI 도 실행하지 않아요. 왼쪽 버튼은 '닫기'(TDS 다이얼로그 규칙).
 */
export function AiNoticeSheet({ open, onClose, onConfirm, onPrivacy }: AiNoticeSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      header={<BottomSheet.Header>AI로 초안을 만들어요</BottomSheet.Header>}
      cta={
        <BottomSheet.DoubleCTA
          leftButton={
            <CTAButton color="dark" variant="weak" onClick={onClose}>
              닫기
            </CTAButton>
          }
          rightButton={<CTAButton onClick={onConfirm}>확인</CTAButton>}
        />
      }
    >
      <div style={{ padding: '4px 24px 0' }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <NoticeItem icon={<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />}>생성형 AI(Anthropic Claude)가 세부 목표와 실천을 채워요.</NoticeItem>
          <NoticeItem icon={<path d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9s1.3-6.3 3.8-9z" />}>
            적은 목표와 판의 글은 초안을 만들 때만 미국 Anthropic으로 보내요. 만다라트는 이 글을 저장하지 않아요.
          </NoticeItem>
          <NoticeItem icon={<path d="M3 12V4h8l9 9-8 8-9-9zM7.5 7.5h.01" />}>결과에는 'AI 초안' 표시가 붙어요. 내 상황에 맞게 고쳐 써 주세요.</NoticeItem>
        </ul>
        <div style={{ padding: '12px 0 4px' }}>
          <TextButton size="small" variant="underline" color={colors.grey600} onClick={onPrivacy}>
            개인정보 처리방침 보기
          </TextButton>
        </div>
      </div>
    </BottomSheet>
  );
}
