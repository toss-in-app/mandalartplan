import { describe, expect, it } from 'vitest';

import { BASIC_CARD, CARD_HEIGHT, CARD_WIDTH, HD_CARD, WATERMARK, cardFileName, formatCardDate, layoutCard, renderCard, wrapText } from './card';
import { CENTER, actionIndex, createEmptyBoard } from './mandalart';

/** 글자 하나 = 10px 로 치는 가짜 measureText */
const measure = (text: string) => text.length * 10;

function sampleBoard() {
  const board = createEmptyBoard(1759000000000);
  board.goal = '건강한 한 해';
  board.subs[0].title = '운동';
  board.subs[0].actions[0] = '아침 스트레칭 10분';
  board.subs[0].actions[1] = '주 3회 달리기';
  board.subs[7].title = '독서';
  board.subs[7].actions[7] = '자기 전 20쪽';
  return board;
}

describe('wrapText', () => {
  it('띄어쓰기가 있으면 단어 사이에서, 없으면 글자 단위로 끊어요', () => {
    expect(wrapText(measure, '아침 스트레칭 10분', 60, 4)).toEqual(['아침', '스트레칭', '10분']);
    expect(wrapText(measure, '아침 스트레칭 10분', 80, 4)).toEqual(['아침 스트레칭', '10분']);
    expect(wrapText(measure, '가나다라마바사아자차', 50, 4)).toEqual(['가나다라마', '바사아자차']);
  });

  it('줄 수를 넘으면 마지막 줄을 … 로 줄이고, 빈 글은 빈 배열이에요', () => {
    const lines = wrapText(measure, '가나다라마바사아자차카타파하', 50, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
    expect(measure(lines[1])).toBeLessThanOrEqual(50);
    expect(wrapText(measure, '   ', 50, 2)).toEqual([]);
    expect(wrapText(measure, '한 줄', 100, 1)).toEqual(['한 줄']);
  });
});

describe('layoutCard', () => {
  it('81칸이 격자 안에 겹치지 않게 놓이고, 가운데는 핵심 목표, 체크한 실천은 표시돼요', () => {
    const checked = new Set([actionIndex(0, 0)]);
    const layout = layoutCard({ board: sampleBoard(), checked, today: '2026-10-06', streakDays: 3 });

    expect(layout.width).toBe(CARD_WIDTH);
    expect(layout.height).toBe(CARD_HEIGHT);
    expect(layout.cells).toHaveLength(81);
    for (const c of layout.cells) {
      expect(c.x).toBeGreaterThanOrEqual(layout.grid.x);
      expect(c.y).toBeGreaterThanOrEqual(layout.grid.y);
      expect(c.x + c.w).toBeLessThanOrEqual(layout.grid.x + layout.grid.w + 1e-6);
      expect(c.y + c.h).toBeLessThanOrEqual(layout.grid.y + layout.grid.h + 1e-6);
    }
    const keys = new Set(layout.cells.map((c) => `${c.x},${c.y}`));
    expect(keys.size).toBe(81);

    const goal = layout.cells.find((c) => c.block === CENTER && c.cell === CENTER)!;
    expect(goal.view).toMatchObject({ kind: 'goal', text: '건강한 한 해' });
    // 세부 목표 1(블록 0)의 첫 실천(칸 0)이 오늘 체크
    const first = layout.cells.find((c) => c.block === 0 && c.cell === 0)!;
    expect(first.view).toMatchObject({ kind: 'action', text: '아침 스트레칭 10분', checked: true });
    expect(layout.cells.filter((c) => c.view.checked)).toHaveLength(1);

    expect(layout.header.caption).toBe('만다라트 · 2026년 10월 6일');
    expect(layout.header.title).toBe('건강한 한 해');
    expect(layout.header.summary).toBe('73칸 중 6칸 · 오늘 1개 실천 · 3일째'); // 핵심 1 + 세부 2 + 실천 3
    expect(layout.footer).toEqual({ text: WATERMARK, y: expect.any(Number) });
    expect(layout.footer!.y).toBeLessThan(CARD_HEIGHT);
  });

  it('빈 판은 안내 제목, 고화질 옵션은 워터마크 없음', () => {
    const layout = layoutCard({ board: createEmptyBoard(1), checked: new Set(), today: '2026-01-01', streakDays: 0 }, HD_CARD);
    expect(layout.header.title).toBe('핵심 목표를 정하는 중이에요');
    expect(layout.header.summary).toBe('73칸 중 0칸');
    expect(layout.footer).toBeNull();
  });
});

describe('파일 이름·날짜·렌더', () => {
  it('파일 이름은 날짜와 확장자를 포함해요', () => {
    expect(cardFileName('2026-10-06')).toBe('mandalart-2026-10-06.png');
    expect(cardFileName('2026-10-06', HD_CARD)).toBe('mandalart-2026-10-06-hd.png');
    expect(formatCardDate('2026-10-06')).toBe('2026년 10월 6일');
  });

  it('캔버스를 쓸 수 없는 환경(jsdom)에서는 null 을 돌려주고 던지지 않아요', () => {
    expect(renderCard({ board: sampleBoard(), checked: new Set(), today: '2026-10-06', streakDays: 0 }, BASIC_CARD)).toBeNull();
  });
});
