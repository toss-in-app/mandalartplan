import { describe, expect, it } from 'vitest';

import { applyCheckin, checkinGroups, formatDateLabel, todayChecked } from './checkin';
import { createEmptyBoard } from './mandalart';
import { MAX_CHECKIN_DAYS, createEmptyCheckins, dateKey } from './state';

const NOW = 1759000000000;

function sampleBoard() {
  const board = createEmptyBoard(NOW);
  board.goal = '책 쓰기';
  board.subs[0].title = '글쓰기 습관';
  board.subs[0].actions[0] = '매일 300자';
  board.subs[0].actions[3] = '주말 초고';
  board.subs[0].done[3] = true;
  board.subs[5].actions[7] = '독서 30분'; // 제목 없는 세부 목표
  return board;
}

describe('checkinGroups', () => {
  it('글이 있는 실천만 세부 목표별로 묶고, 제목이 없으면 번호로 불러요', () => {
    const groups = checkinGroups(sampleBoard());
    expect(groups.map((g) => g.title)).toEqual(['글쓰기 습관', '세부 목표 6']);
    expect(groups[0].items.map((i) => [i.index, i.text, i.done])).toEqual([
      [0, '매일 300자', false],
      [3, '주말 초고', true],
    ]);
    expect(groups[1].items[0].index).toBe(5 * 8 + 7);
  });

  it('빈 판은 그룹이 없어요', () => {
    expect(checkinGroups(createEmptyBoard(NOW))).toEqual([]);
  });
});

describe('applyCheckin / todayChecked', () => {
  it('오늘 기록을 쓰고, 같은 날 다시 쓰면 덮어써요', () => {
    let c = createEmptyCheckins();
    c = applyCheckin(c, 'b1', '2026-09-29', [3, 0, 3, 99, -1], NOW);
    expect(c.byBoard.b1.days['2026-09-29']).toEqual([0, 3]);
    expect(c.byBoard.b1.lastCompletedAt).toBe(NOW);
    expect(todayChecked(c.byBoard.b1, '2026-09-29')).toEqual([0, 3]);
    expect(todayChecked(c.byBoard.b1, '2026-09-30')).toBeNull();
    c = applyCheckin(c, 'b1', '2026-09-29', [], NOW + 1);
    expect(c.byBoard.b1.days['2026-09-29']).toEqual([]);
    expect(todayChecked(undefined, '2026-09-29')).toBeNull();
  });

  it('다른 판의 기록은 건드리지 않아요', () => {
    let c = applyCheckin(createEmptyCheckins(), 'b1', '2026-09-29', [1], NOW);
    c = applyCheckin(c, 'b2', '2026-09-29', [2], NOW);
    expect(c.byBoard.b1.days['2026-09-29']).toEqual([1]);
    expect(c.byBoard.b2.days['2026-09-29']).toEqual([2]);
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
