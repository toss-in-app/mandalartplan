import { describe, expect, it } from 'vitest';

import { nextEmptyCell } from './cells';
import { CENTER, cellOfRing, createEmptyBoard } from './mandalart';

describe('nextEmptyCell (다음에 채울 칸)', () => {
  it('가운데 블록: 핵심 목표가 비면 가운데, 아니면 둘레의 첫 빈 세부 목표, 다 차면 null', () => {
    const board = createEmptyBoard(1);
    expect(nextEmptyCell(board, CENTER)).toBe(CENTER);
    board.goal = '자격증 따기';
    expect(nextEmptyCell(board, CENTER)).toBe(cellOfRing(0));
    board.subs[0].title = '기출 문제';
    board.subs[1].title = '  ';
    expect(nextEmptyCell(board, CENTER)).toBe(cellOfRing(1)); // 공백만 있는 칸도 빈 칸
    board.subs.forEach((sub, i) => (sub.title = `목표 ${i}`));
    expect(nextEmptyCell(board, CENTER)).toBeNull();
  });

  it('세부 목표 블록: 세부 목표 이름이 비면 가운데, 아니면 첫 빈 실천', () => {
    const board = createEmptyBoard(1);
    const block = cellOfRing(2);
    expect(nextEmptyCell(board, block)).toBe(CENTER);
    board.subs[2].title = '체력';
    board.subs[2].actions[0] = '스쿼트 30회';
    expect(nextEmptyCell(board, block)).toBe(cellOfRing(1));
  });
});
