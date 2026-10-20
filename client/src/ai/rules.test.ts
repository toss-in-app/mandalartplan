import { describe, expect, it } from 'vitest';

import { createEmptyBoard, type Board } from '../lib/mandalart';
import { createDefaultSettings } from '../lib/state';
import {
  AI_DAILY_RUNS,
  canFillActions,
  canFillSubs,
  cleanCell,
  markAiDraft,
  mergeActions,
  mergeDraft,
  mergeSubs,
  recordRun,
  runsLeft,
  subsNeedingActions,
} from './rules';

const NOW = 1759000000000;
const TODAY = '2026-10-20';

function boardWith(edit: (board: Board) => void): Board {
  const board = createEmptyBoard(NOW);
  edit(board);
  return board;
}

describe('하루 횟수', () => {
  it('하루 10번, 날짜가 바뀌면 다시 10번', () => {
    let ai = createDefaultSettings().ai;
    expect(runsLeft(ai, TODAY)).toBe(AI_DAILY_RUNS);
    for (let i = 0; i < AI_DAILY_RUNS; i += 1) ai = recordRun(ai, TODAY);
    expect(ai.runs).toEqual({ date: TODAY, count: 10 });
    expect(runsLeft(ai, TODAY)).toBe(0);
    expect(runsLeft(ai, '2026-10-21')).toBe(10);
    expect(recordRun(ai, '2026-10-21').runs).toEqual({ date: '2026-10-21', count: 1 });
  });

  it('넘쳐도 음수가 되지 않아요', () => {
    const ai = { noticeAt: null, runs: { date: TODAY, count: 15 } };
    expect(runsLeft(ai, TODAY)).toBe(0);
  });
});

describe('칸 글 정리', () => {
  it('제어문자·여러 공백을 정리하고 40자까지', () => {
    expect(cleanCell('  아침\n스트레칭\t10분  ')).toBe('아침 스트레칭 10분');
    expect(cleanCell('가'.repeat(50))).toHaveLength(40);
  });
});

describe('빈 칸만 채우기', () => {
  it('세부 목표: 사용자가 적은 칸은 그대로, 빈 칸만', () => {
    const board = boardWith((b) => {
      b.goal = '8구단 드래프트 1순위';
      b.subs[1].title = '제구';
    });
    const ai = ['체력 강화', '제구력', '구위', '', '구속 향상', '변화구', '몸 관리', '인성과 태도'];
    const { board: next, filled } = mergeSubs(board, ai);
    expect(filled).toBe(6);
    expect(next.subs.map((s) => s.title)).toEqual(['체력 강화', '제구', '구위', '', '구속 향상', '변화구', '몸 관리', '인성과 태도']);
    expect(board.subs[0].title).toBe(''); // 원본은 그대로
  });

  it('채울 게 없으면 같은 판을 돌려줘요', () => {
    const board = createEmptyBoard(NOW);
    expect(mergeSubs(board, Array(8).fill('')).board).toBe(board);
  });

  it('실천: 그 세부 목표의 빈 칸만', () => {
    const board = boardWith((b) => {
      b.subs[2].title = '구위';
      b.subs[2].actions[0] = '롱토스 30분';
    });
    const ai = ['덮어쓰면 안 됨', '손목 강화 운동', '악력 기르기', '', '체중 이동 연습', '몸통 회전 연습', '공 끝 점검하기', '팔 스윙 연습'];
    const { board: next, filled } = mergeActions(board, 2, ai);
    expect(filled).toBe(6);
    expect(next.subs[2].actions[0]).toBe('롱토스 30분');
    expect(next.subs[2].actions[3]).toBe('');
    expect(next.subs[1]).toBe(board.subs[1]);
  });

  it('미리보기 초안을 넣을 때: 목표는 입력한 글로, 나머지는 지금 판의 빈 칸만', () => {
    const draft = boardWith((b) => {
      b.goal = '토익 900점';
      b.subs.forEach((sub, i) => {
        sub.title = `영역 ${i + 1}`;
        sub.actions = sub.actions.map((_, j) => `실천 ${i + 1}-${j + 1}`);
      });
    });
    const current = boardWith((b) => {
      b.subs[0].title = '내가 쓴 영역';
      b.subs[0].actions[0] = '내가 쓴 실천';
    });
    const { board: next, filled } = mergeDraft(current, ' 토익 900점 ', draft);
    expect(next.goal).toBe('토익 900점');
    expect(next.subs[0].title).toBe('내가 쓴 영역');
    expect(next.subs[0].actions[0]).toBe('내가 쓴 실천');
    expect(next.subs[0].actions[1]).toBe('실천 1-2');
    expect(next.subs[7].title).toBe('영역 8');
    expect(filled).toBe(1 + 7 + 63);
  });
});

describe('편집 화면 버튼 조건', () => {
  it('세부 목표 채우기는 핵심 목표가 있고 빈 세부 목표가 있을 때', () => {
    expect(canFillSubs(createEmptyBoard(NOW))).toBe(false);
    const withGoal = boardWith((b) => (b.goal = '토익 900점'));
    expect(canFillSubs(withGoal)).toBe(true);
    const full = boardWith((b) => {
      b.goal = '토익 900점';
      b.subs.forEach((sub, i) => (sub.title = `영역 ${i}`));
    });
    expect(canFillSubs(full)).toBe(false);
  });

  it('실천 추천은 이 세부 목표가 있고 빈 실천이 있을 때, 판 전체 대상은 그런 세부 목표들', () => {
    const board = boardWith((b) => {
      b.goal = '토익 900점';
      b.subs[0].title = '듣기';
      b.subs[3].title = '읽기';
      b.subs[3].actions = b.subs[3].actions.map((_, j) => `실천 ${j}`);
    });
    expect(canFillActions(board, 0)).toBe(true);
    expect(canFillActions(board, 1)).toBe(false);
    expect(canFillActions(board, 3)).toBe(false);
    expect(subsNeedingActions(board)).toEqual([0]);
  });
});

it('AI 기록을 남겨요', () => {
  const board = markAiDraft(createEmptyBoard(NOW), { model: 'claude-haiku-5-5', promptVersion: 1 }, NOW + 5);
  expect(board.aiDraft).toEqual({ at: NOW + 5, model: 'claude-haiku-5-5', promptVersion: 1 });
});
