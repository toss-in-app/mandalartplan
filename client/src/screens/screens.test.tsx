import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { cheerFor, getBundledContent } from '../content';
import { actionIndex, cellOfRing, createEmptyBoard, type Board } from '../lib/mandalart';
import { dateKey, type CheckinRecord } from '../lib/state';
import { addDays } from '../lib/stats';
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

/** 칸 편집 시트 안의 '완료' (화면 아래 '완료' 와 구분) */
function sheetDone() {
  let node: HTMLElement | null = document.getElementById('mandalart-cell-editor');
  while (node && !within(node).queryByText('완료')) node = node.parentElement;
  return within(node!).getByText('완료');
}

const wrap = (ui: React.ReactElement) => render(<TDSMobileAITProvider brandPrimaryColor="#6B5CFF">{ui}</TDSMobileAITProvider>);

describe('OverviewScreen (9×9 전체 보기)', () => {
  it('둘레 블록 8개만 버튼이고 세부 목표로 가요. 가운데 블록은 누를 수 없고, 공유는 오른쪽 위', () => {
    const onSelectSub = vi.fn();
    const onShare = vi.fn();
    wrap(<OverviewScreen board={fullBoard} checkin={record} onSelectSub={onSelectSub} onShare={onShare} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('전체 보기');
    expect(screen.getAllByRole('button', { name: / 열기(, 오늘 \d+개 했어요)?$/ })).toHaveLength(8);
    expect(screen.queryByRole('button', { name: /핵심 목표와 세부 목표/ })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: '핵심 목표와 세부 목표' })).toBeInTheDocument();
    // 블록 이름에 제목과 오늘 체크 수가 들어가요 (안의 글은 aria-label 에 가려져요)
    expect(screen.getByRole('button', { name: `${fullBoard.subs[0].title}, 세부 목표 1 열기, 오늘 2개 했어요` })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /세부 목표 3 열기$/ }));
    expect(onSelectSub).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByText('공유'));
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('세부 목표의 실천을 오늘 다 하면 블록 이름의 체크 수는 실천만 세요(가운데 칸은 안 세요)', () => {
    const all: CheckinRecord = { days: { [today]: Array.from({ length: 8 }, (_, a) => actionIndex(0, a)) }, lastCompletedAt: NOW };
    wrap(<OverviewScreen board={fullBoard} checkin={all} onSelectSub={vi.fn()} onShare={vi.fn()} />);
    expect(screen.getByRole('button', { name: `${fullBoard.subs[0].title}, 세부 목표 1 열기, 오늘 8개 했어요` })).toBeInTheDocument();
  });
});

describe('BlockScreen (편집: 칸을 눌러 바텀시트에서 적기)', () => {
  const sheetInput = (placeholder: string) => screen.getByPlaceholderText(placeholder) as HTMLTextAreaElement;
  /** 시트 제목에 들어가는 칸 이름(16자 넘으면 줄임) */
  const titleName = (text: string) => (text.trim().length > 16 ? `${text.trim().slice(0, 15)}…` : text.trim());

  it('가운데 블록: 처음엔 입력칸이 없고, 칸을 누르면 그 칸의 입력창이 떠요. 완료를 눌러야 반영돼요', async () => {
    const onChangeGoal = vi.fn();
    const onChangeSubTitle = vi.fn();
    const onDone = vi.fn();
    wrap(<BlockScreen board={fullBoard} block={4} onChangeGoal={onChangeGoal} onChangeSubTitle={onChangeSubTitle} onChangeAction={vi.fn()} onDone={onDone} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('핵심 목표와 세부 목표');
    expect(screen.queryByPlaceholderText('예: 올해 안에 책 한 권 쓰기')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: fullBoard.goal }));
    const goal = sheetInput('예: 올해 안에 책 한 권 쓰기');
    expect(goal.value).toBe(fullBoard.goal);
    expect(goal.maxLength).toBe(40);
    expect(document.activeElement).toBe(goal); // 누른 순간 포커스 → 키보드
    expect(goal.selectionStart).toBe(fullBoard.goal.length); // 커서는 글 끝
    expect(screen.getByText('어떤 목표를 이루고 싶나요?')).toBeInTheDocument(); // 질문형 제목
    fireEvent.change(goal, { target: { value: '  새\n목표 ' } }); // 붙여넣은 줄바꿈은 공백으로
    expect(onChangeGoal).not.toHaveBeenCalled(); // 적는 중에는 반영하지 않아요
    fireEvent.click(sheetDone());
    expect(onChangeGoal).toHaveBeenCalledWith('새 목표'); // 줄바꿈은 공백, 앞뒤 공백은 지워요
    await waitFor(() => expect(screen.queryByPlaceholderText('예: 올해 안에 책 한 권 쓰기')).not.toBeInTheDocument());

    // 세부 목표 칸: 시트 제목은 칸 이름, 부제는 핵심 목표. 키보드 '완료'(Enter)로도 반영
    fireEvent.click(screen.getByRole('button', { name: fullBoard.subs[2].title }));
    expect(screen.getByText('세부 목표 3')).toBeInTheDocument();
    expect(screen.getByText(`${titleName(fullBoard.goal)} 칸의 세부 목표는 무엇인가요?`)).toBeInTheDocument();
    const third = sheetInput('예: 꾸준한 운동');
    fireEvent.change(third, { target: { value: '세 번째' } });
    fireEvent.keyDown(third, { key: 'Enter' });
    expect(onChangeSubTitle).toHaveBeenCalledWith(2, '세 번째');
    await waitFor(() => expect(screen.queryByPlaceholderText('예: 꾸준한 운동')).not.toBeInTheDocument());

    fireEvent.click(screen.getByText('완료'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('질문에 위 칸의 이름이 들어가요: 핵심 목표가 \'자격증 따기\' 면 \'자격증 따기 칸의 세부 목표는 무엇인가요?\'', () => {
    const board = createEmptyBoard(NOW);
    board.goal = '자격증 따기';
    const { unmount } = wrap(<BlockScreen board={board} block={4} onChangeGoal={vi.fn()} onChangeSubTitle={vi.fn()} onChangeAction={vi.fn()} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '세부 목표 1' }));
    expect(screen.getByText('자격증 따기 칸의 세부 목표는 무엇인가요?')).toBeInTheDocument();
    unmount();
    // 세부 목표 블록의 실천 칸: 세부 목표 이름이 비어 있으면 '세부 목표 n' 으로
    wrap(<BlockScreen board={board} block={cellOfRing(1)} initialCell={cellOfRing(0)} onChangeGoal={vi.fn()} onChangeSubTitle={vi.fn()} onChangeAction={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByText('세부 목표 2 칸의 실천은 무엇인가요?')).toBeInTheDocument();
  });

  it('핵심 목표가 비어 있으면 세부 목표 질문은 일반 문장이에요', () => {
    wrap(<BlockScreen board={createEmptyBoard(NOW)} block={4} initialCell={cellOfRing(0)} onChangeGoal={vi.fn()} onChangeSubTitle={vi.fn()} onChangeAction={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByText('목표를 이루려면 무엇이 필요할까요?')).toBeInTheDocument();
  });

  it('한글을 조합하는 중의 Enter 는 반영하지 않아요', () => {
    const onChangeGoal = vi.fn();
    wrap(<BlockScreen board={fullBoard} block={4} onChangeGoal={onChangeGoal} onChangeSubTitle={vi.fn()} onChangeAction={vi.fn()} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: fullBoard.goal }));
    const goal = sheetInput('예: 올해 안에 책 한 권 쓰기');
    fireEvent.change(goal, { target: { value: '새 목ㅍ' } });
    fireEvent.keyDown(goal, { key: 'Enter', isComposing: true });
    expect(onChangeGoal).not.toHaveBeenCalled();
  });

  it('둘레 블록: 실천 칸을 눌러 적고 완료하면 그 칸에만 반영돼요', () => {
    const onChangeAction = vi.fn();
    wrap(<BlockScreen board={fullBoard} block={0} onChangeGoal={vi.fn()} onChangeSubTitle={vi.fn()} onChangeAction={onChangeAction} onDone={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(fullBoard.subs[0].title);
    fireEvent.click(screen.getByRole('button', { name: fullBoard.subs[0].actions[7] }));
    expect(screen.getByText('실천 8')).toBeInTheDocument();
    expect(screen.getByText(`${titleName(fullBoard.subs[0].title)} 칸의 실천은 무엇인가요?`)).toBeInTheDocument();
    const action = sheetInput('예: 아침 스트레칭 10분');
    expect(action.value).toBe(fullBoard.subs[0].actions[7]);
    fireEvent.change(action, { target: { value: '바꾼 실천' } });
    fireEvent.click(sheetDone());
    expect(onChangeAction).toHaveBeenCalledTimes(1);
    expect(onChangeAction).toHaveBeenCalledWith(0, 7, '바꾼 실천');
  });

  it('세부 목표 화면에서 빈 칸을 눌러 왔으면(initialCell) 그 칸 입력창이 바로 열려요', () => {
    const board = createEmptyBoard(NOW);
    board.subs[1].title = '독서';
    wrap(<BlockScreen board={board} block={cellOfRing(1)} initialCell={cellOfRing(2)} onChangeGoal={vi.fn()} onChangeSubTitle={vi.fn()} onChangeAction={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByText('실천 3')).toBeInTheDocument();
    expect(sheetInput('예: 아침 스트레칭 10분').value).toBe('');
  });
});

describe('SubScreen (세부 목표 3×3, 탭 = 오늘 체크)', () => {
  it('글이 있는 실천 칸은 체크 토글, 가운데(세부 목표)는 누를 수 없고 편집은 오른쪽 위 버튼. 오늘 체크한 칸은 aria-pressed', () => {
    const onToggle = vi.fn();
    const onEdit = vi.fn();
    wrap(<SubScreen board={fullBoard} subIndex={0} checkin={record} onToggle={onToggle} onEdit={onEdit} onChangeAction={vi.fn()} />);
    const sub = fullBoard.subs[0];
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(sub.title);
    expect(screen.getByText(/오늘 2\/8/)).toBeInTheDocument();
    const checked = screen.getByRole('button', { name: `${sub.actions[0]}, 오늘 했어요` });
    expect(checked).toHaveAttribute('aria-pressed', 'true');
    const unchecked = screen.getByRole('button', { name: `${sub.actions[2]}, 오늘 아직` });
    expect(unchecked).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(unchecked);
    expect(onToggle).toHaveBeenCalledWith(actionIndex(0, 2));
    expect(screen.queryByRole('button', { name: sub.title })).not.toBeInTheDocument();
    expect(screen.getAllByText(sub.title).length).toBeGreaterThanOrEqual(2); // 제목 + 가운데 이름표
    fireEvent.click(screen.getByText('편집'));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(); // 버튼은 칸 없이
  });

  it('실천 8개를 오늘 다 체크하면 안내가 바뀌고 가운데 이름표에 체크 표시가 붙어요', () => {
    const all: CheckinRecord = { days: { [today]: Array.from({ length: 8 }, (_, a) => actionIndex(0, a)) }, lastCompletedAt: NOW };
    const { container } = wrap(<SubScreen board={fullBoard} subIndex={0} checkin={all} onToggle={vi.fn()} onEdit={vi.fn()} onChangeAction={vi.fn()} />);
    expect(screen.getByText(/오늘 8\/8 · 오늘 실천을 다 했어요/)).toBeInTheDocument();
    // 가운데(5번째 칸)는 버튼이 아닌 span 이고 체크 표시를 품어요
    const cells = container.querySelectorAll('.mg-block-main > .mg-cell');
    expect(cells).toHaveLength(9);
    expect(cells[4].tagName).toBe('SPAN');
    expect(cells[4].querySelector('.mg-cell-check')).not.toBeNull();
  });

  it('빈 실천 칸을 누르면 그 자리에서 시트로 적어요 (체크할 글이 없으니까)', () => {
    const onToggle = vi.fn();
    const onEdit = vi.fn();
    const board = createEmptyBoard(NOW);
    board.subs[1].title = '독서';
    const onChangeAction = vi.fn();
    wrap(<SubScreen board={board} subIndex={1} checkin={undefined} onToggle={onToggle} onEdit={onEdit} onChangeAction={onChangeAction} />);
    expect(screen.getByText('실천 항목을 적어 보세요')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '실천 1' }));
    expect(screen.getByText('독서 칸의 실천은 무엇인가요?')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('예: 아침 스트레칭 10분'), { target: { value: '책 20쪽 읽기' } });
    fireEvent.click(sheetDone());
    expect(onChangeAction).toHaveBeenCalledWith(1, 0, '책 20쪽 읽기');
    expect(onEdit).not.toHaveBeenCalled();
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('TodayScreen (기록)', () => {
  it('오늘 체크가 없으면 안내만 — 홈으로 버튼은 딥링크(히스토리 바닥)일 때만, 기록이 없으면 배너도 없어요', () => {
    const onDone = vi.fn();
    const { unmount } = wrap(<TodayScreen board={fullBoard} record={undefined} content={content} onDone={onDone} />);
    expect(screen.getByText('오늘 한 실천을 체크해 보세요')).toBeInTheDocument();
    expect(screen.queryByText('홈으로')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ad-banner')).not.toBeInTheDocument();
    unmount();
    wrap(<TodayScreen board={fullBoard} record={undefined} content={content} onDone={onDone} showHome />);
    fireEvent.click(screen.getByText('홈으로'));
    expect(onDone).toHaveBeenCalledTimes(1);
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

  it('주간·월간 탭: 요약·세부 목표별·달력, 기간 이동, stats_view, 배너는 탭을 바꿔도 그대로', () => {
    const onStatsView = vi.fn();
    const twoWeeksAgo = addDays(today, -14);
    const history: CheckinRecord = { days: { ...record.days, [twoWeeksAgo]: [actionIndex(1, 0)] }, lastCompletedAt: NOW };
    wrap(<TodayScreen board={fullBoard} record={history} content={content} onDone={vi.fn()} onStatsView={onStatsView} />);
    const banner = screen.getByTestId('ad-banner');

    fireEvent.click(screen.getByText('주간'));
    expect(onStatsView).toHaveBeenLastCalledWith({ period: 'week', offset: 0, activeDays: 1, checks: 2 });
    expect(screen.getByText('실천한 날')).toBeInTheDocument();
    expect(screen.getByText('세부 목표별')).toBeInTheDocument();
    expect(screen.getByText(fullBoard.subs[0].actions[0])).toBeInTheDocument(); // 많이 한 실천
    expect(screen.getByText('이번 주에 안 한 실천')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음 주' })).toBeDisabled();
    expect(screen.getByTestId('ad-banner')).toBe(banner);

    // 지난주는 체크가 없어서 안내 한 줄
    fireEvent.click(screen.getByRole('button', { name: '지난주' }));
    expect(onStatsView).toHaveBeenLastCalledWith({ period: 'week', offset: -1, activeDays: 0, checks: 0 });
    expect(screen.getByText('이 기간은 쉬어 갔어요')).toBeInTheDocument();

    fireEvent.click(screen.getByText('월간'));
    expect(onStatsView).toHaveBeenLastCalledWith(expect.objectContaining({ period: 'month', offset: 0 }));
    expect(screen.getByRole('img', { name: /달력/ })).toBeInTheDocument();
    expect(screen.getByTestId('ad-banner')).toBe(banner);
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
