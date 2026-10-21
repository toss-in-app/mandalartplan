import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { cheerFor, getBundledContent } from '../content';
import { logEvent } from '../lib/analytics';
import { actionIndex, createEmptyBoard, type Board } from '../lib/mandalart';
import { dateKey, type CheckinRecord } from '../lib/state';
import { addDays, weekRange } from '../lib/stats';
import { boardFromTemplate } from '../lib/template';
import { DEFAULT_WIDGETS, type RecordWidgetId } from '../lib/widgets';
import { RecordScreen } from './RecordScreen';
import { RecordsScreen } from './RecordsScreen';

vi.mock('../lib/analytics', () => ({ logEvent: vi.fn() }));
afterEach(() => {
  vi.mocked(logEvent).mockClear();
  vi.useRealTimers();
});

const NOW = 1759000000000;
const content = getBundledContent();
const fullBoard: Board = boardFromTemplate(createEmptyBoard(NOW), content.templates[0], NOW);
const today = dateKey();

/** 오늘까지 n일 동안 날마다 세부 목표 1·2의 첫 실천, 오늘은 세부 목표 1의 실천 두 개 */
function history(days: number): CheckinRecord {
  const map: Record<string, number[]> = {};
  for (let i = days - 1; i >= 1; i -= 1) map[addDays(today, -i)] = [actionIndex(0, 0), actionIndex(1, 0)];
  map[today] = [actionIndex(0, 0), actionIndex(0, 1)];
  return { days: map, lastCompletedAt: NOW };
}

const wrap = (ui: React.ReactElement) => render(<TDSMobileAITProvider brandPrimaryColor="#6B5CFF">{ui}</TDSMobileAITProvider>);

function board(props: Partial<React.ComponentProps<typeof RecordsScreen>> = {}) {
  const onOpen = vi.fn();
  const onChangeWidgets = vi.fn();
  const utils = wrap(<RecordsScreen board={fullBoard} record={history(20)} widgets={null} onChangeWidgets={onChangeWidgets} onOpen={onOpen} onDone={vi.fn()} {...props} />);
  return { ...utils, onOpen, onChangeWidgets };
}

describe('RecordsScreen (기록 위젯 판, 3.0)', () => {
  it('기본 위젯 6개가 버튼이고, 누르면 그 대시보드를 열어요. 평소엔 안내 문구가 없어요', () => {
    const { onOpen } = board();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('기록');
    expect(screen.getByText(/오늘 도장 2개/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^연속 20일, 최고 20일$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^이번 주 도장 / })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^이번 달 만다라트, 가장 많이 한 가지 / })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(`^${Number(today.slice(5, 7))}월 달력, `) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^배지 12개 중 \d+개$/ })).toBeInTheDocument();
    expect(screen.queryByText('끌어서 자리를 바꾸고, − 를 눌러 숨겨요')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^연속 / }));
    expect(onOpen).toHaveBeenCalledWith('streak');
    // 기록이 있으면 맨 아래 배너
    expect(screen.getByTestId('ad-banner')).toBeInTheDocument();
  });

  it('지난주 리포트는 지난주 기록이 없으면 누를 수 없어요(이번 주에 처음 썼으면 다음 월요일)', () => {
    const start = weekRange(today, 0).start;
    board({ record: { days: { [start]: [0] }, lastCompletedAt: NOW } });
    const report = screen.getByRole('group', { name: /^지난주 리포트, 첫 리포트는 / });
    expect(within(report).getByText('한 주를 다 쓰면 나와요')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^지난주 리포트/ })).not.toBeInTheDocument();
  });

  it('기록이 없으면 판 위 한 줄(딥링크면 홈으로), 배너는 없어요. 알림 버튼은 넘겨줄 때만', () => {
    const onDone = vi.fn();
    const onNotification = vi.fn();
    board({ record: undefined, onDone, showHome: true, onNotification });
    expect(screen.getByText('실천에 도장을 찍으면 여기에 기록이 쌓여요')).toBeInTheDocument();
    fireEvent.click(screen.getByText('홈으로'));
    expect(onDone).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('매일 저녁 알림 받기'));
    expect(onNotification).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('ad-banner')).not.toBeInTheDocument();
  });

  it('키보드 입구로 편집 모드: −로 숨기기, ＋로 넣기, 앞으로·뒤로, 끝은 완료 — 편집 중엔 눌러도 열지 않아요', () => {
    const { onOpen, onChangeWidgets } = board();
    fireEvent.click(screen.getByRole('button', { name: '위젯 판 편집' }));
    expect(screen.getByText('끌어서 자리를 바꾸고, − 를 눌러 숨겨요')).toBeInTheDocument();
    expect(logEvent).toHaveBeenCalledWith('edit_mode_enter', { screen: 'records', via: 'button' });
    // 위젯은 버튼이 아니라 묶음이 되고, 숨긴 위젯 5개가 아래에
    expect(screen.queryByRole('button', { name: /^연속 \d+일/ })).not.toBeInTheDocument();
    const tray = screen.getByRole('region', { name: '숨긴 위젯' });
    expect(within(tray).getAllByRole('button')).toHaveLength(5);
    expect(screen.getByTestId('ad-banner').parentElement).toHaveStyle({ display: 'none' });

    fireEvent.click(screen.getByRole('button', { name: '이번 주 도장 숨기기' }));
    expect(onChangeWidgets).toHaveBeenLastCalledWith(DEFAULT_WIDGETS.filter((id) => id !== 'week'));
    expect(logEvent).toHaveBeenCalledWith('record_widget_edit', { action: 'hide', widget: 'week', visible: 5 });
    fireEvent.click(within(tray).getByRole('button', { name: '꾸준함 점수 넣기' }));
    expect(onChangeWidgets).toHaveBeenLastCalledWith([...DEFAULT_WIDGETS, 'score']);
    fireEvent.click(screen.getByRole('button', { name: '연속 뒤로' }));
    expect(onChangeWidgets).toHaveBeenLastCalledWith(['week', 'streak', 'board', 'calendar', 'badges', 'report']);
    expect(screen.queryByRole('button', { name: '연속 앞으로' })).not.toBeInTheDocument(); // 맨 앞

    fireEvent.click(screen.getByRole('group', { name: /^연속 / }));
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('완료'));
    expect(screen.queryByText('끌어서 자리를 바꾸고, − 를 눌러 숨겨요')).not.toBeInTheDocument();
  });

  it('위젯이 하나뿐이면 숨기지 않아요', () => {
    const { onChangeWidgets } = board({ widgets: ['board'] });
    fireEvent.click(screen.getByRole('button', { name: '위젯 판 편집' }));
    const minus = screen.getByRole('button', { name: '이번 달 만다라트 숨기기' });
    expect(minus).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(minus);
    expect(onChangeWidgets).not.toHaveBeenCalled();
  });

  it('길게 누르면 편집 모드가 되고, 그 손가락의 click 으로는 열지 않아요', () => {
    vi.useFakeTimers();
    const { onOpen } = board();
    const widget = screen.getByRole('button', { name: /^연속 / });
    fireEvent.pointerDown(widget, { clientX: 10, clientY: 10, pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText('끌어서 자리를 바꾸고, − 를 눌러 숨겨요')).toBeInTheDocument();
    expect(logEvent).toHaveBeenCalledWith('edit_mode_enter', { screen: 'records', via: 'longpress' });
    fireEvent.pointerUp(screen.getByRole('group', { name: /^연속 / }));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('누르고 바로 떼면 그냥 열어요(길게 누르기 전)', () => {
    vi.useFakeTimers();
    const { onOpen } = board();
    const widget = screen.getByRole('button', { name: /^배지 / });
    fireEvent.pointerDown(widget, { clientX: 10, clientY: 10, pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.pointerUp(widget);
    fireEvent.click(widget);
    expect(onOpen).toHaveBeenCalledWith('badges');
  });
});

/** record = null 이면 기록이 없는 사람 */
function dashboard(widget: RecordWidgetId, record: CheckinRecord | null = history(30)) {
  const onStatsView = vi.fn();
  const onShareReport = vi.fn();
  const onClose = vi.fn();
  const utils = wrap(<RecordScreen widget={widget} board={fullBoard} record={record ?? undefined} content={content} onClose={onClose} onShareReport={onShareReport} onStatsView={onStatsView} />);
  return { ...utils, onStatsView, onShareReport, onClose };
}

describe('RecordScreen (위젯마다 대시보드, 3.0)', () => {
  it('연속: 고리·다음 고비·최근 14일·최고 기록', () => {
    dashboard('streak');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('연속');
    expect(screen.getByRole('img', { name: '지금 30일째 연속, 다음 고비 50일 연속' })).toBeInTheDocument();
    expect(screen.getByText('오늘 도장으로 30일째가 됐어요')).toBeInTheDocument();
    expect(screen.getByText('20일만 더 이으면 50일 연속이에요')).toBeInTheDocument();
    expect(screen.getByText('최근 14일')).toBeInTheDocument();
    expect(screen.getByText(/^30일 · /)).toBeInTheDocument();
    expect(screen.getByTestId('ad-banner')).toBeInTheDocument();
  });

  it('도장: 주·월·년, 지난 기간 옮기기, stats_view', () => {
    const { onStatsView } = dashboard('week');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('도장');
    expect(onStatsView).toHaveBeenLastCalledWith(expect.objectContaining({ widget: 'week', period: 'week', offset: 0 }));
    expect(screen.getByText('이번 주 찍은 도장')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음 주' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '지난주' }));
    expect(onStatsView).toHaveBeenLastCalledWith(expect.objectContaining({ widget: 'week', period: 'week', offset: -1 }));
    expect(screen.getByText('이 주 찍은 도장')).toBeInTheDocument();
    // 기간 고르기가 막대(요일 이름)보다 앞에 있어요
    fireEvent.click(screen.getAllByText('월')[0]);
    expect(onStatsView).toHaveBeenLastCalledWith(expect.objectContaining({ widget: 'week', period: 'month', offset: 0 }));
    expect(screen.getByText('이번 달 찍은 도장')).toBeInTheDocument();
  });

  it('만다라트: 월은 9×9 진하기 — 실천 칸을 누르면 그 실천을 한 날짜가 펼쳐져요. 주는 3×3 차오름', () => {
    dashboard('board');
    expect(screen.getByText('이번 달 만다라트')).toBeInTheDocument();
    const action = fullBoard.subs[0].actions[0];
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${action}, \\d+번$`) }));
    expect(screen.getByText(new RegExp(`^${action} · \\d+번$`), { selector: 'p' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('주')[0]);
    expect(screen.getByRole('img', { name: /^세부 목표마다 도장을 찍은 날: / })).toBeInTheDocument();
  });

  it("달력: 월은 도장 달력, 오늘이 골라져 있어 오늘 한 실천과 응원 한 줄(예전 '오늘' 탭)이 아래에", () => {
    dashboard('calendar');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('달력');
    expect(screen.getByText(new RegExp(` · 오늘 · 도장 2개$`))).toBeInTheDocument();
    expect(screen.getByText(cheerFor(content, today))).toBeInTheDocument();
    expect(screen.getByText(fullBoard.subs[0].actions[1])).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('주')[0]);
    expect(screen.getByText('고리 = 그날 손댄 세부 목표 수(8개 중)')).toBeInTheDocument();
  });

  it('1년 잔디 위젯은 달력을 년으로 열어요', () => {
    const { onStatsView } = dashboard('year');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('달력');
    expect(onStatsView).toHaveBeenLastCalledWith(expect.objectContaining({ widget: 'year', period: 'year', offset: 0 }));
    expect(screen.getByText('지금 연속')).toBeInTheDocument();
    expect(screen.getByText('달마다 찍은 도장')).toBeInTheDocument();
  });

  it('배지: 모은 수와 12개 격자', () => {
    dashboard('badges');
    expect(screen.getByText(/^배지 \d+개를 모았어요$/)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(12);
    expect(screen.getByRole('listitem', { name: /^7일 연속, 받음 / })).toBeInTheDocument();
  });

  it('지난주 리포트: 전체 화면 4장, 다음 장으로 넘기고 마지막 장에서 글로 공유, ✕ 는 닫기', () => {
    const { onShareReport, onClose } = dashboard('report');
    expect(screen.getByText('지난주에')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다음 장' }));
    expect(screen.getByText('가장 많이 한 실천')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다음 장' }));
    fireEvent.click(screen.getByRole('button', { name: '다음 장' }));
    fireEvent.click(screen.getByText('글로 공유하기'));
    expect(onShareReport).toHaveBeenCalledWith(expect.stringContaining('[만다라트] 지난주 리포트'));
    fireEvent.click(screen.getByRole('button', { name: '리포트 닫기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('숨긴 위젯의 대시보드들: 꾸준함 점수·요일별 평균·지난달 회고·누적 도장', () => {
    const record = history(70);
    const { unmount } = dashboard('score', record);
    expect(screen.getByRole('img', { name: /^꾸준함 점수 100점 중 \d+점$/ })).toBeInTheDocument();
    expect(screen.getByText('가지마다 점수')).toBeInTheDocument();
    unmount();
    const weekday = dashboard('weekday', record);
    expect(weekday.onStatsView).toHaveBeenLastCalledWith(expect.objectContaining({ widget: 'weekday', period: '8w' }));
    expect(screen.getByText('요일마다 많이 한 가지')).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('4주')[0]);
    expect(weekday.onStatsView).toHaveBeenLastCalledWith(expect.objectContaining({ widget: 'weekday', period: '4w' }));
    weekday.unmount();
    const review = dashboard('review', record);
    expect(screen.getByText('잘한 실천')).toBeInTheDocument();
    review.unmount();
    dashboard('total', record);
    expect(screen.getByText('지나온 길')).toBeInTheDocument();
    expect(screen.getByText(/^도장 \d+개$/, { selector: 'p' })).toBeInTheDocument();
  });

  it('처음 일주일: 리포트는 링크로 와도 언제 나오는지만, 꾸준함 점수는 지난주와 비교하지 않아요', () => {
    const start = weekRange(today, 0).start;
    const fresh: CheckinRecord = { days: { [start]: [0], [today]: [0, 1] }, lastCompletedAt: NOW };
    const { unmount } = dashboard('report', fresh);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('지난주 리포트');
    expect(screen.getByText(/월요일에 첫 리포트가 나와요$/)).toBeInTheDocument();
    unmount();
    dashboard('score', fresh);
    expect(screen.getByText('도장을 찍을수록 올라가요')).toBeInTheDocument();
  });

  it('기록이 없으면 대시보드마다 한 줄 안내, 배너는 없어요', () => {
    dashboard('total', null);
    expect(screen.getByText('첫 도장을 찍으면 여기서부터 쌓여요')).toBeInTheDocument();
    expect(screen.queryByTestId('ad-banner')).not.toBeInTheDocument();
  });
});
