import { describe, expect, it } from 'vitest';

import { cellView } from './cells';
import {
  MAX_TEXT,
  TOTAL_ACTIONS,
  TOTAL_CELLS,
  actionIndex,
  boardToText,
  cellOfRing,
  createEmptyBoard,
  getProgress,
  makeBoardId,
  normalizeBoard,
  ringIndex,
  splitActionIndex,
} from './mandalart';

const NOW = 1759000000000;

describe('ringIndex / cellOfRing / actionIndex', () => {
  it('가운데(4)를 건너뛰고 0~7 로 이어져요', () => {
    expect([0, 1, 2, 3, 5, 6, 7, 8].map(ringIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (let ring = 0; ring < 8; ring += 1) expect(ringIndex(cellOfRing(ring))).toBe(ring);
  });

  it('가운데 칸이나 범위 밖은 에러예요', () => {
    expect(() => ringIndex(4)).toThrow(RangeError);
    expect(() => ringIndex(9)).toThrow(RangeError);
    expect(() => cellOfRing(8)).toThrow(RangeError);
  });

  it('실천 번호는 0~63 이고 되돌릴 수 있어요', () => {
    expect(actionIndex(0, 0)).toBe(0);
    expect(actionIndex(7, 7)).toBe(TOTAL_ACTIONS - 1);
    expect(splitActionIndex(actionIndex(3, 5))).toEqual({ subIndex: 3, action: 5 });
  });
});

describe('createEmptyBoard / normalizeBoard', () => {
  it('빈 판은 73칸이 모두 비어 있고 id 는 b+13자리예요', () => {
    const board = createEmptyBoard(NOW);
    expect(board.id).toBe(makeBoardId(NOW));
    expect(board.id).toMatch(/^b[0-9]{13}$/);
    expect(board.subs).toHaveLength(8);
    expect(board.subs.every((sub) => sub.actions.length === 8)).toBe(true);
    expect(getProgress(board)).toEqual({ filled: 0, totalCells: TOTAL_CELLS, actionsFilled: 0, totalActions: TOTAL_ACTIONS });
  });

  it('모양이 다른 값은 null 이에요', () => {
    expect(normalizeBoard(null)).toBeNull();
    expect(normalizeBoard({ goal: 'x' })).toBeNull();
    expect(normalizeBoard('{}')).toBeNull();
  });

  it('부족한 칸은 채우고, 긴 글은 MAX_TEXT 로 자르고, 예전 done 필드는 버려요', () => {
    const long = 'a'.repeat(MAX_TEXT + 10);
    const board = normalizeBoard({ goal: long, subs: [{ title: '건강', actions: ['운동'], done: [true, true] }] }, NOW);
    expect(board).not.toBeNull();
    expect(board!.goal).toHaveLength(MAX_TEXT);
    expect(board!.subs).toHaveLength(8);
    expect(board!.subs[0].actions).toEqual(['운동', '', '', '', '', '', '', '']);
    expect('done' in board!.subs[0]).toBe(false);
    expect(board!.templateId).toBeNull();
    expect(board!.createdAt).toBe(NOW);
  });

  it('선행 프로토타입의 단일 판(version·updatedAt)도 읽어요', () => {
    const legacy = { version: 1, goal: '책 쓰기', updatedAt: 1758000000000, subs: [{ title: '글쓰기', actions: ['매일 300자'] }] };
    const board = normalizeBoard(legacy, NOW);
    expect(board?.goal).toBe('책 쓰기');
    expect(board?.updatedAt).toBe(1758000000000);
    expect(board?.subs[0].actions[0]).toBe('매일 300자');
  });

  it('저장한 JSON 을 다시 읽으면 같아요', () => {
    const board = createEmptyBoard(NOW);
    board.goal = '책 쓰기';
    board.templateId = 'job-change';
    board.subs[2].title = '글쓰기 습관';
    board.subs[2].actions[5] = '매일 300자';
    expect(normalizeBoard(JSON.parse(JSON.stringify(board)), NOW + 1)).toEqual(board);
  });
});

describe('getProgress / boardToText', () => {
  it('글이 있는 칸과 실천을 세요', () => {
    const board = createEmptyBoard(NOW);
    board.goal = '목표';
    board.subs[0].title = '세부';
    board.subs[0].actions[0] = '실천';
    board.subs[0].actions[1] = ' ';
    expect(getProgress(board)).toEqual({ filled: 3, totalCells: 73, actionsFilled: 1, totalActions: 64 });
  });

  it('공유 텍스트는 비어 있는 세부 목표를 건너뛰고 오늘 체크에 표시를 붙여요', () => {
    const board = createEmptyBoard(NOW);
    board.goal = '책 한 권 쓰기';
    board.subs[1].title = '글쓰기 습관';
    board.subs[1].actions[0] = '매일 300자';
    board.subs[1].actions[3] = '주말 초고 정리';
    expect(boardToText(board, new Set([actionIndex(1, 0)]))).toBe(
      ['[핵심 목표] 책 한 권 쓰기', '', '2. 글쓰기 습관', '- [오늘] 매일 300자', '- 주말 초고 정리'].join('\n'),
    );
  });
});

describe('cellView', () => {
  it('가운데 블록은 핵심·세부 목표, 둘레 블록은 세부 목표·실천을 가리키고 오늘 체크를 반영해요', () => {
    const board = createEmptyBoard(NOW);
    board.goal = '핵심';
    board.subs[0].title = '세부1';
    board.subs[0].actions[0] = '실천1';
    board.subs[7].title = '세부8';
    const checked = new Set([actionIndex(0, 0)]);
    expect(cellView(board, 4, 4)).toMatchObject({ kind: 'goal', text: '핵심', index: null });
    expect(cellView(board, 4, 0)).toMatchObject({ kind: 'sub', text: '세부1', index: 0 });
    expect(cellView(board, 4, 8)).toMatchObject({ kind: 'sub', text: '세부8', index: 7 });
    expect(cellView(board, 0, 4)).toMatchObject({ kind: 'sub', text: '세부1', index: 0 });
    expect(cellView(board, 0, 0, checked)).toMatchObject({ kind: 'action', text: '실천1', index: 0, checked: true });
    expect(cellView(board, 0, 0)).toMatchObject({ kind: 'action', checked: false });
    expect(cellView(board, 8, 8)).toMatchObject({ kind: 'action', text: '', index: actionIndex(7, 7), checked: false });
  });
});
