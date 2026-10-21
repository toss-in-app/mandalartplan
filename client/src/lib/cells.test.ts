import { describe, expect, it } from 'vitest';

import { cellView, nextEmptyCell, subProgress } from './cells';
import { CENTER, actionIndex, cellOfRing, createEmptyBoard } from './mandalart';
import { subProgressFill } from '../theme';

describe('세부 목표의 오늘 진행 (2.1, 홈·전체 보기 칸이 이만큼 진해져요)', () => {
  it('글이 있는 실천 중 오늘 체크한 비율이고, 실천이 없으면 0', () => {
    const board = createEmptyBoard(1);
    board.subs[0].title = '듣기';
    board.subs[0].actions = ['받아쓰기', '쉐도잉', '', '팟캐스트', '', '', '', ''];
    expect(subProgress(board, 0, new Set())).toBe(0);
    expect(subProgress(board, 0, new Set([actionIndex(0, 0)]))).toBeCloseTo(1 / 3);
    expect(subProgress(board, 0, new Set([actionIndex(0, 0), actionIndex(0, 1), actionIndex(0, 3)]))).toBe(1);
    expect(subProgress(board, 1, new Set())).toBe(0); // 실천이 없는 세부 목표
    expect(cellView(board, CENTER, cellOfRing(0), new Set([actionIndex(0, 1)]))).toMatchObject({ kind: 'sub', progress: 1 / 3, checked: false });
    expect(cellView(board, cellOfRing(0), CENTER, new Set([actionIndex(0, 0), actionIndex(0, 1), actionIndex(0, 3)]))).toMatchObject({ progress: 1, checked: true });
  });

  it('바탕: 아직 0 이면 실천 칸처럼 회색, 하는 중엔 회색과 다 함 색 사이를 비율만큼(20% 지점부터 80% 아래까지), 다 하면 브랜드 48%', () => {
    expect(subProgressFill(0, false)).toBe('#f2f4f6');
    expect(subProgressFill(1 / 8, false)).toBe('#e2e2f8');
    expect(subProgressFill(0.5, false)).toBe('#d5d3fb');
    expect(subProgressFill(7 / 8, false)).toBe('#c8c3fd');
    expect(subProgressFill(1, true)).toBe('#b8b1ff');
  });
});

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
