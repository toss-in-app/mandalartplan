import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { fireEvent, render, screen } from '@testing-library/react';
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
  onEditCore?: () => void;
  onOverview?: () => void;
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
        onEditCore={handlers.onEditCore ?? noop}
        onSelectSub={noop}
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

  it('빈 판: 안내 한 줄 + 예시로 시작하기 버튼 + 편집만, 잠긴 버튼(기록·전체 보기)과 진행률은 숨겨요. 가운데 칸은 편집으로', () => {
    const onEditCore = vi.fn();
    const onOverview = vi.fn();
    renderHome(createEmptyBoard(1759000000000), content, undefined, { onEditCore, onOverview });
    expect(screen.getByText('가운데 칸을 눌러 핵심 목표부터 정해 보세요')).toBeInTheDocument();
    expect(screen.getByText('예시로 시작하기').closest('button')).not.toBeDisabled();
    expect(screen.queryByText('기록 보기')).not.toBeInTheDocument();
    expect(screen.queryByText('전체 보기')).not.toBeInTheDocument();
    expect(screen.queryByText('공유')).not.toBeInTheDocument(); // 공유는 전체 보기 화면으로 옮겼어요
    expect(screen.queryByText('오늘 실천')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '핵심 목표' }));
    expect(onEditCore).toHaveBeenCalledTimes(1);
    expect(onOverview).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('편집'));
    expect(onEditCore).toHaveBeenCalledTimes(2);
  });

  it('목표가 있으면 가운데 칸은 전체 보기로 가고, 편집은 오른쪽 위 버튼으로만 가요', () => {
    const onEditCore = vi.fn();
    const onOverview = vi.fn();
    renderHome(filledBoard(true), content, undefined, { onEditCore, onOverview });
    fireEvent.click(screen.getByRole('button', { name: '건강한 한 해' }));
    expect(onOverview).toHaveBeenCalledTimes(1);
    expect(onEditCore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('편집'));
    expect(onEditCore).toHaveBeenCalledTimes(1);
  });

  it('세부 목표의 실천을 오늘 전부 체크하면 그 칸에 체크 표시가 붙고 안내도 바뀌어요', () => {
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
    const done = screen.getByRole('button', { name: '운동, 오늘 2개 중 2개' });
    expect(done.querySelector('.mg-cell-check')).not.toBeNull();
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
