import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { cheerFor, getBundledContent } from '../content';
import { actionIndex, createEmptyBoard, type Board } from '../lib/mandalart';
import { dateKey, type CheckinRecord } from '../lib/state';
import { boardFromTemplate } from '../lib/template';
import { BlockScreen } from './BlockScreen';
import { OverviewScreen } from './OverviewScreen';
import { SettingsScreen } from './SettingsScreen';
import { SubScreen } from './SubScreen';
import { TodayScreen } from './TodayScreen';

const NOW = 1759000000000;
const content = getBundledContent();
/** 예시 템플릿으로 73칸을 채운 판 (샘플 콘텐츠 기준 렌더) */
const fullBoard: Board = boardFromTemplate(createEmptyBoard(NOW), content.templates[0], NOW);
const today = dateKey();
const record: CheckinRecord = { days: { [today]: [actionIndex(0, 0), actionIndex(0, 1)] }, lastCompletedAt: NOW };

const wrap = (ui: React.ReactElement) => render(<TDSMobileAITProvider brandPrimaryColor="#6B5CFF">{ui}</TDSMobileAITProvider>);

describe('OverviewScreen (9×9 전체 보기)', () => {
  it('블록 9개가 버튼이고, 둘레 블록은 세부 목표로·가운데는 편집으로 가요', () => {
    const onSelectSub = vi.fn();
    const onEditCore = vi.fn();
    wrap(<OverviewScreen board={fullBoard} checkin={record} onSelectSub={onSelectSub} onEditCore={onEditCore} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('전체 보기');
    expect(screen.getAllByRole('button', { name: /열기$/ })).toHaveLength(9);
    fireEvent.click(screen.getByRole('button', { name: '세부 목표 3 열기' }));
    expect(onSelectSub).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole('button', { name: '핵심 목표와 세부 목표 열기' }));
    expect(onEditCore).toHaveBeenCalledTimes(1);
  });
});

describe('BlockScreen (편집 폼)', () => {
  it('가운데 블록은 핵심 목표 1 + 세부 목표 8 입력이고, 바꾸면 바로 저장 콜백이 와요', () => {
    const onChangeGoal = vi.fn();
    const onChangeSubTitle = vi.fn();
    const onDone = vi.fn();
    wrap(<BlockScreen board={fullBoard} block={4} onChangeGoal={onChangeGoal} onChangeSubTitle={onChangeSubTitle} onChangeAction={vi.fn()} onDone={onDone} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('핵심 목표와 세부 목표');
    const goal = screen.getByPlaceholderText('예: 올해 안에 책 한 권 쓰기') as HTMLInputElement;
    expect(goal.value).toBe(fullBoard.goal);
    expect(goal.maxLength).toBe(40);
    expect(screen.getAllByPlaceholderText('핵심 목표를 이루는 데 필요한 것')).toHaveLength(8);
    fireEvent.change(goal, { target: { value: '새 목표' } });
    expect(onChangeGoal).toHaveBeenCalledWith('새 목표');
    fireEvent.change(screen.getAllByPlaceholderText('핵심 목표를 이루는 데 필요한 것')[2], { target: { value: '세 번째' } });
    expect(onChangeSubTitle).toHaveBeenCalledWith(2, '세 번째');
    fireEvent.click(screen.getByText('완료'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('둘레 블록은 세부 목표 1 + 실천 8 입력이에요', () => {
    const onChangeAction = vi.fn();
    wrap(<BlockScreen board={fullBoard} block={0} onChangeGoal={vi.fn()} onChangeSubTitle={vi.fn()} onChangeAction={onChangeAction} onDone={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(fullBoard.subs[0].title);
    const actions = screen.getAllByPlaceholderText('구체적인 행동 한 가지') as HTMLInputElement[];
    expect(actions).toHaveLength(8);
    expect(actions[7].value).toBe(fullBoard.subs[0].actions[7]);
    fireEvent.change(actions[7], { target: { value: '바꾼 실천' } });
    expect(onChangeAction).toHaveBeenCalledWith(0, 7, '바꾼 실천');
  });
});

describe('SubScreen (세부 목표 3×3, 탭 = 오늘 체크)', () => {
  it('글이 있는 실천 칸은 체크 토글, 가운데(세부 목표)는 편집으로 가요. 오늘 체크한 칸은 aria-pressed', () => {
    const onToggle = vi.fn();
    const onEdit = vi.fn();
    wrap(<SubScreen board={fullBoard} subIndex={0} checkin={record} onToggle={onToggle} onEdit={onEdit} />);
    const sub = fullBoard.subs[0];
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(sub.title);
    expect(screen.getByText(/오늘 2\/8/)).toBeInTheDocument();
    const checked = screen.getByRole('button', { name: `${sub.actions[0]}, 오늘 했어요` });
    expect(checked).toHaveAttribute('aria-pressed', 'true');
    const unchecked = screen.getByRole('button', { name: `${sub.actions[2]}, 오늘 아직` });
    expect(unchecked).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(unchecked);
    expect(onToggle).toHaveBeenCalledWith(actionIndex(0, 2));
    fireEvent.click(screen.getByRole('button', { name: sub.title }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('편집'));
    expect(onEdit).toHaveBeenCalledTimes(2);
  });

  it('빈 실천 칸을 누르면 편집으로 가요 (체크할 글이 없으니까)', () => {
    const onToggle = vi.fn();
    const onEdit = vi.fn();
    const board = createEmptyBoard(NOW);
    board.subs[1].title = '독서';
    wrap(<SubScreen board={board} subIndex={1} checkin={undefined} onToggle={onToggle} onEdit={onEdit} />);
    expect(screen.getByText('실천 항목을 적어 보세요')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '실천 1' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('TodayScreen (오늘 기록)', () => {
  it('오늘 체크가 없으면 Result 안내와 홈으로 버튼만 있어요 (광고 없음)', () => {
    const onDone = vi.fn();
    wrap(<TodayScreen board={fullBoard} record={undefined} content={content} onDone={onDone} />);
    expect(screen.getByText('아직 오늘 한 실천이 없어요')).toBeInTheDocument();
    fireEvent.click(screen.getByText('홈으로'));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('ad-banner')).not.toBeInTheDocument();
  });

  it('체크가 있으면 세부 목표별 목록 + 격려 문구 + 알림 버튼(있을 때) + 하단 배너 자리', () => {
    const onNotification = vi.fn();
    wrap(<TodayScreen board={fullBoard} record={record} content={content} onNotification={onNotification} onDone={vi.fn()} />);
    expect(screen.getByText(/1일째 · 2개 실천/)).toBeInTheDocument();
    expect(screen.getByText(fullBoard.subs[0].actions[0])).toBeInTheDocument();
    expect(screen.getByText(fullBoard.subs[0].actions[1])).toBeInTheDocument();
    expect(screen.queryByText(fullBoard.subs[0].actions[2])).not.toBeInTheDocument(); // 체크 안 한 실천은 없어요
    expect(screen.getByText(cheerFor(content, today))).toBeInTheDocument(); // 같은 날은 같은 격려 문구
    fireEvent.click(screen.getByText('매일 저녁 알림 받기'));
    expect(onNotification).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ad-banner')).toBeInTheDocument();
  });
});

describe('SettingsScreen (설정 행 상태)', () => {
  const backupOff = { configured: true, enabled: false, busy: false, lastBackupAt: null, onEnable: vi.fn(), onBackupNow: vi.fn(), onRestore: vi.fn(), onDisable: vi.fn() };
  const extraLocked = { unlocked: false, count: 1, busy: false, onUnlock: vi.fn(), onAdd: vi.fn() };

  it('알림 미지원·백업 미설정이면 준비 중, 글이 없으면 초기화가 잠겨요', () => {
    wrap(
      <SettingsScreen
        content={content}
        notification="unknown"
        notificationAvailable={false}
        onNotification={vi.fn()}
        hasAnyText={false}
        extraBoard={extraLocked}
        backup={{ ...backupOff, configured: false }}
        onPickTemplate={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getAllByText('준비 중')).toHaveLength(2); // 알림 · 서버 백업
    expect(screen.getByText('처음부터 다시 만들기').closest('[aria-disabled="true"], button[disabled], [disabled]') ?? screen.getByText('처음부터 다시 만들기')).toBeInTheDocument();
    expect(screen.getByText(/앱 \d+\.\d+\.\d+ · 콘텐츠 \d+/)).toBeInTheDocument();
    expect(screen.getByText('이용약관')).toBeInTheDocument();
    expect(screen.getByText('개인정보처리방침')).toBeInTheDocument();
  });

  it('백업이 켜져 있으면 마지막 백업·지금 백업·복원·끄기 행이 보이고 각 콜백이 와요', () => {
    const backupOn = { ...backupOff, enabled: true, lastBackupAt: NOW };
    const onReset = vi.fn();
    wrap(
      <SettingsScreen
        content={content}
        notification="agreed"
        notificationAvailable
        onNotification={vi.fn()}
        hasAnyText
        extraBoard={extraLocked}
        backup={backupOn}
        onPickTemplate={vi.fn()}
        onReset={onReset}
      />,
    );
    expect(screen.getByText('받는 중')).toBeInTheDocument();
    expect(screen.getByText('마지막 백업')).toBeInTheDocument();
    fireEvent.click(screen.getByText('지금 백업하기'));
    fireEvent.click(screen.getByText('서버에서 복원하기'));
    fireEvent.click(screen.getByText('백업 끄고 서버 데이터 지우기'));
    expect(backupOn.onBackupNow).toHaveBeenCalledTimes(1);
    expect(backupOn.onRestore).toHaveBeenCalledTimes(1);
    expect(backupOn.onDisable).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('처음부터 다시 만들기'));
    expect(onReset).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('두 번째 만다라트 판'));
    expect(extraLocked.onUnlock).toHaveBeenCalledTimes(1);
  });
});
