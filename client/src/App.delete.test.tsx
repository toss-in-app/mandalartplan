import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { logEvent } from './lib/analytics';
import { actionIndex, cellOfRing } from './lib/mandalart';
import { dateKey } from './lib/state';

// 편집 화면 여러 칸 지우기(2.1): 판·오늘 체크 저장과 되돌리기까지 화면부터 봐요.
vi.mock('./lib/analytics', () => ({ logEvent: vi.fn() }));
afterEach(() => vi.mocked(logEvent).mockClear());

const BOARD_ID = 'b1759000000000';
const boards = () => JSON.parse(window.localStorage.getItem('__ait_storage:mandalart.boards.v1')!).boards[0];
const checkins = () => JSON.parse(window.localStorage.getItem('__ait_storage:mandalart.checkins.v1')!).byBoard[BOARD_ID];

function seed() {
  const today = dateKey();
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
            title: i === 0 ? '듣기' : '',
            actions: i === 0 ? ['받아쓰기', '쉐도잉', '팟캐스트', '', '', '', '', ''] : Array(8).fill(''),
          })),
          templateId: null,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    }),
  );
  // 오늘 '받아쓰기'·'팟캐스트'를 했어요
  window.localStorage.setItem(
    '__ait_storage:mandalart.checkins.v1',
    JSON.stringify({ version: 1, byBoard: { [BOARD_ID]: { days: { [today]: [actionIndex(0, 0), actionIndex(0, 2)] }, lastCompletedAt: 1 } } }),
  );
}

describe('App (편집 화면 여러 칸 지우기)', () => {
  it('고른 실천을 지우면 오늘 체크에서도 빠지고, 되돌리기로 글과 체크가 돌아와요', async () => {
    seed();
    window.location.hash = `#/block/${cellOfRing(0)}`;
    render(
      <TDSMobileAITProvider brandPrimaryColor="#6B5CFF">
        <App />
      </TDSMobileAITProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: '여러 칸 골라 지우기' })); // 길게 누르기와 같은 고르기 모드(키보드 입구)
    fireEvent.click(screen.getByRole('button', { name: '받아쓰기' }));
    fireEvent.click(screen.getByRole('button', { name: '쉐도잉' }));
    fireEvent.click(screen.getByRole('button', { name: '2칸 삭제' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '삭제' }));

    const today = dateKey();
    await waitFor(() => expect(boards().subs[0].actions.slice(0, 3)).toEqual(['', '', '팟캐스트']));
    await waitFor(() => expect(checkins().days[today]).toEqual([actionIndex(0, 2)]));
    expect(logEvent).toHaveBeenCalledWith('cells_delete', { count: 2, area: 'actions' });

    fireEvent.click((await screen.findAllByText('되돌리기'))[0]);
    await waitFor(() => expect(boards().subs[0].actions.slice(0, 3)).toEqual(['받아쓰기', '쉐도잉', '팟캐스트']));
    await waitFor(() => expect(checkins().days[today]).toEqual([actionIndex(0, 0), actionIndex(0, 2)]));
    expect(logEvent).toHaveBeenCalledWith('cells_delete_undo', { count: 2 });
  });
});
