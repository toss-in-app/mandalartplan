import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getBundledContent } from '../content';
import { logEvent } from '../lib/analytics';
import { TrialScreen } from './TrialScreen';

vi.mock('../lib/analytics', () => ({ logEvent: vi.fn() }));
afterEach(() => vi.mocked(logEvent).mockClear());

const content = getBundledContent();
const sample = content.templates[0].subs[0];

function renderTrial(options: { aiAvailable?: boolean; fresh?: boolean } = {}) {
  const onFinish = vi.fn();
  render(
    <TDSMobileAITProvider brandPrimaryColor="#6B5CFF">
      <TrialScreen content={content} aiAvailable={options.aiAvailable ?? true} fresh={options.fresh ?? true} onFinish={onFinish} />
    </TDSMobileAITProvider>,
  );
  return { onFinish };
}

const nextButton = () => screen.getByRole('button', { name: '다음' });

/** 2단계: 편집 모드로 들어가 첫 실천과 두 번째 실천의 자리를 바꿔요(키보드 입구 — 꾹 눌러 끌기와 같은 동작) */
function swapFirstTwo() {
  fireEvent.click(screen.getByRole('button', { name: '편집' }));
  fireEvent.click(screen.getByRole('button', { name: '자리 바꾸기' }));
  fireEvent.click(screen.getByRole('button', { name: sample.actions[0] }));
  fireEvent.click(screen.getByRole('button', { name: sample.actions[1] }));
}

/** 도장 → 옮기기까지 하고 3단계(편집)로 */
function toEditStep() {
  fireEvent.click(screen.getByRole('button', { name: `${sample.actions[0]}, 오늘 아직` }));
  fireEvent.click(nextButton());
  swapFirstTwo();
  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  fireEvent.click(nextButton());
}

/** 편집 모드로 들어가 첫 실천을 골라 지워요(키보드 입구 — 길게 누르기·끌기와 같은 동작) */
async function deleteFirstAction() {
  fireEvent.click(screen.getByRole('button', { name: '편집' }));
  fireEvent.click(screen.getByRole('button', { name: '지울 칸 고르기' }));
  fireEvent.click(screen.getByRole('button', { name: sample.actions[0] }));
  fireEvent.click(screen.getByRole('button', { name: '1칸 삭제' }));
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '삭제' }));
}

describe('TrialScreen (1분 체험판, 2.1)', () => {
  it("1단계 도장: 실천을 눌러 '완료' 도장을 찍어야 '다음'이 켜져요", () => {
    renderTrial();
    expect(screen.getByText('체험판 · 저장되지 않아요 · 1/4')).toBeInTheDocument();
    expect(screen.getByText("오늘 한 실천을 눌러 '완료' 도장을 찍어 보세요")).toBeInTheDocument();
    expect(nextButton()).toBeDisabled();
    const action = screen.getByRole('button', { name: `${sample.actions[0]}, 오늘 아직` });
    fireEvent.click(action);
    expect(screen.getByRole('button', { name: `${sample.actions[0]}, 오늘 했어요` })).toHaveClass('mg-cell-done');
    expect(screen.getByText('잘했어요! 다시 누르면 도장이 들려요')).toBeInTheDocument();
    expect(nextButton()).toBeEnabled();
  });

  it("2단계 옮기기(3.0): 꾹 눌러 끌기와 같은 키보드 입구로 두 실천의 자리를 바꾸면 '다음'이 켜지고, 도장은 글을 따라가요", () => {
    renderTrial();
    fireEvent.click(screen.getByRole('button', { name: `${sample.actions[0]}, 오늘 아직` }));
    fireEvent.click(nextButton());
    expect(screen.getByText('체험판 · 저장되지 않아요 · 2/4')).toBeInTheDocument();
    expect(screen.getByText('칸을 꾹 누른 채 끌어 다른 칸 위에 놓아 보세요. 두 칸의 자리가 바뀌어요')).toBeInTheDocument();
    expect(nextButton()).toBeDisabled();
    swapFirstTwo();
    expect(screen.getByText('잘했어요! 홈에서 세부 목표를 옮기면 그 아래 실천도 함께 가요')).toBeInTheDocument();
    expect(nextButton()).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    // 자리가 바뀌고, 1단계에서 찍은 도장은 그 글(이제 두 번째 칸)을 따라가요
    const cells = screen.getAllByRole('button', { name: /오늘 (아직|했어요)$/ });
    expect(cells.slice(0, 2).map((el) => el.getAttribute('aria-label'))).toEqual([`${sample.actions[1]}, 오늘 아직`, `${sample.actions[0]}, 오늘 했어요`]);
    expect(screen.getByRole('button', { name: `${sample.actions[0]}, 오늘 했어요` })).toHaveClass('mg-cell-done');
    // 체험판 판은 내 판이 아니라 자리 바꾸기 기록(cells_swap)을 남기지 않아요
    expect(vi.mocked(logEvent).mock.calls.map(([name]) => name)).not.toContain('cells_swap');
  });

  it("3단계 편집: 편집 모드에서 골라 지우면 '되돌리기' 안내와 함께 '다음'이 켜지고, 되돌리면 글이 돌아와요", async () => {
    renderTrial();
    toEditStep();
    expect(screen.getByText('체험판 · 저장되지 않아요 · 3/4')).toBeInTheDocument();
    expect(screen.getByText('편집 모드에서 칸을 쭉 끌어 지울 칸을 골라 삭제해 보세요. 편집 모드는 칸을 길게 누르면 돼요')).toBeInTheDocument();
    expect(nextButton()).toBeDisabled();
    await deleteFirstAction();
    expect(await screen.findByText("지운 칸은 아래 토스트의 '되돌리기'로 살릴 수 있어요")).toBeInTheDocument();
    expect(nextButton()).toBeEnabled();
    expect(screen.queryByRole('button', { name: sample.actions[0] })).not.toBeInTheDocument();
    fireEvent.click((await screen.findAllByText('되돌리기'))[0]);
    expect(await screen.findByRole('button', { name: sample.actions[0] })).toBeInTheDocument();
    // 편집 모드 분석 이벤트는 체험판으로 따로 남아요
    expect(logEvent).toHaveBeenCalledWith('edit_mode_enter', { screen: 'trial', via: 'button' });
    // 체험판 판은 내 판이 아니라 체크·편집 기록(action_check·board_edit·cells_delete)을 남기지 않아요
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    const events = vi.mocked(logEvent).mock.calls.map(([name]) => name);
    expect(events).not.toContain('action_check');
    expect(events).not.toContain('board_edit');
    expect(events).not.toContain('cells_delete');
  });

  it("4단계 AI: 'AI 초안' 예시 판을 보여 주고, '내 만다라트 시작하기'로 끝내요(광고·서버 없음)", async () => {
    const { onFinish } = renderTrial();
    toEditStep();
    await deleteFirstAction();
    await waitFor(() => expect(nextButton()).toBeEnabled());
    expect(screen.getAllByText('되돌리기').length).toBeGreaterThan(0);
    fireEvent.click(nextButton());
    expect(screen.getByText('체험판 · 저장되지 않아요 · 4/4')).toBeInTheDocument();
    // 3단계 '되돌리기' 토스트는 4단계까지 따라오지 않아요(마지막 버튼을 가려요)
    await waitFor(() => expect(screen.queryAllByText('되돌리기')).toHaveLength(0), { timeout: 3000 });
    expect(screen.getByText('AI 초안')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(content.templates[1].goal);
    fireEvent.click(screen.getByRole('button', { name: '내 만다라트 시작하기' }));
    expect(onFinish).toHaveBeenCalledWith(4);
  });

  it("AI 를 쓸 수 없는 기기는 3단계에서 끝나고, 이미 쓰던 사람은 '내 만다라트로 돌아가기'", async () => {
    const { onFinish } = renderTrial({ aiAvailable: false, fresh: false });
    expect(screen.getByText('체험판 · 저장되지 않아요 · 1/3')).toBeInTheDocument();
    toEditStep();
    await deleteFirstAction();
    const finish = await screen.findByRole('button', { name: '내 만다라트로 돌아가기' });
    fireEvent.click(finish);
    expect(onFinish).toHaveBeenCalledWith(3);
  });
});
