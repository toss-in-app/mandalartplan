import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { logEvent } from './lib/analytics';
import { actionIndex, cellOfRing } from './lib/mandalart';
import { dateKey } from './lib/state';

// 제자리 편집 모드(2.1): 여러 칸 지우기의 판·오늘 체크 저장과 되돌리기, 예전 편집 화면 링크까지 화면부터 봐요.
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

function renderAt(hash: string) {
  window.location.hash = hash;
  render(
    <TDSMobileAITProvider brandPrimaryColor="#6B5CFF">
      <App />
    </TDSMobileAITProvider>,
  );
}

describe('App (제자리 편집 모드)', () => {
  it('세부 목표 화면에서 고른 실천을 지우면 오늘 체크에서도 빠지고, 되돌리기로 글과 체크가 돌아와요', async () => {
    seed();
    renderAt('#/sub/0');
    // 길게 누르기·옆으로 쓸기와 같은 편집 모드·고르기(키보드 입구)
    fireEvent.click(await screen.findByRole('button', { name: '편집' }));
    fireEvent.click(screen.getByRole('button', { name: '지울 칸 고르기' }));
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

  it("예전 편집 화면 링크(block/4 = 콘솔 '만다라트 작성')는 홈을 편집 모드로 열고, '완료'로 편집 모드를 끝내요", async () => {
    seed();
    renderAt('#/block/4');
    await screen.findByRole('heading', { level: 1, name: '토익 900점' });
    expect(screen.getByRole('button', { name: '완료' })).toBeInTheDocument();
    expect(logEvent).toHaveBeenCalledWith('edit_mode_enter', { screen: 'home', via: 'link' });
    // 편집 모드에선 가운데(핵심 목표)도 눌러서 고쳐요
    fireEvent.click(screen.getByRole('button', { name: '토익 900점' }));
    expect(await screen.findByText('어떤 목표를 이루고 싶나요?')).toBeInTheDocument();
  });

  it('둘레 블록 링크(block/n)는 그 세부 목표 화면을 편집 모드로 열어요', async () => {
    seed();
    renderAt(`#/block/${cellOfRing(0)}`);
    await screen.findByRole('heading', { level: 1, name: '듣기' });
    expect(screen.getByRole('button', { name: '완료' })).toBeInTheDocument();
    expect(logEvent).toHaveBeenCalledWith('edit_mode_enter', { screen: 'sub', via: 'link' });
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '완료' })).not.toBeInTheDocument());
  });
});
