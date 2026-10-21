import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { logEvent } from './lib/analytics';
import { actionIndex } from './lib/mandalart';
import { dateKey } from './lib/state';

// 제자리 편집 모드의 자리 바꾸기(3.0): 판과 체크 기록이 함께 저장되는지 화면부터 봐요(키보드 입구 '자리 바꾸기' = 꾹 눌러 끌기와 같은 일)
vi.mock('./lib/analytics', () => ({ logEvent: vi.fn() }));
afterEach(() => vi.mocked(logEvent).mockClear());

const BOARD_ID = 'b1759000000000';
const boards = () => JSON.parse(window.localStorage.getItem('__ait_storage:mandalart.boards.v1')!).boards[0];
const checkins = () => JSON.parse(window.localStorage.getItem('__ait_storage:mandalart.checkins.v1')!).byBoard[BOARD_ID];
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
};

function seed() {
  window.localStorage.setItem(
    '__ait_storage:mandalart.boards.v1',
    JSON.stringify({
      version: 1,
      active: 0,
      boards: [
        {
          id: BOARD_ID,
          goal: '토익 900점',
          subs: Array.from({ length: 8 }, (_, i) => ({
            title: i === 0 ? '듣기' : i === 2 ? '읽기' : '',
            actions: i === 0 ? ['받아쓰기', '쉐도잉', '팟캐스트', '', '', '', '', ''] : Array(8).fill(''),
          })),
          templateId: null,
          aiDraft: { at: 1, model: 'claude-haiku-5-5', promptVersion: 3, cells: [1 + 8 + 1] }, // 쉐도잉은 AI 가 쓴 칸
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    }),
  );
  // 오늘 '받아쓰기'·'팟캐스트', 어제 '쉐도잉'을 했어요
  window.localStorage.setItem(
    '__ait_storage:mandalart.checkins.v1',
    JSON.stringify({
      version: 1,
      byBoard: { [BOARD_ID]: { days: { [dateKey()]: [actionIndex(0, 0), actionIndex(0, 2)], [yesterday()]: [actionIndex(0, 1)] }, lastCompletedAt: 1 } },
    }),
  );
}

function renderAt(hash: string) {
  window.location.hash = hash;
  render(
    <TDSMobileAITProvider brandPrimaryColor="#6B5CFF">
      <App />
    </TDSMobileAITProvider>,
  );
}

describe('App (제자리 편집 모드 — 자리 바꾸기, 3.0)', () => {
  it('홈에서 세부 목표를 빈 자리로 옮기면 그 아래 실천·체크 기록·AI 표시가 통째로 따라가요', async () => {
    seed();
    renderAt('#/');
    fireEvent.click(await screen.findByRole('button', { name: '편집' }));
    fireEvent.click(screen.getByRole('button', { name: '자리 바꾸기' }));
    fireEvent.click(screen.getByRole('button', { name: '듣기' }));
    fireEvent.click(screen.getByRole('button', { name: '세부 목표 8' }));

    await waitFor(() => expect(boards().subs[7]).toEqual({ title: '듣기', actions: ['받아쓰기', '쉐도잉', '팟캐스트', '', '', '', '', ''] }));
    expect(boards().subs[0]).toEqual({ title: '', actions: Array(8).fill('') });
    expect(boards().subs[2].title).toBe('읽기');
    expect(boards().aiDraft.cells).toEqual([1 + 8 + 7 * 8 + 1]);
    await waitFor(() => expect(checkins().days[dateKey()]).toEqual([actionIndex(7, 0), actionIndex(7, 2)]));
    expect(checkins().days[yesterday()]).toEqual([actionIndex(7, 1)]);
    expect(logEvent).toHaveBeenCalledWith('cells_swap', { area: 'goals' });
    // 홈의 칸도 바뀐 자리로 그려져요(편집 모드가 이어진 채)
    expect(screen.getByRole('button', { name: '세부 목표 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '듣기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '완료' })).toBeInTheDocument();
  });

  it('세부 목표 화면에서 실천 둘을 바꾸면 오늘·지난 체크 기록이 글을 따라가요', async () => {
    seed();
    renderAt('#/sub/0');
    fireEvent.click(await screen.findByRole('button', { name: '편집' }));
    fireEvent.click(screen.getByRole('button', { name: '자리 바꾸기' }));
    fireEvent.click(screen.getByRole('button', { name: '받아쓰기' }));
    fireEvent.click(screen.getByRole('button', { name: '쉐도잉' }));

    await waitFor(() => expect(boards().subs[0].actions.slice(0, 3)).toEqual(['쉐도잉', '받아쓰기', '팟캐스트']));
    await waitFor(() => expect(checkins().days[dateKey()]).toEqual([actionIndex(0, 1), actionIndex(0, 2)]));
    expect(checkins().days[yesterday()]).toEqual([actionIndex(0, 0)]);
    expect(boards().aiDraft.cells).toEqual([1 + 8 + 0]);
    expect(logEvent).toHaveBeenCalledWith('cells_swap', { area: 'actions' });
    // 편집 모드를 끝내면 바뀐 자리에서 오늘 한 표시가 글을 따라가 있어요
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    expect(screen.getByRole('button', { name: '받아쓰기, 오늘 했어요' })).toHaveClass('mg-cell-done');
    expect(screen.getByRole('button', { name: '쉐도잉, 오늘 아직' })).not.toHaveClass('mg-cell-done');
    expect(logEvent).toHaveBeenCalledWith('board_edit', { block: 0 });
  });

  it("세부 목표 화면 가운데 '핵심 목표로'를 누르면 홈으로 돌아가요(3.0 시안 9)", async () => {
    seed();
    renderAt('#/');
    // 홈 → 세부 목표 '듣기'
    fireEvent.click(await screen.findByRole('button', { name: /^듣기/ }));
    await screen.findByRole('heading', { level: 1, name: '듣기' });
    fireEvent.click(screen.getByRole('button', { name: '듣기, 핵심 목표로' }));
    await screen.findByRole('heading', { level: 1, name: '토익 900점' });
    expect(screen.queryByRole('button', { name: '듣기, 핵심 목표로' })).not.toBeInTheDocument();
  });
});
