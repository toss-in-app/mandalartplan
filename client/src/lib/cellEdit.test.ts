import { describe, expect, it } from 'vitest';

import { cascadeOf, clearBlockCells } from './cellEdit';
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
  it('핵심 목표를 지우면 세부 목표·실천까지 전부 지워요(상위 목표를 지우면 하위도 전부)', () => {
    const { board: next, cleared, actions, fields } = clearBlockCells(board(), CENTER, [CENTER]);
    expect(cleared).toBe(5); // 핵심 목표 + 세부 목표 2 + 실천 2
    expect(next.goal).toBe('');
    expect(next.subs.every((sub) => sub.title === '' && sub.actions.every((action) => action === ''))).toBe(true);
    expect(actions).toEqual([actionIndex(0, 0), actionIndex(0, 1)]);
    expect(fields).toContainEqual({ kind: 'goal' });
  });

  it('홈에서 세부 목표를 지우면 그 아래 실천도 지우고, 다른 세부 목표와 핵심 목표는 그대로', () => {
    const { board: next, cleared, actions } = clearBlockCells(board(), CENTER, [cellOfRing(0), cellOfRing(5)]);
    expect(cleared).toBe(3); // 세부 목표 1 + 실천 2 (세부 목표 6 은 원래 비어 있어요)
    expect(next.goal).toBe('토익 900점');
    expect(next.subs[0].title).toBe('');
    expect(next.subs[0].actions.slice(0, 2)).toEqual(['', '']);
    expect(next.subs[2].title).toBe('읽기');
    expect(actions).toEqual([actionIndex(0, 0), actionIndex(0, 1)]);
  });

  it('세부 목표 화면: 가운데(세부 목표 이름)를 지우면 실천도 전부, 실천만 고르면 그 칸만', () => {
    const all = clearBlockCells(board(), cellOfRing(0), [cellOfRing(1), CENTER, cellOfRing(1)]);
    expect(all.cleared).toBe(3); // 같은 칸을 두 번 골라도 한 번: 이름 + 실천 2
    expect(all.board.subs[0].title).toBe('');
    expect(all.board.subs[0].actions.every((action) => action === '')).toBe(true);
    expect([...all.actions].sort((a, b) => a - b)).toEqual([actionIndex(0, 0), actionIndex(0, 1)]);
    const one = clearBlockCells(board(), cellOfRing(0), [cellOfRing(1)]);
    expect(one.cleared).toBe(1);
    expect(one.board.subs[0].title).toBe('듣기');
    expect(one.board.subs[0].actions.slice(0, 2)).toEqual(['받아쓰기', '']);
    expect(one.actions).toEqual([actionIndex(0, 1)]);
  });

  it('함께 지워지는 하위 칸 수(확인 창 안내): 고른 칸 자신은 세지 않아요', () => {
    expect(cascadeOf(board(), CENTER, [CENTER])).toEqual({ subs: 2, actions: 2 });
    expect(cascadeOf(board(), CENTER, [CENTER, cellOfRing(0)])).toEqual({ subs: 1, actions: 2 });
    expect(cascadeOf(board(), CENTER, [cellOfRing(2)])).toEqual({ subs: 0, actions: 0 }); // 실천이 없는 세부 목표
    expect(cascadeOf(board(), cellOfRing(0), [CENTER, cellOfRing(0)])).toEqual({ subs: 0, actions: 1 });
    expect(cascadeOf(board(), cellOfRing(0), [cellOfRing(0)])).toEqual({ subs: 0, actions: 0 });
  });

  it("지운 칸은 'AI 초안' 기록에서도 빠지고, 다 빠지면 기록이 없어져요", () => {
    const b = { ...board(), aiDraft: { at: NOW, model: 'claude-haiku-5-5', promptVersion: 3, cells: [AI_CELL.action(0, 0), AI_CELL.action(0, 1)] } };
    const once = clearBlockCells(b, cellOfRing(0), [cellOfRing(0)]);
    expect(once.board.aiDraft?.cells).toEqual([AI_CELL.action(0, 1)]);
    const both = clearBlockCells(b, cellOfRing(0), [cellOfRing(0), cellOfRing(1)]);
    expect(both.board.aiDraft).toBeNull();
    // 상위 목표를 지우면 함께 지운 하위 칸의 표시도 빠져요
    const goal = { ...board(), aiDraft: { at: NOW, model: 'claude-haiku-5-5', promptVersion: 3, cells: [AI_CELL.goal, AI_CELL.sub(0), AI_CELL.action(0, 0)] } };
    expect(clearBlockCells(goal, CENTER, [cellOfRing(0)]).board.aiDraft?.cells).toEqual([AI_CELL.goal]);
    expect(clearBlockCells(goal, CENTER, [CENTER]).board.aiDraft).toBeNull();
  });

  it('빈 칸·잘못된 칸만 고르면 바뀌는 게 없어요', () => {
    const b = board();
    const result = clearBlockCells(b, cellOfRing(2), [cellOfRing(3), 9, -1]);
    expect(result.cleared).toBe(0);
    expect(result.board).toBe(b);
  });
});
