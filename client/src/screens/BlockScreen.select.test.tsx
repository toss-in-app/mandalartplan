import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CENTER, cellOfRing, createEmptyBoard, type Board } from '../lib/mandalart';
import { BlockScreen } from './BlockScreen';

const NOW = 1759000000000;

function board(): Board {
  const b = createEmptyBoard(NOW);
  b.goal = '토익 900점';
  b.subs[0].title = '듣기';
  b.subs[0].actions = ['받아쓰기', '쉐도잉', '팟캐스트', '', '', '', '', ''];
  b.subs[1].title = '읽기';
  return b;
}

function renderBlock(block: number, onDeleteCells = vi.fn(() => vi.fn())) {
  const utils = render(
    <TDSMobileAITProvider brandPrimaryColor="#6B5CFF">
      <BlockScreen
        board={board()}
        block={block}
        onChangeGoal={vi.fn()}
        onChangeSubTitle={vi.fn()}
        onChangeAction={vi.fn()}
        onDone={vi.fn()}
        onDeleteCells={onDeleteCells}
      />
    </TDSMobileAITProvider>,
  );
  return { ...utils, onDeleteCells };
}

const cell = (name: string) => screen.getByRole('button', { name });
const selectingNow = () => screen.queryByText('지울 칸을 누르거나 쭉 끌어서 골라요') !== null;
const sheetOpen = () => document.getElementById('mandalart-cell-editor') !== null;
const original = document.elementFromPoint;
afterEach(() => {
  document.elementFromPoint = original;
  vi.useRealTimers();
});

/** 손가락이 지나가는 칸 순서대로 elementFromPoint 가 돌려줄 요소 */
function fingerOver(...elements: HTMLElement[]) {
  const queue = [...elements];
  document.elementFromPoint = vi.fn(() => queue.shift() ?? null) as typeof document.elementFromPoint;
}

describe('BlockScreen 여러 칸 지우기 (2.1, 버튼 단계 없이)', () => {
  it("평소엔 '선택' 버튼이 없고, 칸을 누르면 그 칸 입력창이 떠요. 안내 문구로 길게 누르기·쓸기를 알려 줘요", async () => {
    renderBlock(cellOfRing(0));
    expect(screen.queryByRole('button', { name: '선택' })).not.toBeInTheDocument();
    expect(screen.getByText('칸을 누르면 글을 적어요(한 칸에 40자). 길게 누르거나 옆으로 쓸면 여러 칸을 골라 지울 수 있어요.')).toBeInTheDocument();
    fireEvent.click(cell('받아쓰기'));
    await waitFor(() => expect(sheetOpen()).toBe(true));
    expect(selectingNow()).toBe(false);
  });

  it('길게 누르면 고르기 모드(칸이 흔들려요): 누른 칸이 골라지고, 손을 뗀 뒤의 click 은 입력창을 열지 않아요', () => {
    vi.useFakeTimers();
    const { container } = renderBlock(cellOfRing(0));
    const a = cell('받아쓰기');
    fingerOver(a);
    fireEvent.pointerDown(a, { clientX: 10, clientY: 10 });
    expect(selectingNow()).toBe(false);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(selectingNow()).toBe(true);
    expect(container.querySelector('.mg-jiggle')).not.toBeNull();
    expect(cell('받아쓰기')).toHaveAttribute('aria-pressed', 'true');
    expect(within(cell('받아쓰기')).getByText('✓')).toBeInTheDocument();
    fireEvent.pointerUp(a);
    fireEvent.click(cell('받아쓰기'));
    expect(sheetOpen()).toBe(false);
    expect(cell('받아쓰기')).toHaveAttribute('aria-pressed', 'true'); // click 으로 다시 빠지지 않아요
    expect(screen.getByRole('button', { name: '1칸 삭제' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
  });

  it('옆으로 쓸면 바로 고르기 모드로 들어가 지나간 칸을 골라요', () => {
    renderBlock(cellOfRing(0));
    const [a, b, c] = [cell('받아쓰기'), cell('쉐도잉'), cell('팟캐스트')];
    fingerOver(a, b, c);
    fireEvent.pointerDown(a, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(a, { clientX: 60, clientY: 12 });
    fireEvent.pointerMove(a, { clientX: 120, clientY: 14 });
    fireEvent.pointerUp(a);
    expect(selectingNow()).toBe(true);
    expect([cell('받아쓰기'), cell('쉐도잉'), cell('팟캐스트')].map((el) => el.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true']);
  });

  it('위아래로 움직이면 스크롤로 보고 고르지 않아요(길게 누르기도 취소)', () => {
    vi.useFakeTimers();
    renderBlock(cellOfRing(0));
    const a = cell('받아쓰기');
    fingerOver(a);
    fireEvent.pointerDown(a, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(a, { clientX: 12, clientY: 60 });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(selectingNow()).toBe(false);
  });

  it('고르기 모드에서는 누르면 고르기·빼기, 끌면 처음 칸 기준으로 고르기 또는 빼기', () => {
    vi.useFakeTimers();
    renderBlock(cellOfRing(0));
    fingerOver(cell('받아쓰기'));
    fireEvent.pointerDown(cell('받아쓰기'), { clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerUp(cell('받아쓰기'));
    act(() => {
      vi.runOnlyPendingTimers(); // 손을 뗀 뒤 click 건너뛰기 풀기
    });
    fireEvent.click(cell('쉐도잉')); // 키보드처럼 click 만
    expect(cell('쉐도잉')).toHaveAttribute('aria-pressed', 'true');
    // 고른 칸에서 시작해 끌면 빼기
    const [a, b] = [cell('받아쓰기'), cell('쉐도잉')];
    fingerOver(a, b);
    fireEvent.pointerDown(a, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(a, { clientX: 60, clientY: 10 });
    fireEvent.pointerUp(a);
    expect([cell('받아쓰기'), cell('쉐도잉')].map((el) => el.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
    expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled();
  });

  it("빨간 '삭제' → 확인 창 → 지우고 토스트의 '되돌리기'", async () => {
    const undo = vi.fn();
    const { onDeleteCells } = renderBlock(cellOfRing(0), vi.fn(() => undo));
    const [a, b, c] = [cell('받아쓰기'), cell('쉐도잉'), cell('팟캐스트')];
    fingerOver(a, b, c);
    fireEvent.pointerDown(a, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(a, { clientX: 60, clientY: 10 });
    fireEvent.pointerUp(a);
    fireEvent.click(screen.getByRole('button', { name: '2칸 삭제' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('2칸을 삭제할까요?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(onDeleteCells).toHaveBeenCalledWith([cellOfRing(0), cellOfRing(1)]));
    expect((await screen.findAllByText('2칸을 삭제했어요')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '완료' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('되돌리기')[0]);
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("'취소'는 지우지 않고 고르기를 끝내요", () => {
    const { onDeleteCells } = renderBlock(cellOfRing(0));
    const [a, b] = [cell('받아쓰기'), cell('쉐도잉')];
    fingerOver(a, b);
    fireEvent.pointerDown(a, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(a, { clientX: 60, clientY: 10 });
    fireEvent.pointerUp(a);
    expect(selectingNow()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(selectingNow()).toBe(false);
    expect(onDeleteCells).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '완료' })).toBeInTheDocument();
  });

  it('키보드·스크린리더는 포커스하면 보이는 입구로 고르기 모드에 들어가요', () => {
    renderBlock(CENTER);
    fireEvent.click(screen.getByRole('button', { name: '여러 칸 골라 지우기' }));
    expect(selectingNow()).toBe(true);
    fireEvent.click(cell('듣기'));
    expect(cell('듣기')).toHaveAttribute('aria-pressed', 'true');
  });

  it('가운데 블록에서 실천이 있는 세부 목표 이름을 지우면 실천은 그대로라고 알려 줘요', async () => {
    renderBlock(CENTER);
    fireEvent.click(screen.getByRole('button', { name: '여러 칸 골라 지우기' }));
    fireEvent.click(cell('듣기'));
    fireEvent.click(screen.getByRole('button', { name: '1칸 삭제' }));
    expect(within(await screen.findByRole('dialog')).getByText('세부 목표를 지워도 그 아래 실천은 그대로예요.')).toBeInTheDocument();
  });

  it('지울 칸이 없으면(빈 블록) 고르기 입구도 안내도 없어요', () => {
    renderBlock(cellOfRing(5));
    expect(screen.queryByRole('button', { name: '여러 칸 골라 지우기' })).not.toBeInTheDocument();
    expect(screen.getByText('칸을 누르면 글을 적을 수 있어요. 한 칸에 40자까지예요.')).toBeInTheDocument();
  });
});
