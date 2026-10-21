import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getBundledContent, type Content } from '../content';
import { actionIndex, createEmptyBoard, type Board } from '../lib/mandalart';
import { dateKey, type CheckinRecord } from '../lib/state';
import { HomeScreen } from './HomeScreen';

function filledBoard(actions: boolean): Board {
  const board = createEmptyBoard(1759000000000);
  board.goal = '건강한 한 해';
  board.subs[0].title = '운동';
  if (actions) board.subs[0].actions[0] = '아침 스트레칭';
  return board;
}

interface Handlers {
  onDeleteCells?: (cells: number[]) => () => void;
  onOverview?: () => void;
  onSelectSub?: (subIndex: number) => void;
  onChangeGoal?: (goal: string) => void;
  onChangeSubTitle?: (subIndex: number, title: string) => void;
  todayAdNotice?: boolean;
}

/** 칸 편집 시트 안의 '완료' */
function sheetDone() {
  let node: HTMLElement | null = document.getElementById('mandalart-cell-editor');
  while (node && !within(node).queryByText('완료')) node = node.parentElement;
  return within(node!).getByText('완료');
}

function renderHome(board: Board, content: Content, checkin?: CheckinRecord, handlers: Handlers = {}) {
  const noop = vi.fn();
  return render(
    <TDSMobileAITProvider brandPrimaryColor="#6B5CFF">
      <HomeScreen
        board={board}
        content={content}
        checkin={checkin}
        boardCount={1}
        activeIndex={0}
        notificationVisible={false}
        todayAdNotice={handlers.todayAdNotice}
        onDeleteCells={handlers.onDeleteCells}
        onSelectSub={handlers.onSelectSub ?? noop}
        onChangeGoal={handlers.onChangeGoal ?? noop}
        onChangeSubTitle={handlers.onChangeSubTitle ?? noop}
        onToday={noop}
        onOverview={handlers.onOverview ?? noop}
        onSettings={noop}
        onSwitchBoard={noop}
        onNotification={noop}
        onStartWithTemplate={noop}
      />
    </TDSMobileAITProvider>,
  );
}

describe('HomeScreen (홈 마무리)', () => {
  const content = getBundledContent();

  it('빈 판: 안내 한 줄 + 예시로 시작하기 버튼만, 잠긴 버튼(기록·전체 보기)과 진행률·편집 안내는 숨겨요. 빈 세부 목표 칸에는 글이 없어요', () => {
    const onOverview = vi.fn();
    const onChangeGoal = vi.fn();
    renderHome(createEmptyBoard(1759000000000), content, undefined, { onOverview, onChangeGoal, onDeleteCells: vi.fn() });
    // 편집 버튼은 없어요(2.1 칸을 길게 누르기). 고칠 글이 없으니 길게 누르기 안내도 없어요
    expect(screen.queryByRole('button', { name: '완료' })).not.toBeInTheDocument();
    expect(screen.queryByText('칸을 길게 누르면 고치거나 지울 수 있어요')).not.toBeInTheDocument();
    expect(screen.queryByText('목표 1')).not.toBeInTheDocument(); // "목표 n" 자리 표시 없음
    expect(screen.getByRole('button', { name: '세부 목표 1' }).textContent).toBe(''); // '+' 아이콘만
    // 다음에 채울 칸은 가운데(핵심 목표)라 '눌러서 적기' 는 가운데에만
    expect(screen.getAllByText('눌러서 적기')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '핵심 목표' })).toHaveTextContent('눌러서 적기');
    expect(screen.getByText('가운데 칸을 눌러 핵심 목표부터 정해 보세요')).toBeInTheDocument();
    expect(screen.getByText('예시로 시작하기').closest('button')).not.toBeDisabled();
    expect(screen.queryByText('기록 보기')).not.toBeInTheDocument();
    expect(screen.queryByText('전체 보기')).not.toBeInTheDocument();
    expect(screen.queryByText('공유')).not.toBeInTheDocument(); // 공유는 전체 보기 화면으로 옮겼어요
    expect(screen.queryByText('오늘 실천')).not.toBeInTheDocument();
    // 빈 가운데 칸은 그 자리에서 시트로 정해요(편집 화면으로 가지 않아요)
    fireEvent.click(screen.getByRole('button', { name: '핵심 목표' }));
    expect(screen.getByText('어떤 목표를 이루고 싶나요?')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('예: 올해 안에 책 한 권 쓰기'), { target: { value: '자격증 따기' } });
    fireEvent.click(sheetDone());
    expect(onChangeGoal).toHaveBeenCalledWith('자격증 따기');
    expect(onOverview).not.toHaveBeenCalled();
  });

  it('핵심 목표만 있으면 둘레 칸을 눌러 세부 목표를 정하라고 안내하고, 첫 빈 칸에 눌러서 적기가 붙어요', () => {
    const board = createEmptyBoard(1759000000000);
    board.goal = '자격증 따기';
    renderHome(board, content);
    expect(screen.getByText('둘레 칸을 눌러 세부 목표를 정해 보세요')).toBeInTheDocument();
    expect(screen.getAllByText('눌러서 적기')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '세부 목표 1' })).toHaveTextContent('눌러서 적기');
  });

  it('빈 세부 목표 칸을 누르면 그 자리에서 정하고, 채워진 칸은 그 세부 목표 화면으로 가요', async () => {
    const onSelectSub = vi.fn();
    const onChangeSubTitle = vi.fn();
    renderHome(filledBoard(true), content, undefined, { onSelectSub, onChangeSubTitle });
    fireEvent.click(screen.getByRole('button', { name: '세부 목표 2' }));
    expect(screen.getByText('건강한 한 해 칸의 세부 목표는 무엇인가요?')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('예: 꾸준한 운동'), { target: { value: '독서' } });
    fireEvent.click(sheetDone());
    expect(onChangeSubTitle).toHaveBeenCalledWith(1, '독서');
    expect(onSelectSub).not.toHaveBeenCalled();
    // 시트가 닫히고 나면(포커스 잠금 해제) 다시 칸을 누를 수 있어요
    await waitFor(() => expect(document.getElementById('mandalart-cell-editor')).toBeNull());
    fireEvent.click(await screen.findByRole('button', { name: '운동, 오늘 1개 중 0개' }));
    expect(onSelectSub).toHaveBeenCalledWith(0);
  });

  it('목표가 있으면 가운데 칸은 누를 수 없는 이름표(2.1), 전체 보기는 버튼으로. 편집 버튼 대신 길게 누르기를 알려 줘요', () => {
    const onOverview = vi.fn();
    renderHome(filledBoard(true), content, undefined, { onOverview, onDeleteCells: vi.fn() });
    expect(screen.queryByRole('button', { name: '건강한 한 해' })).not.toBeInTheDocument();
    const centers = screen.getAllByText('건강한 한 해');
    fireEvent.click(centers[centers.length - 1]); // 가운데 칸 글을 눌러도
    expect(onOverview).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '전체 보기' }));
    expect(onOverview).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '완료' })).not.toBeInTheDocument();
    expect(screen.getByText('칸을 길게 누르면 고치거나 지울 수 있어요')).toBeInTheDocument();
  });

  it('전면 광고가 나올 차례면 기록 보기 버튼에 AD 표시와 안내 한 줄, 아니면 둘 다 없어요', () => {
    const notice = '기록 보기를 누르면 광고가 한 번 나와요. 오늘은 그 뒤로 광고 없이 볼 수 있어요.';
    const { unmount } = renderHome(filledBoard(true), content, undefined, { todayAdNotice: true });
    const withAd = screen.getByRole('button', { name: '광고 보고 기록 보기' });
    expect(withAd).toHaveTextContent('AD');
    expect(screen.getByText(notice)).toBeInTheDocument();
    unmount();
    renderHome(filledBoard(true), content);
    expect(screen.getByRole('button', { name: '기록 보기' })).not.toHaveTextContent('AD');
    expect(screen.queryByText(notice)).not.toBeInTheDocument();
  });

  it("세부 목표의 실천을 오늘 전부 체크하면 그 칸이 진해지고 '오늘 다 했어요'로 바뀌어요(✓ 는 편집 모드의 고른 칸만)", () => {
    const board = filledBoard(true);
    board.subs[0].actions[1] = '저녁 산책';
    const today = dateKey();
    const half: CheckinRecord = { days: { [today]: [actionIndex(0, 0)] }, lastCompletedAt: 1 };
    const { unmount } = renderHome(board, content, half);
    const partial = screen.getByRole('button', { name: '운동, 오늘 2개 중 1개' });
    expect(partial.querySelector('.mg-cell-check')).toBeNull();
    expect(screen.getByText(/오늘 1개 했어요/)).toBeInTheDocument();
    unmount();
    const all: CheckinRecord = { days: { [today]: [actionIndex(0, 0), actionIndex(0, 1)] }, lastCompletedAt: 1 };
    renderHome(board, content, all);
    const done = screen.getByRole('button', { name: '운동, 오늘 다 했어요' });
    expect(done.querySelector('.mg-cell-check')).toBeNull();
    // 이름을 가리지 않게 모서리에 작은 '완료' 도장(.mg-cell-complete 일 때만 보여요)
    expect(done).toHaveClass('mg-cell-complete');
    expect(done.querySelector('.mg-cell-seal')).toHaveAttribute('data-label', '완료');
    expect(partial).not.toHaveClass('mg-cell-complete');
    expect(within(done).getByText('오늘 다 했어요')).toBeInTheDocument();
    expect(screen.getByText(/오늘 실천을 다 했어요/)).toBeInTheDocument();
  });

  it('목표만 있고 실천이 없으면 실천을 적으라고 안내하고, 실천이 생기면 체크 안내와 진행률이 나와요', () => {
    const { unmount } = renderHome(filledBoard(false), content);
    expect(screen.getByText('세부 목표 칸을 눌러 실천을 적어 보세요')).toBeInTheDocument();
    expect(screen.queryByText('예시로 시작하기')).not.toBeInTheDocument();
    expect(screen.getByText('기록 보기').closest('button')).toBeDisabled();
    expect(screen.queryByText('오늘 실천')).not.toBeInTheDocument();
    // 세부 목표 칸 이름에 칸 아래 글까지 담아요
    expect(screen.getByRole('button', { name: '운동, 실천을 적어요' })).toBeInTheDocument();
    unmount();
    renderHome(filledBoard(true), content);
    expect(screen.getByText(/세부 목표를 눌러 실천을 체크해요/)).toBeInTheDocument();
    expect(screen.getByText('기록 보기').closest('button')).not.toBeDisabled();
    expect(screen.getByText('오늘 실천')).toBeInTheDocument();
    // "오늘 0/1" 은 날짜처럼 읽힐 수 있어 "오늘 1개 중 0개" 로 읽혀요
    expect(screen.getByRole('button', { name: '운동, 오늘 1개 중 0개' })).toBeInTheDocument();
  });

  it('공지가 있으면 Top 아래 한 줄, 없으면 기간 안의 시즌 문구만, 둘 다 없으면 아무것도 없어요', () => {
    const season = { id: 'test-season', title: '테스트 시즌', from: '2000-01-01', to: '2999-12-31', message: '새해 목표를 만다라트로 그려 보세요' };
    const { unmount } = renderHome(filledBoard(true), { ...content, notice: '10월 한 달 체크 기록을 모아 봐요', season });
    expect(screen.getByText('10월 한 달 체크 기록을 모아 봐요')).toBeInTheDocument();
    expect(screen.queryByText(season.message)).not.toBeInTheDocument(); // 공지가 우선
    unmount();
    const second = renderHome(filledBoard(true), { ...content, notice: null, season });
    expect(screen.getByText(season.message)).toBeInTheDocument();
    second.unmount();
    renderHome(filledBoard(true), { ...content, notice: null, season: { ...season, from: '2000-01-01', to: '2000-01-02' } });
    expect(screen.queryByText(season.message)).not.toBeInTheDocument();
  });
});
