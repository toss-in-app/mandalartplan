import { describe, expect, it } from 'vitest';

import {
  MAX_TEXT,
  boardToText,
  cellOfRing,
  createEmptyBoard,
  getProgress,
  normalizeBoard,
  parseBoard,
  ringIndex,
} from './mandalart';

describe('ringIndex / cellOfRing', () => {
  it('가운데(4)를 건너뛰고 0~7 로 이어져요', () => {
    expect([0, 1, 2, 3, 5, 6, 7, 8].map(ringIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (let ring = 0; ring < 8; ring += 1) {
      expect(ringIndex(cellOfRing(ring))).toBe(ring);
    }
  });

  it('가운데 칸이나 범위 밖은 에러예요', () => {
    expect(() => ringIndex(4)).toThrow(RangeError);
    expect(() => ringIndex(9)).toThrow(RangeError);
    expect(() => cellOfRing(8)).toThrow(RangeError);
  });
});

describe('normalizeBoard / parseBoard', () => {
  it('빈 보드는 73칸이 모두 비어 있어요', () => {
    const board = createEmptyBoard();
    expect(board.subs).toHaveLength(8);
    expect(board.subs.every((sub) => sub.actions.length === 8 && sub.done.length === 8)).toBe(true);
    expect(getProgress(board)).toEqual({ filled: 0, totalCells: 73, done: 0, totalActions: 64 });
  });

  it('모양이 다른 값은 null 이에요', () => {
    expect(normalizeBoard(null)).toBeNull();
    expect(normalizeBoard({ version: 2, subs: [] })).toBeNull();
    expect(normalizeBoard({ version: 1 })).toBeNull();
    expect(parseBoard('{not json')).toBeNull();
    expect(parseBoard(null)).toBeNull();
  });

  it('부족한 칸은 채우고, 긴 글은 MAX_TEXT 로 잘라요', () => {
    const long = 'a'.repeat(MAX_TEXT + 10);
    const board = normalizeBoard({
      version: 1,
      goal: long,
      subs: [{ title: '건강', actions: ['운동'], done: [true, 'yes'] }],
    });
    expect(board).not.toBeNull();
    expect(board!.goal).toHaveLength(MAX_TEXT);
    expect(board!.subs).toHaveLength(8);
    expect(board!.subs[0].actions).toEqual(['운동', '', '', '', '', '', '', '']);
    expect(board!.subs[0].done).toEqual([true, false, false, false, false, false, false, false]);
    expect(board!.subs[7].title).toBe('');
  });

  it('저장한 JSON 을 다시 읽으면 같아요', () => {
    const board = createEmptyBoard();
    board.goal = '책 쓰기';
    board.subs[2].title = '글쓰기 습관';
    board.subs[2].actions[5] = '매일 300자';
    board.subs[2].done[5] = true;
    board.updatedAt = 1700000000000;
    expect(parseBoard(JSON.stringify(board))).toEqual(board);
  });
});

describe('getProgress', () => {
  it('글이 있는 칸만 세고, 완료는 글이 있는 실천만 인정해요', () => {
    const board = createEmptyBoard();
    board.goal = '목표';
    board.subs[0].title = '세부';
    board.subs[0].actions[0] = '실천';
    board.subs[0].done[0] = true;
    board.subs[0].done[1] = true; // 글이 없는 칸의 완료 표시는 무시
    expect(getProgress(board)).toEqual({ filled: 3, totalCells: 73, done: 1, totalActions: 64 });
  });
});

describe('boardToText', () => {
  it('비어 있는 세부 목표는 건너뛰고 완료 표시를 붙여요', () => {
    const board = createEmptyBoard();
    board.goal = '책 한 권 쓰기';
    board.subs[1].title = '글쓰기 습관';
    board.subs[1].actions[0] = '매일 300자';
    board.subs[1].done[0] = true;
    board.subs[1].actions[3] = '주말 초고 정리';
    expect(boardToText(board)).toBe(
      ['[핵심 목표] 책 한 권 쓰기', '', '2. 글쓰기 습관', '- [완료] 매일 300자', '- 주말 초고 정리'].join('\n'),
    );
  });
});

describe('cellView', () => {
  it('가운데 블록은 핵심·세부 목표, 둘레 블록은 세부 목표·실천을 가리켜요', async () => {
    const { cellView } = await import('./cells');
    const board = createEmptyBoard();
    board.goal = '핵심';
    board.subs[0].title = '세부1';
    board.subs[0].actions[0] = '실천1';
    board.subs[0].done[0] = true;
    board.subs[7].title = '세부8';

    expect(cellView(board, 4, 4)).toMatchObject({ kind: 'goal', text: '핵심' });
    expect(cellView(board, 4, 0)).toMatchObject({ kind: 'sub', text: '세부1' });
    expect(cellView(board, 4, 8)).toMatchObject({ kind: 'sub', text: '세부8' });
    expect(cellView(board, 0, 4)).toMatchObject({ kind: 'sub', text: '세부1' });
    expect(cellView(board, 0, 0)).toMatchObject({ kind: 'action', text: '실천1', done: true });
    expect(cellView(board, 8, 4)).toMatchObject({ kind: 'sub', text: '세부8' });
    expect(cellView(board, 8, 8)).toMatchObject({ kind: 'action', text: '', done: false });
  });
});
