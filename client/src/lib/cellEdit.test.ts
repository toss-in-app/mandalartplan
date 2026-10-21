import { describe, expect, it } from 'vitest';

import { clearBlockCells } from './cellEdit';
import { AI_CELL, CENTER, actionIndex, cellOfRing, createEmptyBoard, type Board } from './mandalart';

const NOW = 1759000000000;

function board(): Board {
  const b = createEmptyBoard(NOW);
  b.goal = '토익 900점';
  b.subs[0].title = '듣기';
  b.subs[0].actions[0] = '받아쓰기';
  b.subs[0].actions[1] = '쉐도잉';
  b.subs[2].title = '읽기';
  return b;
}

describe('여러 칸 지우기 (2.1)', () => {
  it('가운데 블록: 핵심 목표·세부 목표 이름만 지우고 그 아래 실천은 그대로', () => {
    const { board: next, cleared, actions } = clearBlockCells(board(), CENTER, [CENTER, cellOfRing(0), cellOfRing(5)]);
    expect(cleared).toBe(2); // 세부 목표 6 은 원래 비어 있어요
    expect(next.goal).toBe('');
    expect(next.subs[0].title).toBe('');
    expect(next.subs[0].actions.slice(0, 2)).toEqual(['받아쓰기', '쉐도잉']);
    expect(next.subs[2].title).toBe('읽기');
    expect(actions).toEqual([]);
  });

  it('둘레 블록: 세부 목표 이름(가운데)과 실천, 지운 실천 번호를 돌려줘요', () => {
    const { board: next, cleared, actions } = clearBlockCells(board(), cellOfRing(0), [cellOfRing(1), CENTER, cellOfRing(1)]);
    expect(cleared).toBe(2); // 같은 칸을 두 번 골라도 한 번
    expect(next.subs[0].title).toBe('');
    expect(next.subs[0].actions[1]).toBe('');
    expect(next.subs[0].actions[0]).toBe('받아쓰기');
    expect(actions).toEqual([actionIndex(0, 1)]);
  });

  it("지운 칸은 'AI 초안' 기록에서도 빠지고, 다 빠지면 기록이 없어져요", () => {
    const b = { ...board(), aiDraft: { at: NOW, model: 'claude-haiku-5-5', promptVersion: 3, cells: [AI_CELL.action(0, 0), AI_CELL.action(0, 1)] } };
    const once = clearBlockCells(b, cellOfRing(0), [cellOfRing(0)]);
    expect(once.board.aiDraft?.cells).toEqual([AI_CELL.action(0, 1)]);
    const both = clearBlockCells(b, cellOfRing(0), [cellOfRing(0), cellOfRing(1)]);
    expect(both.board.aiDraft).toBeNull();
  });

  it('빈 칸·잘못된 칸만 고르면 바뀌는 게 없어요', () => {
    const b = board();
    const result = clearBlockCells(b, cellOfRing(2), [cellOfRing(3), 9, -1]);
    expect(result.cleared).toBe(0);
    expect(result.board).toBe(b);
  });
});
