/**
 * 기록 위젯 판 (3.0, plans/3.0-records-widgets-design.md).
 * 판에 보이는 위젯과 순서는 settings.records.widgets — null 이면 기본 배치(아직 고친 적 없음), 숨긴 위젯 = 목록에 없는 것.
 * 위젯마다 대시보드가 하나씩 있고, 1년 잔디(year)만 따로 화면 없이 달력 대시보드를 '년'으로 열어요.
 */

export const RECORD_WIDGET_IDS = ['streak', 'week', 'board', 'calendar', 'badges', 'report', 'score', 'year', 'weekday', 'review', 'total'] as const;

export type RecordWidgetId = (typeof RECORD_WIDGET_IDS)[number];

export interface RecordWidgetInfo {
  id: RecordWidgetId;
  /** 위젯 이름(편집 모드·숨긴 위젯 목록·읽어 주는 이름). calendar 는 판에서 'n월 달력'으로 보여요 */
  name: string;
  /** 넓은 위젯(판 한 줄을 다 써요). 아니면 두 개가 한 줄 */
  wide: boolean;
  /** 눌렀을 때 여는 대시보드의 제목 */
  dashboard: string;
}

export const RECORD_WIDGETS: Record<RecordWidgetId, RecordWidgetInfo> = {
  streak: { id: 'streak', name: '연속', wide: false, dashboard: '연속' },
  week: { id: 'week', name: '이번 주 도장', wide: false, dashboard: '도장' },
  board: { id: 'board', name: '이번 달 만다라트', wide: true, dashboard: '만다라트' },
  calendar: { id: 'calendar', name: '이번 달 달력', wide: true, dashboard: '달력' },
  badges: { id: 'badges', name: '배지', wide: false, dashboard: '배지' },
  report: { id: 'report', name: '지난주 리포트', wide: false, dashboard: '지난주 리포트' },
  score: { id: 'score', name: '꾸준함 점수', wide: false, dashboard: '꾸준함 점수' },
  year: { id: 'year', name: '1년 잔디', wide: true, dashboard: '달력' },
  weekday: { id: 'weekday', name: '요일별 평균', wide: false, dashboard: '요일별 평균' },
  review: { id: 'review', name: '지난달 회고', wide: false, dashboard: '지난달 회고' },
  total: { id: 'total', name: '누적 도장', wide: false, dashboard: '누적 도장' },
};

/** 기본 배치(사용자 2026-10-21 '추천대로'). 나머지(꾸준함 점수·1년 잔디·요일별 평균·지난달 회고·누적 도장)는 숨긴 위젯 */
export const DEFAULT_WIDGETS: readonly RecordWidgetId[] = ['streak', 'week', 'board', 'calendar', 'badges', 'report'];

export function isRecordWidgetId(value: unknown): value is RecordWidgetId {
  return typeof value === 'string' && (RECORD_WIDGET_IDS as readonly string[]).includes(value);
}

/** 저장된 목록을 읽어요. 배열이 아니면 null(기본 배치), 모르는 id·중복은 버리고, 하나도 안 남으면 기본 배치 */
export function normalizeWidgetList(input: unknown): RecordWidgetId[] | null {
  if (!Array.isArray(input)) return null;
  const list = Array.from(new Set(input.filter(isRecordWidgetId)));
  return list.length > 0 ? list : null;
}

/** 판에 보이는 위젯(순서대로) */
export function visibleWidgets(list: readonly RecordWidgetId[] | null): RecordWidgetId[] {
  return list ? [...list] : [...DEFAULT_WIDGETS];
}

/** 숨긴 위젯(목록 순서대로) — 편집 모드 아래 '숨긴 위젯'에 ＋ 로 보여요 */
export function hiddenWidgets(list: readonly RecordWidgetId[] | null): RecordWidgetId[] {
  const visible = new Set(visibleWidgets(list));
  return RECORD_WIDGET_IDS.filter((id) => !visible.has(id));
}

/** 숨기기. 마지막 하나는 숨기지 않아요(판이 비지 않게) */
export function hideWidget(list: readonly RecordWidgetId[] | null, id: RecordWidgetId): RecordWidgetId[] {
  const visible = visibleWidgets(list);
  if (visible.length <= 1 || !visible.includes(id)) return visible;
  return visible.filter((w) => w !== id);
}

/** 다시 넣기: 판 맨 뒤에 */
export function addWidget(list: readonly RecordWidgetId[] | null, id: RecordWidgetId): RecordWidgetId[] {
  const visible = visibleWidgets(list);
  return visible.includes(id) ? visible : [...visible, id];
}

/** 자리 바꾸기: id 를 to 번째(0부터, 범위 밖이면 끝으로 맞춰요)로 */
export function moveWidget(list: readonly RecordWidgetId[] | null, id: RecordWidgetId, to: number): RecordWidgetId[] {
  const visible = visibleWidgets(list);
  const from = visible.indexOf(id);
  if (from < 0) return visible;
  const target = Math.max(0, Math.min(visible.length - 1, Math.round(to)));
  if (target === from) return visible;
  const next = visible.filter((w) => w !== id);
  next.splice(target, 0, id);
  return next;
}

/** 두 목록이 같은 배치인지(null 과 기본 배치는 같아요) */
export function sameWidgets(a: readonly RecordWidgetId[] | null, b: readonly RecordWidgetId[] | null): boolean {
  const x = visibleWidgets(a);
  const y = visibleWidgets(b);
  return x.length === y.length && x.every((id, i) => id === y[i]);
}
