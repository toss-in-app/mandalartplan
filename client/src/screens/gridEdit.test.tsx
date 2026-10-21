import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getBundledContent } from '../content';
import { logEvent } from '../lib/analytics';
import { cellOfRing, createEmptyBoard, type Board } from '../lib/mandalart';
import { HomeScreen } from './HomeScreen';
import { SubScreen } from './SubScreen';

vi.mock('../lib/analytics', () => ({ logEvent: vi.fn() }));

const NOW = 1759000000000;

function board(): Board {
  const b = createEmptyBoard(NOW);
  b.goal = '토익 900점';
  b.subs[0].title = '듣기';
  b.subs[0].actions = ['받아쓰기', '쉐도잉', '팟캐스트', '', '', '', '', ''];
  b.subs[1].title = '읽기';
  return b;
}

interface SubOptions {
  board?: Board;
  onDeleteCells?: (cells: number[]) => () => void;
  /** 자리 바꾸기(3.0). 넘기지 않으면 꾹 눌러 끌기·'자리 바꾸기' 입구가 없어요 */
  onSwapCells?: (a: number, b: number) => void;
  /** 가운데 이름표로 홈(3.0 시안 9). 넘기지 않으면(체험판) 가운데는 이름표 */
  onHome?: () => void;
  editLink?: { cell: number | null; onDone: () => void };
}

function subScreen(subIndex: number, options: SubOptions = {}) {
  const handlers = { onToggle: vi.fn(), onChangeAction: vi.fn(), onChangeSubTitle: vi.fn(), onDeleteCells: options.onDeleteCells ?? vi.fn(() => vi.fn()) };
  const ui = (b: Board) => (
    <TDSMobileAITProvider brandPrimaryColor="#6B5CFF">
      <SubScreen board={b} subIndex={subIndex} checkin={undefined} {...handlers} onSwapCells={options.onSwapCells} onHome={options.onHome} editLink={options.editLink} />
    </TDSMobileAITProvider>
  );
  const utils = render(ui(options.board ?? board()));
  return { ...utils, ...handlers, rerenderWith: (b: Board) => utils.rerender(ui(b)) };
}

function homeScreen(options: { onSwapCells?: (a: number, b: number) => void } = {}) {
  const handlers = { onSelectSub: vi.fn(), onChangeGoal: vi.fn(), onChangeSubTitle: vi.fn(), onDeleteCells: vi.fn(() => vi.fn()), onSwapCells: options.onSwapCells };
  const noop = vi.fn();
  const utils = render(
    <TDSMobileAITProvider brandPrimaryColor="#6B5CFF">
      <HomeScreen
        board={board()}
        content={getBundledContent()}
        checkin={undefined}
        boardCount={1}
        activeIndex={0}
        notificationVisible={false}
        onToday={noop}
        onOverview={noop}
        onSettings={noop}
        onSwitchBoard={noop}
        onNotification={noop}
        {...handlers}
      />
    </TDSMobileAITProvider>,
  );
  return { ...utils, ...handlers };
}

/** 칸 버튼. 평소엔 '받아쓰기, 오늘 아직'처럼 체크 상태가, 편집 모드에선 칸 글만 이름이에요 */
const cell = (text: string) => screen.getByRole('button', { name: new RegExp(`^${text}(,|$)`) });
const editingNow = () => screen.queryByRole('button', { name: '완료' }) !== null;
const sheetOpen = () => document.getElementById('mandalart-cell-editor') !== null;
const reveal = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

/** 칸 편집 시트 안의 '완료' (오른쪽 위 '완료' 와 구분) */
function sheetDone() {
  let node: HTMLElement | null = document.getElementById('mandalart-cell-editor');
  while (node && !within(node).queryByText('완료')) node = node.parentElement;
  return within(node!).getByText('완료');
}
const sheetDoneButton = () => sheetDone().closest('button')!;

const original = document.elementFromPoint;
afterEach(() => {
  document.elementFromPoint = original;
  vi.useRealTimers();
  vi.mocked(logEvent).mockClear();
});

/** 손가락이 지나가는 칸 순서대로 elementFromPoint 가 돌려줄 요소 */
function fingerOver(...elements: HTMLElement[]) {
  const queue = [...elements];
  document.elementFromPoint = vi.fn(() => queue.shift() ?? null) as typeof document.elementFromPoint;
}

/** 손가락으로 짧게 누르기(누르기 → 떼기 → click) */
function tap(el: HTMLElement) {
  fingerOver(el);
  fireEvent.pointerDown(el, { clientX: 10, clientY: 10 });
  fireEvent.pointerUp(el);
  fireEvent.click(el);
}

/** a 를 누른 채 옆으로 끌며 rest 칸을 지나가요 */
function swipe(a: HTMLElement, ...rest: HTMLElement[]) {
  fingerOver(a, ...rest);
  fireEvent.pointerDown(a, { clientX: 10, clientY: 10 });
  rest.forEach((_, i) => fireEvent.pointerMove(a, { clientX: 10 + 60 * (i + 1), clientY: 12 }));
  fireEvent.pointerUp(a);
}

describe('제자리 편집 모드 (2.1, 편집 버튼·편집 화면 없이 아이폰처럼)', () => {
  it('평소엔 편집 버튼도 3×3 아래 안내 문구도 없고, 짧게 누르면 평소 동작(체크)', () => {
    const { onToggle } = subScreen(0);
    expect(editingNow()).toBe(false);
    expect(screen.queryByText('칸을 길게 누르면 고치거나 지울 수 있어요')).not.toBeInTheDocument();
    tap(cell('받아쓰기'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(sheetOpen()).toBe(false);
    expect(editingNow()).toBe(false);
  });

  it("길게 누르면 편집 모드: 글이 있는 칸만 흔들리고 '완료'가 생겨요. 손을 뗀 뒤의 click 은 체크하지 않아요", () => {
    vi.useFakeTimers();
    const { container, onToggle } = subScreen(0);
    const a = cell('받아쓰기');
    fingerOver(a);
    fireEvent.pointerDown(a, { clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(editingNow()).toBe(false); // 아직 짧은 누르기
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(editingNow()).toBe(true);
    expect(container.querySelector('.mg-jiggle')).not.toBeNull();
    // 가운데(세부 목표 이름) + 글이 있는 실천 3칸
    expect(container.querySelectorAll('.mg-jiggle button.mg-cell[data-filled]')).toHaveLength(4);
    expect(screen.getByText('칸을 누르면 고치고, 빠르게 끌면 지울 칸을 골라요')).toBeInTheDocument();
    expect(logEvent).toHaveBeenCalledWith('edit_mode_enter', { screen: 'sub', via: 'longpress' });
    fireEvent.pointerUp(a);
    fireEvent.click(a);
    expect(onToggle).not.toHaveBeenCalled();
    expect(sheetOpen()).toBe(false);
  });

  it("편집 모드에서 누르면 그 칸 글을 고쳐요(가운데 = 세부 목표 이름, 체크는 안 해요). '완료'로 평소로", async () => {
    const { container, onToggle, onChangeSubTitle, onChangeAction } = subScreen(0);
    reveal('편집');
    expect(editingNow()).toBe(true);
    tap(cell('듣기'));
    expect(screen.getByText('세부 목표 1')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('예: 매일 글쓰기 습관'), { target: { value: '듣기 연습' } });
    fireEvent.click(sheetDone());
    expect(onChangeSubTitle).toHaveBeenCalledWith(0, '듣기 연습');
    await waitFor(() => expect(sheetOpen()).toBe(false));
    tap(cell('받아쓰기'));
    expect(screen.getByText('실천 1')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('예: 아침 스트레칭 10분'), { target: { value: '받아쓰기 20분' } });
    fireEvent.click(sheetDone());
    expect(onChangeAction).toHaveBeenCalledWith(0, 0, '받아쓰기 20분');
    expect(onToggle).not.toHaveBeenCalled();
    await waitFor(() => expect(sheetOpen()).toBe(false));

    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    expect(editingNow()).toBe(false);
    expect(container.querySelector('.mg-jiggle')).toBeNull();
    tap(cell('받아쓰기'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('평소엔 끌어도 편집 모드로 넘어가지 않고 체크도 하지 않아요(끌어서 고르기는 편집 모드에서만, 사용자 2026-10-21)', () => {
    const { onToggle } = subScreen(0);
    const a = cell('받아쓰기');
    swipe(a, cell('쉐도잉'), cell('팟캐스트'));
    fireEvent.click(a); // 끈 손가락을 뗀 뒤의 click
    expect(editingNow()).toBe(false);
    expect(onToggle).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalledWith('edit_mode_enter', expect.anything());
  });

  it('편집 모드에서 끌면 지나간 칸을 골라요', () => {
    subScreen(0);
    reveal('편집');
    swipe(cell('받아쓰기'), cell('쉐도잉'), cell('팟캐스트'));
    expect(['받아쓰기', '쉐도잉', '팟캐스트'].map((t) => cell(t).getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true']);
    expect(within(cell('받아쓰기')).getByText('✓')).toBeInTheDocument();
    expect(cell('받아쓰기')).not.toHaveClass('mg-cell-done'); // 고른 칸은 ✓, '완료' 도장은 오늘 한 실천만
    expect(screen.getByRole('button', { name: '3칸 삭제' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '선택 해제' })).toBeInTheDocument();
    expect(screen.getByText('지울 칸을 누르거나 빠르게 끌어서 골라요')).toBeInTheDocument();
  });

  it('길게 눌러 편집 모드가 된 손가락을 떼지 않고 끌면 고르기가 아니라 옮기기예요(3.0 — 옮길 수 없으면 아무 일도 없어요)', () => {
    vi.useFakeTimers();
    subScreen(0); // onSwapCells 없음 → 옮기기 없음
    const a = cell('받아쓰기');
    fingerOver(a, cell('쉐도잉'));
    fireEvent.pointerDown(a, { clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(editingNow()).toBe(true);
    fireEvent.pointerMove(a, { clientX: 70, clientY: 12 });
    fireEvent.pointerUp(a);
    expect(screen.queryByRole('button', { name: '2칸 삭제' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '선택 해제' })).not.toBeInTheDocument();
    expect(logEvent).toHaveBeenCalledWith('edit_mode_enter', { screen: 'sub', via: 'longpress' });
  });

  it('위아래로 움직이면 스크롤로 보고 고르지 않아요(길게 누르기도 취소)', () => {
    vi.useFakeTimers();
    subScreen(0);
    const a = cell('받아쓰기');
    fingerOver(a);
    fireEvent.pointerDown(a, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(a, { clientX: 12, clientY: 60 });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(editingNow()).toBe(false);
  });

  it('고르는 중엔 누르면 고르기·빼기, 고른 칸에서 끌면 빼기 — 다 빼면 아래 버튼이 사라지고 편집 모드는 그대로', () => {
    subScreen(0);
    reveal('편집');
    swipe(cell('받아쓰기'), cell('쉐도잉'));
    tap(cell('팟캐스트'));
    expect(screen.getByRole('button', { name: '3칸 삭제' })).toBeInTheDocument();
    swipe(cell('받아쓰기'), cell('쉐도잉')); // 고른 칸에서 시작 → 빼기
    expect(screen.getByRole('button', { name: '1칸 삭제' })).toBeInTheDocument();
    tap(cell('팟캐스트'));
    expect(screen.queryByRole('button', { name: '선택 해제' })).not.toBeInTheDocument();
    expect(editingNow()).toBe(true);
    // 고른 칸이 없으면 누르기 = 다시 고치기
    tap(cell('쉐도잉'));
    expect(sheetOpen()).toBe(true);
  });

  it("빨간 'n칸 삭제' → 확인 창 → 지우고 토스트의 '되돌리기'. 편집 모드는 이어져요", async () => {
    const undo = vi.fn();
    const { onDeleteCells } = subScreen(0, { onDeleteCells: vi.fn(() => undo) });
    reveal('편집');
    swipe(cell('받아쓰기'), cell('쉐도잉'));
    fireEvent.click(screen.getByRole('button', { name: '2칸 삭제' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('2칸을 삭제할까요?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(onDeleteCells).toHaveBeenCalledWith([cellOfRing(0), cellOfRing(1)]));
    expect((await screen.findAllByText('2칸을 삭제했어요')).length).toBeGreaterThan(0);
    expect(editingNow()).toBe(true);
    expect(screen.queryByRole('button', { name: '선택 해제' })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByText('되돌리기')[0]);
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("'선택 해제'는 지우지 않고 고르기만 끝내요", () => {
    const { onDeleteCells } = subScreen(0);
    reveal('편집');
    swipe(cell('받아쓰기'), cell('쉐도잉'));
    fireEvent.click(screen.getByRole('button', { name: '선택 해제' }));
    expect(screen.queryByRole('button', { name: '2칸 삭제' })).not.toBeInTheDocument();
    expect(onDeleteCells).not.toHaveBeenCalled();
    expect(editingNow()).toBe(true);
  });

  it("키보드·스크린리더는 포커스하면 보이는 '편집' → '지울 칸 고르기'로 같은 일을 해요", () => {
    homeScreen();
    reveal('편집');
    expect(editingNow()).toBe(true);
    reveal('지울 칸 고르기');
    expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled();
    fireEvent.click(cell('듣기')); // 키보드처럼 click 만
    expect(cell('듣기')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '1칸 삭제' })).toBeEnabled();
  });

  it('홈에서 세부 목표를 지우면 그 아래 실천도 함께 지워져요: 확인 창·토스트가 함께 지워지는 칸까지 세요', async () => {
    const { onDeleteCells } = homeScreen();
    reveal('편집');
    reveal('지울 칸 고르기');
    fireEvent.click(cell('듣기'));
    fireEvent.click(screen.getByRole('button', { name: '1칸 삭제' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('4칸을 삭제할까요?')).toBeInTheDocument();
    expect(within(dialog).getByText('세부 목표를 지우면 그 아래 실천 3개도 함께 지워져요.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(onDeleteCells).toHaveBeenCalledWith([cellOfRing(0)]));
    expect((await screen.findAllByText('4칸을 삭제했어요')).length).toBeGreaterThan(0);
  });

  it('홈에서 핵심 목표를 지우면 세부 목표와 실천까지 전부 지워진다고 알려 줘요', async () => {
    homeScreen();
    reveal('편집');
    reveal('지울 칸 고르기');
    fireEvent.click(cell('토익 900점'));
    fireEvent.click(screen.getByRole('button', { name: '1칸 삭제' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('6칸을 삭제할까요?')).toBeInTheDocument(); // 핵심 목표 + 세부 목표 2 + 실천 3
    expect(within(dialog).getByText('핵심 목표를 지우면 세부 목표 2개와 실천 3개도 함께 지워져요.')).toBeInTheDocument();
  });

  it('세부 목표 화면에서 가운데(세부 목표 이름)를 지우면 남은 실천도 함께 지워진다고 알려 줘요', async () => {
    subScreen(0);
    reveal('편집');
    reveal('지울 칸 고르기');
    fireEvent.click(cell('듣기'));
    fireEvent.click(cell('받아쓰기'));
    fireEvent.click(screen.getByRole('button', { name: '2칸 삭제' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('4칸을 삭제할까요?')).toBeInTheDocument();
    expect(within(dialog).getByText('세부 목표를 지우면 그 아래 실천 2개도 함께 지워져요.')).toBeInTheDocument();
  });

  it("입력 시트: 글이 없거나 다 지우면 '완료'가 꺼지고(Enter 도 저장 안 함), 글을 적으면 다시 켜져요", () => {
    const { onChangeSubTitle } = subScreen(0);
    reveal('편집');
    tap(cell('듣기'));
    const title = screen.getByPlaceholderText('예: 매일 글쓰기 습관');
    expect(sheetDoneButton()).toBeEnabled();
    fireEvent.change(title, { target: { value: '   ' } });
    expect(sheetDoneButton()).toBeDisabled();
    fireEvent.keyDown(title, { key: 'Enter' });
    fireEvent.click(sheetDoneButton());
    expect(onChangeSubTitle).not.toHaveBeenCalled();
    fireEvent.change(title, { target: { value: '듣기 연습' } });
    expect(sheetDoneButton()).toBeEnabled();
    fireEvent.keyDown(title, { key: 'Enter' });
    expect(onChangeSubTitle).toHaveBeenCalledWith(0, '듣기 연습');
  });

  it("입력 시트: 빈 칸을 눌러 처음 적을 때도 글을 적기 전엔 '완료'가 꺼져 있어요", () => {
    const { onChangeAction } = subScreen(0);
    reveal('편집');
    tap(cell('실천 4'));
    expect(sheetDoneButton()).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('예: 아침 스트레칭 10분'), { target: { value: '단어장' } });
    expect(sheetDoneButton()).toBeEnabled();
    fireEvent.click(sheetDoneButton());
    expect(onChangeAction).toHaveBeenCalledWith(0, 3, '단어장');
  });

  it('홈: 길게 누른 세부 목표 칸은 세부 목표 화면으로 가지 않고, 편집 모드에선 가운데(핵심 목표)를 눌러 고쳐요', () => {
    vi.useFakeTimers();
    const { onSelectSub } = homeScreen();
    expect(screen.queryByRole('button', { name: '토익 900점' })).not.toBeInTheDocument(); // 평소 가운데는 이름표
    const sub = cell('듣기');
    fingerOver(sub);
    fireEvent.pointerDown(sub, { clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerUp(sub);
    fireEvent.click(sub);
    expect(onSelectSub).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith('edit_mode_enter', { screen: 'home', via: 'longpress' });
    tap(cell('토익 900점'));
    expect(screen.getByText('어떤 목표를 이루고 싶나요?')).toBeInTheDocument();
    expect((screen.getByPlaceholderText('예: 올해 안에 책 한 권 쓰기') as HTMLTextAreaElement).value).toBe('토익 900점');
  });

  it('편집 모드에 들어갈 때와 나올 때 판이 바뀌었으면 board_edit 를 1회 보내요', () => {
    const { rerenderWith } = subScreen(0);
    reveal('편집');
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    expect(logEvent).not.toHaveBeenCalledWith('board_edit', expect.anything()); // 바뀐 게 없으면 안 보내요
    reveal('편집');
    const changed = board();
    changed.subs[0].actions[3] = '단어장';
    changed.updatedAt = NOW + 1000;
    rerenderWith(changed);
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    expect(logEvent).toHaveBeenCalledWith('board_edit', { block: cellOfRing(0) });
    expect(vi.mocked(logEvent).mock.calls.filter(([name]) => name === 'board_edit')).toHaveLength(1);
  });

  it("예전 편집 화면 링크(block/:n)로 들어오면 편집 모드로 시작하고 '완료'는 편집 모드를 끝내고 onDone", () => {
    const onDone = vi.fn();
    const { container } = subScreen(0, { editLink: { cell: null, onDone } });
    expect(editingNow()).toBe(true);
    expect(container.querySelector('.mg-jiggle')).not.toBeNull();
    expect(logEvent).toHaveBeenCalledWith('edit_mode_enter', { screen: 'sub', via: 'link' });
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(editingNow()).toBe(false); // 이전 화면이 없어도(딥링크) 편집 모드는 끝나요
  });

  it('링크에 칸이 있으면(block/:n/:cell) 그 칸 입력창이 바로 열려요. 세부 목표 이름이 비어 있으면 질문은 세부 목표 n', () => {
    const b = createEmptyBoard(NOW);
    b.subs[1].title = '독서';
    const { unmount } = subScreen(1, { board: b, editLink: { cell: cellOfRing(2), onDone: vi.fn() } });
    expect(screen.getByText('실천 3')).toBeInTheDocument();
    expect(screen.getByText('독서 칸의 실천은 무엇인가요?')).toBeInTheDocument();
    expect((screen.getByPlaceholderText('예: 아침 스트레칭 10분') as HTMLTextAreaElement).value).toBe('');
    unmount();
    subScreen(2, { board: b, editLink: { cell: cellOfRing(0), onDone: vi.fn() } });
    expect(screen.getByText('세부 목표 3 칸의 실천은 무엇인가요?')).toBeInTheDocument();
  });

  it("빈 블록: 길게 누르기 안내가 없고, 편집 모드에서도 '지울 칸 고르기' 입구 없이 '칸을 누르면 글을 적어요'", () => {
    subScreen(5);
    expect(screen.queryByText('칸을 길게 누르면 고치거나 지울 수 있어요')).not.toBeInTheDocument();
    reveal('편집');
    expect(screen.getByText('칸을 누르면 글을 적어요')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '지울 칸 고르기' })).not.toBeInTheDocument();
    tap(cell('세부 목표 6'));
    expect(screen.getByText('토익 900점 칸의 세부 목표는 무엇인가요?')).toBeInTheDocument();
  });

  it('세부 목표 화면 가운데(세부 목표 이름)는 홈이 없으면(체험판) 평소엔 이름표, 편집 모드에선 눌러서 고쳐요', () => {
    subScreen(0);
    expect(screen.queryByRole('button', { name: /^듣기/ })).not.toBeInTheDocument();
    expect(screen.queryByText('핵심 목표로')).not.toBeInTheDocument();
    reveal('편집');
    expect(cell('듣기')).toBeInTheDocument();
  });
});

describe("가운데 이름표로 홈 (3.0, 사용자 2026-10-21 시안 9-b — 왼쪽 위 ‹ 만, 스크린리더는 '핵심 목표로')", () => {
  it('평소엔 가운데 왼쪽 위에 ‹ 가 붙고 누르면 홈으로 가요(체크·입력창 아님)', () => {
    const onHome = vi.fn();
    const { onToggle } = subScreen(0, { onHome });
    const center = screen.getByRole('button', { name: '듣기, 핵심 목표로' });
    expect(center.querySelector('.mg-cell-way svg')).not.toBeNull();
    expect(screen.queryByText('핵심 목표로')).not.toBeInTheDocument(); // 글은 안 그리고 이름에만 붙여 읽어요
    tap(center);
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
    expect(sheetOpen()).toBe(false);
    expect(editingNow()).toBe(false);
  });

  it('편집 모드에선 ‹ 가 사라지고 가운데를 누르면 이름을 고쳐요. 길게 누른 손가락의 click 도 홈으로 가지 않아요', () => {
    vi.useFakeTimers();
    const onHome = vi.fn();
    subScreen(0, { onHome });
    const center = screen.getByRole('button', { name: '듣기, 핵심 목표로' });
    fingerOver(center);
    fireEvent.pointerDown(center, { clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerUp(center);
    fireEvent.click(center);
    expect(editingNow()).toBe(true);
    expect(onHome).not.toHaveBeenCalled();
    expect(document.querySelector('.mg-cell-way')).toBeNull();
    tap(cell('듣기'));
    expect(screen.getByText('세부 목표 1')).toBeInTheDocument();
    expect(onHome).not.toHaveBeenCalled();
  });

  it('세부 목표 이름이 비어 있으면 가운데는 그대로 이름표예요', () => {
    const b = createEmptyBoard(NOW);
    b.subs[2].actions[0] = '단어장';
    subScreen(2, { board: b, onHome: vi.fn() });
    expect(document.querySelector('.mg-cell-way')).toBeNull();
    expect(screen.queryByRole('button', { name: /세부 목표 3/ })).not.toBeInTheDocument();
  });
});

/** 꾹 누르기: a 를 누르고 LONG_PRESS 만큼 기다려요(가짜 타이머). 그 뒤 rest 칸 위로 끌어요 */
function holdAndDrag(a: HTMLElement, ...rest: HTMLElement[]) {
  fingerOver(a, ...rest);
  fireEvent.pointerDown(a, { clientX: 10, clientY: 10 });
  act(() => {
    vi.advanceTimersByTime(500);
  });
  rest.forEach((_, i) => fireEvent.pointerMove(a, { clientX: 10 + 60 * (i + 1), clientY: 12 }));
}

describe('자리 바꾸기 (3.0, 사용자 2026-10-21 — 아이폰 홈 화면처럼 꾹 누른 채 끌어 가운데를 제외하고 서로 스왑)', () => {
  it("편집 모드 안내에 꾹 눌러 끌기가 들어가고, 키보드 입구 '자리 바꾸기'가 생겨요", () => {
    subScreen(0, { onSwapCells: vi.fn() });
    reveal('편집');
    expect(screen.getByText('칸을 누르면 고치고, 빠르게 끌면 지울 칸을 골라요. 꾹 눌러 끌면 자리를 바꿔요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '자리 바꾸기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '지울 칸 고르기' })).toBeInTheDocument();
  });

  it('편집 모드에서 칸을 꾹 누르면 들리고(흔들림 대신 손가락을 따라오고), 다른 칸 위에 놓으면 둘의 자리가 바뀌어요', () => {
    vi.useFakeTimers();
    const onSwapCells = vi.fn();
    const { container, onToggle, onChangeAction } = subScreen(0, { onSwapCells });
    reveal('편집');
    const a = cell('받아쓰기');
    const b = cell('쉐도잉');
    fingerOver(a, b);
    fireEvent.pointerDown(a, { clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(a).not.toHaveClass('mg-cell-lifted'); // 아직 짧은 누르기
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(a).toHaveClass('mg-cell-lifted');
    expect(screen.getByText('다른 칸 위에 놓으면 자리를 바꿔요')).toBeInTheDocument();
    fireEvent.pointerMove(a, { clientX: 70, clientY: 22 });
    expect(a.style.transform).toBe('translate(60px, 12px) scale(1.06)');
    expect(b).toHaveClass('mg-cell-target');
    expect(container.querySelectorAll('.mg-cell-target')).toHaveLength(1);
    fireEvent.pointerUp(a);
    expect(onSwapCells).toHaveBeenCalledWith(cellOfRing(0), cellOfRing(1));
    expect(container.querySelector('.mg-cell-lifted')).toBeNull();
    expect(container.querySelector('.mg-cell-target')).toBeNull();
    // 놓은 손가락의 click 은 고치기·체크가 아니에요. 편집 모드는 이어져요
    fireEvent.click(a);
    expect(onChangeAction).not.toHaveBeenCalled();
    expect(onToggle).not.toHaveBeenCalled();
    expect(sheetOpen()).toBe(false);
    expect(editingNow()).toBe(true);
  });

  it('꾹 눌렀다가 그 자리에서 떼면 바뀌지 않고, 빈 칸 위에 놓으면 그 자리로 옮겨 가요', () => {
    vi.useFakeTimers();
    const onSwapCells = vi.fn();
    subScreen(0, { onSwapCells });
    reveal('편집');
    const a = cell('받아쓰기');
    holdAndDrag(a);
    fireEvent.pointerUp(a);
    expect(onSwapCells).not.toHaveBeenCalled();
    expect(editingNow()).toBe(true);
    holdAndDrag(cell('받아쓰기'), cell('실천 6'));
    fireEvent.pointerUp(cell('받아쓰기'));
    expect(onSwapCells).toHaveBeenCalledWith(cellOfRing(0), cellOfRing(5));
  });

  it('가운데는 들 수도 없고 놓을 자리도 못 돼요. 빈 칸도 들리지 않아요', () => {
    vi.useFakeTimers();
    const onSwapCells = vi.fn();
    const { container } = subScreen(0, { onSwapCells });
    reveal('편집');
    const center = cell('듣기');
    holdAndDrag(center, cell('받아쓰기'));
    expect(container.querySelector('.mg-cell-lifted')).toBeNull();
    fireEvent.pointerUp(center);
    expect(onSwapCells).not.toHaveBeenCalled();
    const a = cell('받아쓰기');
    holdAndDrag(a, center);
    expect(a).toHaveClass('mg-cell-lifted');
    expect(center).not.toHaveClass('mg-cell-target');
    fireEvent.pointerUp(a);
    expect(onSwapCells).not.toHaveBeenCalled();
    const empty = cell('실천 6');
    holdAndDrag(empty, cell('받아쓰기'));
    expect(container.querySelector('.mg-cell-lifted')).toBeNull();
    fireEvent.pointerUp(empty);
    expect(onSwapCells).not.toHaveBeenCalled();
  });

  it('꾹 누르기 전에 바로 끌면 그대로 지울 칸 고르기(스르륵 ✓)예요', () => {
    const onSwapCells = vi.fn();
    subScreen(0, { onSwapCells });
    reveal('편집');
    swipe(cell('받아쓰기'), cell('쉐도잉'), cell('팟캐스트'));
    expect(screen.getByRole('button', { name: '3칸 삭제' })).toBeInTheDocument();
    expect(onSwapCells).not.toHaveBeenCalled();
    expect(cell('받아쓰기')).not.toHaveClass('mg-cell-lifted');
  });

  it('지울 칸을 고르는 중엔 꾹 눌러도 들리지 않아요(고르기·빼기만)', () => {
    vi.useFakeTimers();
    const onSwapCells = vi.fn();
    const { container } = subScreen(0, { onSwapCells });
    reveal('편집');
    swipe(cell('받아쓰기'), cell('쉐도잉'));
    const c = cell('팟캐스트');
    holdAndDrag(c, cell('받아쓰기'));
    expect(container.querySelector('.mg-cell-lifted')).toBeNull();
    fireEvent.pointerUp(c);
    fireEvent.click(c); // 꾹 눌렀다 뗀 click 은 평소처럼 고르기
    expect(onSwapCells).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '3칸 삭제' })).toBeInTheDocument();
  });

  it('평소에 길게 누르면 편집 모드가 되면서 그 칸이 바로 들려요 — 떼지 않고 끌어 놓으면 자리가 바뀌어요(아이폰처럼)', () => {
    vi.useFakeTimers();
    const onSwapCells = vi.fn();
    const { onToggle } = subScreen(0, { onSwapCells });
    const a = cell('받아쓰기');
    holdAndDrag(a, cell('팟캐스트'));
    expect(editingNow()).toBe(true);
    expect(a).toHaveClass('mg-cell-lifted');
    expect(logEvent).toHaveBeenCalledWith('edit_mode_enter', { screen: 'sub', via: 'longpress' });
    fireEvent.pointerUp(a);
    fireEvent.click(a);
    expect(onSwapCells).toHaveBeenCalledWith(cellOfRing(0), cellOfRing(2));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('브라우저가 끌기를 가로채면(pointercancel) 바꾸지 않고 제자리로', () => {
    vi.useFakeTimers();
    const onSwapCells = vi.fn();
    const { container } = subScreen(0, { onSwapCells });
    reveal('편집');
    const a = cell('받아쓰기');
    holdAndDrag(a, cell('쉐도잉'));
    expect(cell('쉐도잉')).toHaveClass('mg-cell-target');
    fireEvent.pointerCancel(a);
    expect(onSwapCells).not.toHaveBeenCalled();
    expect(container.querySelector('.mg-cell-lifted')).toBeNull();
  });

  it("키보드·스크린리더: '자리 바꾸기' → 첫 칸 → 바꿀 칸을 차례로 눌러요. 첫 칸을 다시 누르면 취소", () => {
    const onSwapCells = vi.fn();
    subScreen(0, { onSwapCells });
    reveal('편집');
    reveal('자리 바꾸기');
    expect(screen.getByText('자리를 바꿀 첫 칸을 누르세요')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '지울 칸 고르기' })).not.toBeInTheDocument();
    fireEvent.click(cell('듣기')); // 가운데는 첫 칸이 못 돼요
    expect(screen.getByText('자리를 바꿀 첫 칸을 누르세요')).toBeInTheDocument();
    fireEvent.click(cell('받아쓰기'));
    expect(cell('받아쓰기')).toHaveClass('mg-cell-lifted');
    expect(screen.getByText('바꿀 칸을 누르세요. 첫 칸을 다시 누르면 취소예요')).toBeInTheDocument();
    fireEvent.click(cell('받아쓰기'));
    expect(cell('받아쓰기')).not.toHaveClass('mg-cell-lifted');
    fireEvent.click(cell('쉐도잉'));
    fireEvent.click(cell('듣기')); // 가운데는 놓을 자리가 못 돼요
    expect(onSwapCells).not.toHaveBeenCalled();
    fireEvent.click(cell('팟캐스트'));
    expect(onSwapCells).toHaveBeenCalledWith(cellOfRing(1), cellOfRing(2));
    expect(sheetOpen()).toBe(false);
    expect(screen.getByRole('button', { name: '자리 바꾸기' })).toBeInTheDocument(); // 끝나면 입구가 돌아와요
    expect(editingNow()).toBe(true);
  });

  it('홈: 세부 목표를 들면 실천도 함께 간다고 알려 주고, 핵심 목표(가운데)는 제외예요', () => {
    vi.useFakeTimers();
    const onSwapCells = vi.fn();
    const { container } = homeScreen({ onSwapCells });
    reveal('편집');
    expect(screen.getByText('칸을 누르면 고치고, 빠르게 끌면 지울 칸을 골라요. 꾹 눌러 끌면 자리를 바꿔요')).toBeInTheDocument();
    const goal = cell('토익 900점');
    holdAndDrag(goal, cell('듣기'));
    expect(container.querySelector('.mg-cell-lifted')).toBeNull();
    fireEvent.pointerUp(goal);
    const a = cell('듣기');
    holdAndDrag(a, cell('세부 목표 3'));
    expect(a).toHaveClass('mg-cell-lifted');
    expect(screen.getByText('다른 세부 목표 위에 놓으면 자리를 바꿔요. 실천도 함께 가요')).toBeInTheDocument();
    fireEvent.pointerUp(a);
    expect(onSwapCells).toHaveBeenCalledWith(cellOfRing(0), cellOfRing(2));
  });

  it("'완료'로 편집 모드를 끝내면 든 칸·자리 바꾸기 모드도 풀려요", () => {
    const onSwapCells = vi.fn();
    const { container } = subScreen(0, { onSwapCells });
    reveal('편집');
    reveal('자리 바꾸기');
    fireEvent.click(cell('받아쓰기'));
    expect(container.querySelector('.mg-cell-lifted')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    expect(container.querySelector('.mg-cell-lifted')).toBeNull();
    expect(editingNow()).toBe(false);
    expect(onSwapCells).not.toHaveBeenCalled();
  });
});
