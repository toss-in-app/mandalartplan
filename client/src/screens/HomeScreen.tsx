import { colors } from '@toss/tds-colors';
import { Button, List, ListRow, ProgressBar, Text, Top } from '@toss/tds-mobile';
import { useEffect } from 'react';

import { emptyCellCount, hasBoardText } from '../ai/rules';
import { AiDraftBadge } from '../components/AiDraftBadge';
import { Block } from '../components/Block';
import { EditDoneButton } from '../components/EditDoneButton';
import { useCellEditor } from '../hooks/useCellEditor';
import { useGridEdit } from '../hooks/useGridEdit';
import { editTarget } from '../lib/cellEdit';
import { activeSeason, type Content } from '../content';
import { nextEmptyCell } from '../lib/cells';
import { checkedInSub, formatDateLabel, todaySet } from '../lib/checkin';
import { CENTER, getProgress, hasAiText, type Board } from '../lib/mandalart';
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
  onSelectSub: (subIndex: number) => void;
  /** 칸을 눌러 시트에서 적었을 때(빈 칸, 또는 편집 모드에서 고친 칸) */
  onChangeGoal: (goal: string) => void;
  onChangeSubTitle: (subIndex: number, title: string) => void;
  onToday: () => void;
  onOverview: () => void;
  onSettings: () => void;
  /** 제목(판이 2개일 때만 셀렉터)을 누르면 판 바꾸기 바텀시트 */
  onSwitchBoard: () => void;
  /** '매일 저녁 알림 받기' 행 — 누르면 바로 알림 동의 화면(사용자가 누른 뒤에만) */
  onNotification: () => void;
  onStartWithTemplate: () => void;
  /** AI 초안 화면으로 — 빈 판·핵심 목표만이면 'AI로 초안 만들기'(2.0), 칸을 일부 채운 뒤에는 빈 칸이 남아 있는 동안 'AI로 빈 칸 채우기'(2.1). 없으면(서버 설정 없음·광고 미지원) 버튼을 숨겨요 */
  onAiDraft?: () => void;
  /** 편집 모드에서 고른 칸(0~8)을 지우고 되돌리기 함수를 돌려줘요(2.1) */
  onDeleteCells?: (cells: number[]) => () => void;
  /** 예전 편집 화면 링크(`block/4`, 콘솔 앱 내 기능 '만다라트 작성')로 들어왔을 때: 편집 모드로 시작, cell 이 있으면 그 칸 입력창, '완료'는 편집 모드를 끝내고 onDone */
  editLink?: { cell: number | null; onDone: () => void };
}

/**
 * 홈 = 가운데 3×3 (핵심 목표 + 세부 목표 8). 세부 목표를 누르면 그 목표의 3×3 으로.
 * 가운데(핵심 목표)는 글이 있으면 누를 수 없는 이름표 — 세부 목표 화면·전체 보기의 가운데와 같아요(2.1, 사용자 결정). 전체 보기는 '전체 보기' 버튼으로.
 * 비어 있는 칸(핵심 목표·세부 목표)은 누르면 그 자리에서 바텀시트로 정해요.
 * 고치기·지우기는 편집 버튼 없이 칸을 길게 눌러 그 자리에서(2.1 제자리 편집 모드, `useGridEdit`) — 오른쪽 위 '완료'로 끝내요.
 * 글이 있는 실천을 오늘 전부 체크한 세부 목표 칸은 진해지고 칸 아래 글이 '오늘 다 했어요'로 바뀌어요(✓ 는 편집 모드의 '고른 칸'만).
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
  onSelectSub,
  onChangeGoal,
  onChangeSubTitle,
  onToday,
  onOverview,
  onSettings,
  onSwitchBoard,
  onNotification,
  onStartWithTemplate,
  onAiDraft,
  onDeleteCells,
  editLink,
}: HomeScreenProps) {
  const editor = useCellEditor({ onChangeGoal, onChangeSubTitle });
  const edit = useGridEdit({
    board,
    block: CENTER,
    screen: 'home',
    onEditCell: (cell) => editor.openFromTap(editTarget(board, CENTER, cell)),
    onDeleteCells,
    startEditing: Boolean(editLink),
  });
  // 링크로 들어왔으면 편집 모드를 끝내고 이전 화면으로(이전 화면이 없어도 편집 모드는 끝나요)
  const finishEditing = () => {
    edit.exit();
    editLink?.onDone();
  };
  // 링크에 칸이 정해져 있으면(`block/4/:cell`) 그 칸의 입력창을 바로 열어요(키보드는 입력칸을 한 번 누르면 올라와요)
  const linkCell = editLink?.cell ?? null;
  useEffect(() => {
    if (linkCell !== null) editor.open(editTarget(board, CENTER, linkCell));
    // 화면이 처음 뜰 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const today = dateKey();
  const progress = getProgress(board);
  const checked = todaySet(checkin, today);
  const hasGoal = board.goal.trim().length > 0;
  const isEmpty = progress.filled === 0;
  const days = streak(checkin, today);
  const season = activeSeason(content, today);
  const titleText = hasGoal ? board.goal : boardCount > 1 ? boardLabel(activeIndex) : '만다라트';

  const hasSubs = board.subs.some((sub) => sub.title.trim().length > 0);
  // AI 초안은 세부 목표·실천이 하나도 없을 때(빈 판 또는 핵심 목표만) 홈에서 권해요.
  const offerAi = Boolean(onAiDraft) && !hasSubs && progress.actionsFilled === 0;
  // 칸을 일부 채운 뒤에도 빈 칸이 남아 있으면 같은 초안 화면으로 빈 칸만 채워요(2.1) — 적어 둔 칸은 그대로
  const fillCount = emptyCellCount(board);
  const offerAiFill = Boolean(onAiDraft) && hasBoardText(board) && fillCount > 0;
  const subtitle = isEmpty
    ? '가운데 칸을 눌러 핵심 목표부터 정해 보세요'
    : !hasSubs
      ? '둘레 칸을 눌러 세부 목표를 정해 보세요'
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
        subtitleTop={hasAiText(board) ? <AiDraftBadge /> : undefined}
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
        // 편집 버튼은 없어요(칸을 길게 누르기). 편집 모드에서만 끝내는 '완료'. 공유는 전체 보기 화면 오른쪽 위에 있어요
        right={<EditDoneButton editing={edit.editing} onClick={finishEditing} />}
      />

      {(content.notice || season) && (
        <div style={{ padding: '0 24px 16px' }}>
          <Text typography="t7" color={colors.grey700}>
            {content.notice ?? season?.message}
          </Text>
        </div>
      )}

      {edit.revealButton}

      <div style={{ padding: '0 20px' }}>
        <div {...edit.gridProps}>
          <Block
            board={board}
            block={CENTER}
            size="main"
            {...edit.blockProps({
              checked,
              nextCell: nextEmptyCell(board, CENTER),
              caption: (view) => {
                if (view.kind !== 'sub' || view.index === null || !view.text) return null;
                const total = board.subs[view.index].actions.filter((a) => a.trim()).length;
                if (total === 0) return '실천을 적어요';
                // 다 했으면 숫자 대신 말로 — 진해진 칸 색과 함께, 색만으로 알리지 않게
                return view.checked ? '오늘 다 했어요' : `오늘 ${checkedInSub(checked, view.index)}/${total}`;
              },
              // 글이 있는 가운데(핵심 목표)는 누름 없음 — 어느 화면이든 가운데는 이름표(2.1). 편집 모드에선 눌러서 고쳐요
              interactive: (_cell, view) => !(view.kind === 'goal' && view.text.trim()),
            })}
            onSelectCell={(cell, view) => {
              // 편집 모드(고치기·고르기)와 길게 누른 뒤의 click 은 편집 쪽이 받아요
              if (edit.handleTap(cell)) return;
              // 비어 있는 칸은 그 자리에서 정하고, 채워진 세부 목표는 그 목표의 3×3 으로
              if (!view.text.trim()) {
                editor.openFromTap(editTarget(board, CENTER, cell));
                return;
              }
              if (view.kind === 'sub' && view.index !== null) onSelectSub(view.index);
            }}
          />
        </div>
      </div>

      {/* 편집 버튼 대신 길게 누르기를 알려 주고, 편집 모드에선 할 수 있는 일을 알려 줘요 */}
      <div className="text-balance" aria-live="polite" style={{ padding: edit.hint ? '12px 24px 0' : 0 }}>
        {edit.hint && (
          <Text typography="t7" color={colors.grey600} display="block">
            {edit.hint}
          </Text>
        )}
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

      {offerAi ? (
        // 세부 목표가 없을 때: AI 초안(주) · 예시(보조). 광고는 버튼을 누른 뒤 목표 입력 화면의 '광고 보고 만들기'에서만 나와요
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '24px 20px 10px' }}>
            <Button display="block" size="large" onClick={onAiDraft}>
              AI로 초안 만들기
            </Button>
            <Button display="block" size="large" color="dark" variant="weak" onClick={onStartWithTemplate}>
              예시로 시작하기
            </Button>
          </div>
          <div className="text-balance" style={{ padding: '0 24px 8px' }}>
            <Text typography="t7" color={colors.grey600} display="block">
              목표를 적고 광고를 한 번 보면 AI가 세부 목표와 실천을 채워요.
            </Text>
          </div>
        </>
      ) : isEmpty ? (
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

      {/* 2.1: 칸을 일부 채운 판에서도 AI 를 쓰게. 광고는 다음 화면의 '광고 보고 채우기'에서만 나와요 */}
      {offerAiFill && (
        <>
          <div style={{ padding: '8px 20px 0' }}>
            <Button display="block" size="large" color="dark" variant="weak" onClick={onAiDraft}>
              AI로 빈 칸 채우기
            </Button>
          </div>
          <div className="text-balance" style={{ padding: '8px 24px 8px' }}>
            <Text typography="t7" color={colors.grey600} display="block">
              빈 칸 {fillCount}개만 채워요. 적어 둔 칸은 그대로예요.
            </Text>
          </div>
        </>
      )}

      {editor.sheet}
      {edit.bottomBar}

      <List>
        {notificationVisible && (
          <ListRow
            onClick={onNotification}
            withArrow
            contents={<ListRow.Texts type="2RowTypeA" top="매일 저녁 알림 받기" bottom="저녁 8시에 오늘 실천을 체크하라고 알려요" />}
          />
        )}
        <ListRow onClick={onSettings} withArrow contents={<ListRow.Texts type="1RowTypeA" top="설정" />} />
      </List>
      <div style={{ height: 40 }} />
    </>
  );
}
