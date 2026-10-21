/**
 * 기록 위젯 판·대시보드가 같이 쓰는 값(3.0). 컴포넌트가 아닌 것만 모아 둬요(빠른 새로고침 규칙).
 */
import { colors } from '@toss/tds-colors';

import type { Board } from '../../lib/mandalart';
import type { WeekReport, WeekdayWindow } from '../../lib/records';
import type { CheckinRecord } from '../../lib/state';
import type { PeriodRange } from '../../lib/stats';
import { brandColor, withAlpha } from '../../theme';

export interface RecordContext {
  board: Board;
  record: CheckinRecord | undefined;
  /** 'YYYY-MM-DD' */
  today: string;
}

/** 진하기 0~4 색(0 = 회색). 옆 단계와 밝기 차이가 나게 브랜드 색 비율을 띄엄띄엄 */
export const HEAT: readonly string[] = [colors.grey100, withAlpha(brandColor, 0.2), withAlpha(brandColor, 0.42), withAlpha(brandColor, 0.68), brandColor];

/** 하루 도장 수 진하기(0, 1~2, 3~5, 6+ — 지금 월간 달력과 같은 기준) → 색 */
export const DAY_HEAT: readonly string[] = [colors.grey200, withAlpha(brandColor, 0.3), withAlpha(brandColor, 0.6), brandColor];

/** 요일별 평균의 기간 */
export const WEEKDAY_WINDOWS: Array<[WeekdayWindow, string]> = [
  ['4w', '4주'],
  ['8w', '8주'],
  ['all', '전체'],
];

/** 이 기간을 부르는 말: 이번 주·이 주·이번 달·이 달·올해·그해 */
export function scopeWord(range: PeriodRange): string {
  const current = range.offset === 0;
  if (range.period === 'week') return current ? '이번 주' : '이 주';
  if (range.period === 'month') return current ? '이번 달' : '이 달';
  return current ? '올해' : '그해';
}

/** 지난주 리포트 마지막 장 '글로 공유하기'에 담는 글 */
export function reportText(board: Board, report: WeekReport): string {
  const top = report.top[0];
  return [
    `[만다라트] 지난주 리포트 (${report.range.label})`,
    `도장 ${report.checks}개 · 실천한 날 ${report.activeDays}일`,
    top ? `가장 많이 한 실천: ${top.text} ${top.count}번` : '',
    board.goal.trim() ? `목표: ${board.goal.trim()}` : '',
    '토스 앱에서 만다라트로 목표를 함께 실천해요',
  ]
    .filter(Boolean)
    .join('\n');
}
