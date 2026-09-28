import { describe, expect, it } from 'vitest';

import { applyCheckin, checkedInSub, checkinGroups, formatDateLabel, todayChecked, todaySet, toggleCheck } from './checkin';
import { actionIndex, createEmptyBoard } from './mandalart';
import { MAX_CHECKIN_DAYS, createEmptyCheckins, dateKey, streak } from './state';

const NOW = 1759000000000;

function sampleBoard() {
  const board = createEmptyBoard(NOW);
  board.goal = '책 쓰기';
  board.subs[0].title = '글쓰기 습관';
  board.subs[0].actions[0] = '매일 300자';
  board.subs[0].actions[3] = '주말 초고';
  board.subs[5].actions[7] = '독서 30분'; // 제목 없는 세부 목표
  return board;
}

describe('checkinGroups / checkedInSub', () => {
  it('글이 있는 실천만 세부 목표별로 묶고, 제목이 없으면 번호로 불러요', () => {
    const groups = checkinGroups(sampleBoard());
    expect(groups.map((g) => g.title)).toEqual(['글쓰기 습관', '세부 목표 6']);
    expect(groups[0].items.map((i) => [i.index, i.text])).toEqual([
      [0, '매일 300자'],
      [3, '주말 초고'],
    ]);
    expect(groups[1].items[0].index).toBe(actionIndex(5, 7));
  });

  it('빈 판은 그룹이 없어요', () => {
    expect(checkinGroups(createEmptyBoard(NOW))).toEqual([]);
  });

  it('세부 목표 안의 오늘 체크 수를 세요', () => {
    const checked = new Set([actionIndex(0, 0), actionIndex(0, 3), actionIndex(5, 7)]);
    expect(checkedInSub(checked, 0)).toBe(2);
    expect(checkedInSub(checked, 5)).toBe(1);
    expect(checkedInSub(checked, 1)).toBe(0);
  });
});

describe('toggleCheck / applyCheckin', () => {
  it('탭하면 체크, 다시 탭하면 해제되고, 0개가 되면 그날 기록이 사라져요', () => {
    let c = createEmptyCheckins();
    c = toggleCheck(c, 'b1', '2026-09-29', 3, NOW);
    expect(todayChecked(c.byBoard.b1, '2026-09-29')).toEqual([3]);
    c = toggleCheck(c, 'b1', '2026-09-29', 0, NOW + 1);
    expect(todayChecked(c.byBoard.b1, '2026-09-29')).toEqual([0, 3]);
    expect(todaySet(c.byBoard.b1, '2026-09-29')).toEqual(new Set([0, 3]));
    c = toggleCheck(c, 'b1', '2026-09-29', 3, NOW + 2);
    c = toggleCheck(c, 'b1', '2026-09-29', 0, NOW + 3);
    expect(c.byBoard.b1.days['2026-09-29']).toBeUndefined();
    expect(todayChecked(c.byBoard.b1, '2026-09-29')).toEqual([]);
    expect(c.byBoard.b1.lastCompletedAt).toBe(NOW + 3);
  });

  it('연속 일수는 하나라도 체크한 날로 이어져요', () => {
    let c = createEmptyCheckins();
    c = toggleCheck(c, 'b1', '2026-09-27', 1, NOW);
    c = toggleCheck(c, 'b1', '2026-09-28', 1, NOW);
    expect(streak(c.byBoard.b1, '2026-09-28')).toBe(2);
    expect(streak(c.byBoard.b1, '2026-09-29')).toBe(2); // 오늘 아직 안 했으면 어제까지
    c = toggleCheck(c, 'b1', '2026-09-28', 1, NOW); // 어제 것을 해제 → 기록 삭제
    expect(streak(c.byBoard.b1, '2026-09-29')).toBe(0);
  });

  it('applyCheckin 은 정리·중복 제거하고 다른 판은 건드리지 않아요', () => {
    let c = applyCheckin(createEmptyCheckins(), 'b1', '2026-09-29', [3, 0, 3, 99, -1], NOW);
    expect(c.byBoard.b1.days['2026-09-29']).toEqual([0, 3]);
    c = applyCheckin(c, 'b2', '2026-09-29', [2], NOW);
    expect(c.byBoard.b1.days['2026-09-29']).toEqual([0, 3]);
    expect(c.byBoard.b2.days['2026-09-29']).toEqual([2]);
    expect(todayChecked(undefined, '2026-09-29')).toEqual([]);
  });

  it('오래된 날은 MAX_CHECKIN_DAYS 만 남겨요', () => {
    let c = createEmptyCheckins();
    for (let i = 0; i < MAX_CHECKIN_DAYS + 5; i += 1) {
      c = applyCheckin(c, 'b1', dateKey(new Date(2025, 0, 1 + i)), [i % 64], NOW + i);
    }
    const keys = Object.keys(c.byBoard.b1.days).sort();
    expect(keys).toHaveLength(MAX_CHECKIN_DAYS);
    expect(keys[0]).toBe(dateKey(new Date(2025, 0, 6)));
  });
});

describe('formatDateLabel', () => {
  it('월·일만 보여요', () => {
    expect(formatDateLabel('2026-09-29')).toBe('9월 29일');
    expect(formatDateLabel('2027-01-05')).toBe('1월 5일');
  });
});
