import { colors } from '@toss/tds-colors';
import { Button, List, ListRow, ProgressBar, Text, Top } from '@toss/tds-mobile';

import { Block } from '../components/Block';
import { activeSeason, type Content } from '../content';
import { checkedInSub, formatDateLabel, todaySet } from '../lib/checkin';
import { CENTER, getProgress, type Board } from '../lib/mandalart';
import { boardLabel, dateKey, streak, type CheckinRecord } from '../lib/state';
import { brandColor } from '../theme';

interface HomeScreenProps {
  board: Board;
  content: Content;
  checkin: CheckinRecord | undefined;
  /** 판 수(1~2). 2개면 제목이 셀렉터가 되어 판을 바꿀 수 있어요 */
  boardCount: number;
  /** 보고 있는 판의 순번(0~1) */
  activeIndex: number;
  notificationVisible: boolean;
  /** 전면 광고가 뜨는 동안 '기록 보기' 를 잠가요 */
  todayBusy?: boolean;
  /** 다음 '기록 보기' 탭에 전면 광고가 나올 수 있으면 true → 버튼에 AD 표시, 아래에 안내 한 줄(노출 정책 UX 원칙 2) */
  todayAdNotice?: boolean;
  onEditCore: () => void;
  onSelectSub: (subIndex: number) => void;
  onToday: () => void;
  onOverview: () => void;
  onSettings: () => void;
  /** 제목(판이 2개일 때만 셀렉터)을 누르면 판 바꾸기 바텀시트 */
  onSwitchBoard: () => void;
  /** '매일 저녁 알림 받기' 행 — 누르면 바로 알림 동의 화면(사용자가 누른 뒤에만) */
  onNotification: () => void;
  onStartWithTemplate: () => void;
}

/**
 * 홈 = 가운데 3×3 (핵심 목표 + 세부 목표 8). 세부 목표를 누르면 그 목표의 3×3 으로,
 * 가운데(핵심 목표)를 누르면 전체 보기(9×9)로 — 판이 비어 있을 때만 편집으로. 편집은 오른쪽 위 버튼.
 * 글이 있는 실천을 오늘 전부 체크한 세부 목표 칸은 진해지고 체크 표시가 붙어요.
 */
export function HomeScreen({
  board,
  content,
  checkin,
  boardCount,
  activeIndex,
  notificationVisible,
  todayBusy = false,
  todayAdNotice = false,
  onEditCore,
  onSelectSub,
  onToday,
  onOverview,
  onSettings,
  onSwitchBoard,
  onNotification,
  onStartWithTemplate,
}: HomeScreenProps) {
  const today = dateKey();
  const progress = getProgress(board);
  const checked = todaySet(checkin, today);
  const hasGoal = board.goal.trim().length > 0;
  const isEmpty = progress.filled === 0;
  const days = streak(checkin, today);
  const season = activeSeason(content, today);
  const titleText = hasGoal ? board.goal : boardCount > 1 ? boardLabel(activeIndex) : '만다라트';

  const subtitle = isEmpty
    ? '가운데 칸을 눌러 핵심 목표부터 정해 보세요'
    : progress.actionsFilled === 0
      ? '세부 목표 칸을 눌러 실천을 적어 보세요'
      : checked.size > 0 && checked.size >= progress.actionsFilled
        ? `${days}일째 · 오늘 실천을 다 했어요`
        : checked.size > 0
        ? `${days}일째 · 오늘 ${checked.size}개 했어요`
        : days > 0
          ? `${days}일째 이어가는 중 · 오늘은 아직`
          : `${formatDateLabel(today)} · 세부 목표를 눌러 실천을 체크해요`;

  return (
    <>
      <Top
        title={
          boardCount > 1 ? (
            <Top.TitleSelector size={22} onClick={onSwitchBoard}>
              {titleText}
            </Top.TitleSelector>
          ) : (
            <Top.TitleParagraph size={22}>{titleText}</Top.TitleParagraph>
          )
        }
        subtitleBottom={<Top.SubtitleParagraph size={17}>{subtitle}</Top.SubtitleParagraph>}
        right={
          // 편집은 잠기지 않으니 빈 판에서도 보여요. 공유는 전체 보기 화면 오른쪽 위에 있어요
          <Top.RightButton color="dark" variant="weak" onClick={onEditCore}>
            편집
          </Top.RightButton>
        }
      />

      {(content.notice || season) && (
        <div style={{ padding: '0 24px 16px' }}>
          <Text typography="t7" color={colors.grey700}>
            {content.notice ?? season?.message}
          </Text>
        </div>
      )}

      <div style={{ padding: '0 20px' }}>
        <Block
          board={board}
          block={CENTER}
          size="main"
          checked={checked}
          caption={(view) => {
            if (view.kind !== 'sub' || view.index === null || !view.text) return null;
            const total = board.subs[view.index].actions.filter((a) => a.trim()).length;
            if (total === 0) return '실천을 적어요';
            return `오늘 ${checkedInSub(checked, view.index)}/${total}`;
          }}
          onSelectCell={(_cell, view) => {
            // 가운데(핵심 목표)는 판 전체로 나가요. 비어 있을 때만 바로 적을 수 있게 편집으로
            if (view.kind === 'goal') (hasGoal ? onOverview : onEditCore)();
            else if (view.kind === 'sub' && view.index !== null) onSelectSub(view.index);
          }}
        />
      </div>

      {/* 실천을 하나라도 적은 뒤에만 진행률을 보여요 (0 / 0 은 뜻이 없어요) */}
      {progress.actionsFilled > 0 && (
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text typography="t7" color={colors.grey600}>
              오늘 실천
            </Text>
            <Text typography="t7" color={colors.grey800} fontWeight="semibold">
              {checked.size} / {progress.actionsFilled}
            </Text>
          </div>
          <ProgressBar size="normal" color={brandColor} progress={checked.size / progress.actionsFilled} animate />
        </div>
      )}

      {isEmpty ? (
        // 빈 판: 가운데 칸(직접 쓰기) 말고 다른 시작 길은 예시 하나만 버튼으로 둬요
        <div style={{ padding: '24px 20px 8px' }}>
          <Button display="block" size="large" color="dark" variant="weak" onClick={onStartWithTemplate}>
            예시로 시작하기
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, padding: '24px 20px 8px' }}>
          <div style={{ flex: 1 }}>
            <Button
              display="block"
              size="large"
              disabled={progress.actionsFilled === 0 || todayBusy}
              loading={todayBusy}
              onClick={onToday}
              aria-label={todayAdNotice ? '광고 보고 기록 보기' : undefined}
            >
              {todayAdNotice ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {/* 공식 예시처럼 버튼 안의 밝은 AD 표시. TDS Badge 색(blue·teal·green·red·yellow·elephant)은 브랜드 보라 버튼 위에서 묻혀 직접 그려요 */}
                  <span
                    aria-hidden
                    style={{ padding: '1px 5px', borderRadius: 4, background: colors.white, color: brandColor, fontSize: 11, fontWeight: 700, lineHeight: '16px' }}
                  >
                    AD
                  </span>
                  <span>기록 보기</span>
                </span>
              ) : (
                '기록 보기'
              )}
            </Button>
          </div>
          <div style={{ flex: 1 }}>
            <Button display="block" size="large" color="dark" variant="weak" onClick={onOverview}>
              전체 보기
            </Button>
          </div>
        </div>
      )}

      {/* 전면 광고 사전 안내: 언제 나오는지(기록 보기를 누르면), 반복하지 않는다는 것(오늘은 그 뒤로 없음)을 미리 알려요 */}
      {!isEmpty && todayAdNotice && progress.actionsFilled > 0 && (
        <div className="text-balance" style={{ padding: '0 24px 8px' }}>
          <Text typography="t7" color={colors.grey600} display="block">
            기록 보기를 누르면 광고가 한 번 나와요. 오늘은 그 뒤로 광고 없이 볼 수 있어요.
          </Text>
        </div>
      )}

      <List>
        {notificationVisible && (
          <ListRow
            onClick={onNotification}
            withArrow
            contents={<ListRow.Texts type="2RowTypeA" top="매일 저녁 알림 받기" bottom="저녁 9시에 오늘 실천을 체크하라고 알려요" />}
          />
        )}
        <ListRow onClick={onSettings} withArrow contents={<ListRow.Texts type="1RowTypeA" top="설정" />} />
      </List>
      <div style={{ height: 40 }} />
    </>
  );
}
