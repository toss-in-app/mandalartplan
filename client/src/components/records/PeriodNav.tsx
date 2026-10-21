import { colors } from '@toss/tds-colors';
import { IconButton, Text } from '@toss/tds-mobile';

import type { CheckinRecord } from '../../lib/state';
import { canGoNext, canGoPrev, type PeriodRange } from '../../lib/stats';

const WORDS: Record<PeriodRange['period'], { prev: string; next: string }> = {
  week: { prev: '지난주', next: '다음 주' },
  month: { prev: '지난달', next: '다음 달' },
  year: { prev: '작년', next: '다음 해' },
};

interface NavButtonProps {
  direction: 'prev' | 'next';
  label: string;
  disabled: boolean;
  onClick: () => void;
}

/** 기간 옮기기 버튼. TDS IconButton + 화살표, 터치 영역은 records.css 에서 44px 이상으로 */
function NavButton({ direction, label, disabled, onClick }: NavButtonProps) {
  return (
    <IconButton
      name={direction === 'prev' ? 'icon-arrow-left-small-mono' : 'icon-arrow-right-small-mono'}
      variant="fill"
      className="rc-nav-btn"
      color={disabled ? colors.grey300 : colors.grey800}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    />
  );
}

/** '‹ 2026년 10월 ›' — 앞은 기록이 있을 때만, 뒤는 이번 기간까지만(지금 기록 화면과 같아요) */
export function PeriodNav({ range, record, onMove }: { range: PeriodRange; record: CheckinRecord | undefined; onMove: (offset: number) => void }) {
  const words = WORDS[range.period];
  return (
    <div className="rc-nav">
      <NavButton direction="prev" label={words.prev} disabled={!canGoPrev(range, record)} onClick={() => onMove(range.offset - 1)} />
      <div className="rc-nav-label">
        <Text typography="t5" fontWeight="semibold" color={colors.grey900}>
          {range.label}
        </Text>
      </div>
      <NavButton direction="next" label={words.next} disabled={!canGoNext(range)} onClick={() => onMove(range.offset + 1)} />
    </div>
  );
}
