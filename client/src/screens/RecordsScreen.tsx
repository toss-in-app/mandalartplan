import { colors } from '@toss/tds-colors';
import { Button, Text, Top } from '@toss/tds-mobile';
import { useEffect, useState } from 'react';

import { AD_GROUPS } from '../ads/config';
import { AdBanner } from '../components/AdBanner';
import { EditDoneButton } from '../components/EditDoneButton';
import type { RecordContext } from '../components/records/shared';
import { describeWidget } from '../components/records/widgetViews';
import { MotionContext } from '../components/records/motion';
import '../components/records/records.css';
import { useWidgetEdit } from '../hooks/useWidgetEdit';
import { formatDateLabel } from '../lib/checkin';
import type { Board } from '../lib/mandalart';
import { checksOn } from '../lib/records';
import { dateKey, type CheckinRecord } from '../lib/state';
import { weekdayLabel } from '../lib/stats';
import { RECORD_WIDGETS, type RecordWidgetId } from '../lib/widgets';

interface RecordsScreenProps {
  board: Board;
  record: CheckinRecord | undefined;
  /** 저장된 위젯 배치(null = 기본) */
  widgets: RecordWidgetId[] | null;
  onChangeWidgets: (next: RecordWidgetId[]) => void;
  /** 위젯을 눌러 그 대시보드로 */
  onOpen: (widget: RecordWidgetId) => void;
  /** 알림을 아직 정하지 않았고 첫 체크 뒤일 때만 — 위에 '매일 저녁 알림 받기' */
  onNotification?: () => void;
  onDone: () => void;
  /** 딥링크로 바로 들어와 뒤로가기가 종료일 때만, 기록이 없을 때 '홈으로' */
  showHome?: boolean;
}

/**
 * 기록 위젯 판 (3.0, 홈 '기록 보기' · 딥링크 `today`, 사용자 2026-10-21 G5 채택).
 * 위젯을 누르면 그 대시보드(`#/record/<위젯>`), 길게 누르면 편집 모드(hooks/useWidgetEdit) — 끌어서 자리 바꾸기, − 숨기기, ＋ 넣기.
 * 평소엔 안내 문구가 없어요(사용자 2026-10-21). 배너 1개는 맨 아래 — 체크 기록이 있을 때만, 편집 모드에선 숨겨요(끄는 손가락이 광고를 누르지 않게, 다시 불러오지는 않아요).
 */
export function RecordsScreen({ board, record, widgets, onChangeWidgets, onOpen, onNotification, onDone, showHome = false }: RecordsScreenProps) {
  const today = dateKey();
  const edit = useWidgetEdit({ widgets, onChange: onChangeWidgets });
  const ctx: RecordContext = { board, record, today };
  const hasHistory = record !== undefined && Object.values(record.days).some((list) => list.length > 0);
  const todayCount = checksOn(record, today).length;
  // 판을 열 때 한 번만 차올라요. 다 찬 뒤나 편집 모드에선 다시 그려도 움직이지 않게(.rc-still)
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), 2200);
    return () => window.clearTimeout(timer);
  }, []);
  const still = settled || edit.editing;

  return (
    <>
      <Top
        title={<Top.TitleParagraph size={22}>기록</Top.TitleParagraph>}
        subtitleBottom={
          <Top.SubtitleParagraph size={17}>
            {formatDateLabel(today)} {weekdayLabel(today)}요일 · 오늘 도장 {todayCount}개
          </Top.SubtitleParagraph>
        }
        right={<EditDoneButton editing={edit.editing} onClick={edit.exit} />}
      />
      <p className="rc-hint" aria-live="polite">
        {edit.hint}
      </p>

      {!hasHistory && !edit.editing && (
        <div className="rc-empty">
          <Text typography="t6" color={colors.grey700} display="block">
            실천에 도장을 찍으면 여기에 기록이 쌓여요
          </Text>
          {showHome && (
            <div style={{ marginTop: 14 }}>
              <Button size="medium" color="dark" variant="weak" onClick={onDone}>
                홈으로
              </Button>
            </div>
          )}
        </div>
      )}

      {onNotification && !edit.editing && (
        <div style={{ padding: '0 20px 16px' }}>
          <Button display="block" size="medium" color="dark" variant="weak" onClick={onNotification}>
            매일 저녁 알림 받기
          </Button>
        </div>
      )}

      {/* 길게 누르기를 못 하는 키보드·스크린리더용 입구. 포커스할 때만 보여요 */}
      {!edit.editing && (
        <button type="button" className="rc-reveal" onClick={() => edit.enter('button')}>
          위젯 판 편집
        </button>
      )}

      <MotionContext.Provider value={!still}>
        <div {...edit.boardProps} className={`${edit.boardProps.className}${still ? ' rc-still' : ''}`}>
          {edit.visible.map((id, index) => {
            const view = describeWidget(id, ctx);
            const wide = RECORD_WIDGETS[id].wide ? ' rc-widget-wide' : '';
            const drag = edit.dragStyle(id);
            const style = { ...(view.background ? { background: view.background } : {}), ...drag.style };
            if (edit.editing) {
              const last = edit.visible.length <= 1;
              return (
                <div key={id} data-widget={id} role="group" aria-label={view.aria} className={`rc-widget${wide}${drag.className}`} style={style}>
                  <button
                    type="button"
                    data-control
                    className="rc-minus"
                    aria-label={`${RECORD_WIDGETS[id].name} 숨기기`}
                    aria-disabled={last || undefined}
                    onClick={() => edit.hide(id)}
                  >
                    <span>
                      <i />
                    </span>
                  </button>
                  {view.content(false)}
                  {index > 0 && (
                    <button type="button" data-control className="rc-reveal" onClick={() => edit.step(id, -1)}>
                      {RECORD_WIDGETS[id].name} 앞으로
                    </button>
                  )}
                  {index < edit.visible.length - 1 && (
                    <button type="button" data-control className="rc-reveal" onClick={() => edit.step(id, 1)}>
                      {RECORD_WIDGETS[id].name} 뒤로
                    </button>
                  )}
                </div>
              );
            }
            if (view.locked) {
              return (
                <div key={id} data-widget={id} role="group" aria-label={view.aria} className={`rc-widget${wide}`} style={style}>
                  {view.content(false)}
                </div>
              );
            }
            return (
              <button
                key={id}
                type="button"
                data-widget={id}
                className={`rc-widget${wide}`}
                style={style}
                aria-label={view.aria}
                onClick={() => {
                  if (!edit.blockClick()) onOpen(id);
                }}
              >
                {view.content(true)}
              </button>
            );
          })}
        </div>
      </MotionContext.Provider>

      {edit.editing && edit.hidden.length > 0 && (
        <section className="rc-tray" aria-label="숨긴 위젯">
          <h2>숨긴 위젯 · 눌러서 다시 넣어요</h2>
          <div className="rc-tray-list">
            {edit.hidden.map((id) => (
              <button key={id} type="button" className="rc-chip" aria-label={`${RECORD_WIDGETS[id].name} 넣기`} onClick={() => edit.add(id)}>
                ＋ {RECORD_WIDGETS[id].name}
              </button>
            ))}
          </div>
        </section>
      )}

      {hasHistory && (
        <div key="banner" style={{ padding: '24px 0 40px', display: edit.editing ? 'none' : 'block' }}>
          <AdBanner adGroupId={AD_GROUPS.bannerToday} />
        </div>
      )}
      {/* 배너가 안 보일 때(기록 없음·편집 모드)도 맨 아래 40px — 홈·설정과 같게 */}
      {(!hasHistory || edit.editing) && <div style={{ height: 40 }} />}
    </>
  );
}
