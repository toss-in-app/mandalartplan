import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
const original = document.elementFromPoint;
afterEach(() => {
  document.elementFromPoint = original;
});

/** 손가락이 지나가는 칸 순서대로 elementFromPoint 가 돌려줄 요소 */
function fingerOver(...elements: HTMLElement[]) {
  const queue = [...elements];
  document.elementFromPoint = vi.fn(() => queue.shift() ?? null) as typeof document.elementFromPoint;
}

describe('BlockScreen 여러 칸 지우기 (2.1)', () => {
  it("'선택'을 누르면 고르기 모드: 글이 있는 칸만 고를 수 있고, 고른 칸은 '다 했어요' 모양(✓)과 선택됨으로 읽혀요", () => {
    renderBlock(cellOfRing(0));
    expect(screen.getByRole('button', { name: '완료' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '선택' }));
    expect(screen.getByText('지울 칸을 누르거나 쭉 끌어서 골라요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled();
    // 빈 실천 칸은 버튼이 아니에요
    expect(screen.queryByRole('button', { name: '실천 4' })).not.toBeInTheDocument();

    fireEvent.click(cell('받아쓰기')); // 키보드(Enter)처럼 click 만 온 경우
    expect(cell('받아쓰기')).toHaveAttribute('aria-pressed', 'true');
    expect(within(cell('받아쓰기')).getByText('✓')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1칸 삭제' })).toBeEnabled();
    fireEvent.click(cell('받아쓰기')); // 다시 누르면 빠져요
    expect(cell('받아쓰기')).toHaveAttribute('aria-pressed', 'false');
  });

  it('쭉 끌면 지나간 칸이 모두 골라지고, 손가락으로 누른 뒤의 click 은 두 번 세지 않아요', async () => {
    renderBlock(cellOfRing(0));
    fireEvent.click(screen.getByRole('button', { name: '선택' }));
    const [a, b, c] = [cell('받아쓰기'), cell('쉐도잉'), cell('팟캐스트')];
    fingerOver(a, b, c);
    fireEvent.pointerDown(a);
    fireEvent.pointerMove(a);
    fireEvent.pointerMove(a);
    fireEvent.pointerUp(c);
    fireEvent.click(a); // 같은 칸에서 떼면 브라우저가 click 도 보내요
    expect([a, b, c].map((el) => el.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true']);
    await waitFor(() => expect(screen.getByRole('button', { name: '3칸 삭제' })).toBeEnabled());

    // 고른 칸에서 시작해 끌면 빼기
    fingerOver(b, c);
    fireEvent.pointerDown(b);
    fireEvent.pointerMove(b);
    fireEvent.pointerUp(c);
    expect([a, b, c].map((el) => el.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
  });

  it("빨간 '삭제' → 확인 창 → 지우고 토스트의 '되돌리기'", async () => {
    const undo = vi.fn();
    const { onDeleteCells } = renderBlock(cellOfRing(0), vi.fn(() => undo));
    fireEvent.click(screen.getByRole('button', { name: '선택' }));
    fireEvent.click(cell('받아쓰기'));
    fireEvent.click(cell('팟캐스트'));
    fireEvent.click(screen.getByRole('button', { name: '2칸 삭제' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('2칸을 삭제할까요?')).toBeInTheDocument();
    expect(onDeleteCells).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));

    await waitFor(() => expect(onDeleteCells).toHaveBeenCalledWith([cellOfRing(0), cellOfRing(2)]));
    expect((await screen.findAllByText('2칸을 삭제했어요')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '완료' })).toBeInTheDocument(); // 고르기 모드가 끝나요
    fireEvent.click(screen.getAllByText('되돌리기')[0]);
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("확인 창에서 '닫기'면 지우지 않고, '취소'로 고르기를 끝내요", async () => {
    const { onDeleteCells } = renderBlock(cellOfRing(0));
    fireEvent.click(screen.getByRole('button', { name: '선택' }));
    fireEvent.click(cell('쉐도잉'));
    fireEvent.click(screen.getByRole('button', { name: '1칸 삭제' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '닫기' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onDeleteCells).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.getByRole('button', { name: '완료' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /칸 삭제$/ })).not.toBeInTheDocument();
  });

  it('가운데 블록에서 실천이 있는 세부 목표 이름을 지우면 실천은 그대로라고 알려 줘요', async () => {
    renderBlock(CENTER);
    fireEvent.click(screen.getByRole('button', { name: '선택' }));
    fireEvent.click(cell('듣기'));
    fireEvent.click(screen.getByRole('button', { name: '1칸 삭제' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('세부 목표를 지워도 그 아래 실천은 그대로예요.')).toBeInTheDocument();
  });

  it('지울 칸이 없으면(빈 블록) 선택 버튼이 없어요', () => {
    renderBlock(cellOfRing(5));
    expect(screen.queryByRole('button', { name: '선택' })).not.toBeInTheDocument();
  });
});
