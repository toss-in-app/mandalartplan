import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEmptyBoard } from '../lib/mandalart';
import { fakeCanvasContext } from '../test/fakeCanvas';
import { ShareScreen } from './ShareScreen';

function filledBoard() {
  const board = createEmptyBoard(1759000000000);
  board.goal = '건강한 한 해';
  board.subs[0].title = '운동';
  board.subs[0].actions[0] = '아침 스트레칭';
  return board;
}

function renderShare(props: Partial<Parameters<typeof ShareScreen>[0]> = {}) {
  const handlers = { onSaveImage: vi.fn(), onShareText: vi.fn(), onShareLink: vi.fn(), onDone: vi.fn() };
  render(
    <TDSMobileAITProvider brandPrimaryColor="#6B5CFF">
      <ShareScreen board={filledBoard()} checkin={{ days: { '2026-10-06': [0] }, lastCompletedAt: 1 }} canSave busy={false} {...handlers} {...props} />
    </TDSMobileAITProvider>,
  );
  return handlers;
}

describe('ShareScreen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('캔버스가 있으면 미리보기 이미지를 그리고, 저장을 누르면 PNG 본문을 넘겨요', () => {
    const { ctx, calls } = fakeCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,QUJD');

    const handlers = renderShare();
    const img = screen.getByAltText('만다라트 9×9 이미지 미리보기') as HTMLImageElement;
    expect(img.src).toBe('data:image/png;base64,QUJD');
    // 머리글·칸 글이 캔버스에 그려졌어요
    expect(calls.fillText).toContain('건강한 한 해');
    expect(calls.fillText.some((t) => t.startsWith('운동'))).toBe(true);
    expect(calls.fillText.some((t) => t.includes('만다라트 · 토스'))).toBe(true);

    fireEvent.click(screen.getByText('이미지 저장하기'));
    expect(handlers.onSaveImage).toHaveBeenCalledWith(expect.objectContaining({ base64: 'QUJD', width: 1080, height: 1350 }));

    fireEvent.click(screen.getByText('글로 공유하기'));
    fireEvent.click(screen.getByText('링크 공유하기'));
    expect(handlers.onShareText).toHaveBeenCalledTimes(1);
    expect(handlers.onShareLink).toHaveBeenCalledTimes(1);
  });

  it('캔버스가 없으면 안내를 보여주고 저장 버튼은 눌리지 않아요', () => {
    const handlers = renderShare();
    expect(screen.getByText('미리보기를 만들 수 없어요')).toBeInTheDocument();
    expect(screen.queryByAltText('만다라트 9×9 이미지 미리보기')).not.toBeInTheDocument();
    const save = screen.getByText('이미지 저장하기').closest('button')!;
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(handlers.onSaveImage).not.toHaveBeenCalled();
  });

  it('토스앱 버전이 낮으면 저장 버튼 대신 업데이트 안내, 빈 판이면 홈으로 안내해요', () => {
    renderShare({ canSave: false });
    expect(screen.queryByText('이미지 저장하기')).not.toBeInTheDocument();
    expect(screen.getByText(/토스앱을 업데이트하면/)).toBeInTheDocument();
  });

  it('빈 판이면 Result 로 홈 이동만 안내해요', () => {
    const handlers = renderShare({ board: createEmptyBoard(1) });
    expect(screen.getByText('아직 적은 목표가 없어요')).toBeInTheDocument();
    fireEvent.click(screen.getByText('홈으로'));
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
  });
});
