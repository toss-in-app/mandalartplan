import { describe, expect, it } from 'vitest';

import { createDefaultSettings, normalizeSettings } from './state';
import { DEFAULT_WIDGETS, addWidget, hiddenWidgets, hideWidget, moveWidget, normalizeWidgetList, sameWidgets, visibleWidgets } from './widgets';

describe('기록 위젯 판 배치 (3.0)', () => {
  it('null 은 기본 배치 6개, 숨긴 위젯은 나머지 5개(목록 순서)', () => {
    expect(visibleWidgets(null)).toEqual(['streak', 'week', 'board', 'calendar', 'badges', 'report']);
    expect(hiddenWidgets(null)).toEqual(['score', 'year', 'weekday', 'review', 'total']);
    expect(DEFAULT_WIDGETS).toHaveLength(6);
  });

  it('저장된 목록은 모르는 id·중복을 버리고, 배열이 아니거나 비면 기본 배치(null)', () => {
    expect(normalizeWidgetList(['board', 'oops', 'board', 'streak', 3])).toEqual(['board', 'streak']);
    expect(normalizeWidgetList('board')).toBeNull();
    expect(normalizeWidgetList([])).toBeNull();
    expect(normalizeWidgetList(['oops'])).toBeNull();
  });

  it('숨기기·넣기·옮기기 — 마지막 하나는 숨기지 않고, 넣으면 맨 뒤, 옮기기는 범위를 맞춰요', () => {
    expect(hideWidget(null, 'week')).toEqual(['streak', 'board', 'calendar', 'badges', 'report']);
    expect(hideWidget(['board'], 'board')).toEqual(['board']);
    expect(hideWidget(['board', 'week'], 'score')).toEqual(['board', 'week']);
    expect(addWidget(['board'], 'score')).toEqual(['board', 'score']);
    expect(addWidget(['board'], 'board')).toEqual(['board']);
    expect(moveWidget(null, 'report', 0)).toEqual(['report', 'streak', 'week', 'board', 'calendar', 'badges']);
    expect(moveWidget(null, 'streak', 99)).toEqual(['week', 'board', 'calendar', 'badges', 'report', 'streak']);
    expect(moveWidget(null, 'score', 0)).toEqual(visibleWidgets(null));
  });

  it('같은 배치인지: null 과 기본 배치는 같아요', () => {
    expect(sameWidgets(null, [...DEFAULT_WIDGETS])).toBe(true);
    expect(sameWidgets(null, ['week', 'streak', 'board', 'calendar', 'badges', 'report'])).toBe(false);
  });

  it('설정: records 가 없으면 null(기본 배치), 있으면 읽어서 정리해요', () => {
    expect(createDefaultSettings().records).toEqual({ widgets: null });
    expect(normalizeSettings({ version: 1 })?.records).toEqual({ widgets: null });
    expect(normalizeSettings({ version: 1, records: { widgets: ['total', 'nope', 'board'] } })?.records).toEqual({ widgets: ['total', 'board'] });
  });
});
