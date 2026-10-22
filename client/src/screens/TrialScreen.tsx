import { colors } from '@toss/tds-colors';
import { Button, FixedBottomCTA, Text, Top } from '@toss/tds-mobile';
import { useState } from 'react';

import { AiDraftBadge } from '../components/AiDraftBadge';
import { Block } from '../components/Block';
import type { Content } from '../content';
import { haptic } from '../lib/bridge';
import { clearBlockCells, swapBlockCells, swapPairs } from '../lib/cellEdit';
import { swapIndices } from '../lib/checkin';
import { CENTER, cellOfRing, createEmptyBoard, type Board } from '../lib/mandalart';
import { dateKey, type CheckinRecord } from '../lib/state';
import { boardFromTemplate } from '../lib/template';
import { brandColor, withAlpha } from '../theme';
import { SubScreen } from './SubScreen';
import { fullScreenAdsEnabled } from '../ads/config';

type Step = 'stamp' | 'move' | 'edit' | 'ai';

interface TrialScreenProps {
  content: Content;
  /** AI 초안을 쓸 수 있는 기기면 마지막에 AI 미리보기 단계를 보여 줘요 */
  aiAvailable: boolean;
  /** 아직 내 판에 실천이 없으면 true → 마지막 버튼이 '내 만다라트 시작하기', 아니면 '내 만다라트로 돌아가기' */
  fresh: boolean;
  /** 마지막 버튼. 거친 단계 수를 넘겨요(분석) */
  onFinish: (steps: number) => void;
}

/** 체험판에서 여는 세부 목표(예시 '건강한 한 해'의 첫 세부 목표) */
const TRIAL_SUB = 0;

/**
 * 1분 체험판(2.1, 사용자 결정 2026-10-21 — 첫 사용자 가이드 시안 E). 예시로 채운 판에서 실제 화면 그대로 연습하고 내 판으로 돌아가요.
 * 판·체크는 이 화면 안에서만 쓰고 저장하지 않아요(나가면 사라져요).
 *  1. 도장: 실천 칸을 눌러 '완료' 도장 찍기
 *  2. 옮기기(3.0): 칸을 꾹 누른 채 끌어 다른 칸 위에 놓아 자리 바꾸기(가운데 제외) — 도장도 글을 따라가요
 *  3. 편집: 편집 모드에서 꾹 누르지 않고 빠르게 끌어 고르고 삭제 → 토스트 '되돌리기'(편집 모드가 아니면 먼저 길게 누르라고 안내)
 *  4. AI(AI 를 쓸 수 있는 기기만): AI 초안이 채워진 모습 미리보기 — 광고·서버 없음
 * 홈·설정의 '1분 체험해 보기'로만 열려요(들어오자마자 띄우지 않아요 — 앱인토스 다크패턴 정책).
 */
export function TrialScreen({ content, aiAvailable, fresh, onFinish }: TrialScreenProps) {
  const [board, setBoard] = useState<Board>(() => {
    const now = Date.now();
    return boardFromTemplate(createEmptyBoard(now), content.templates[0], now);
  });
  // AI 미리보기용 예시(다른 목표로 채운 판)
  const [aiBoard] = useState<Board>(() => {
    const now = Date.now();
    return boardFromTemplate(createEmptyBoard(now), content.templates[1] ?? content.templates[0], now);
  });
  const [checked, setChecked] = useState<number[]>([]);
  const [swapped, setSwapped] = useState(false);
  const [deleted, setDeleted] = useState(false);
  /** 세부 목표 화면이 편집 모드인지 — 3단계 안내를 상태에 맞춰요 */
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState<Step>('stamp');

  const steps: Step[] = aiAvailable ? ['stamp', 'move', 'edit', 'ai'] : ['stamp', 'move', 'edit'];
  const position = steps.indexOf(step) + 1;
  const last = position === steps.length;
  const ready = step === 'stamp' ? checked.length > 0 : step === 'move' ? swapped : step === 'edit' ? deleted : true;
  const finishLabel = fresh ? '내 만다라트 시작하기' : '내 만다라트로 돌아가기';
  const next = () => (last ? onFinish(steps.length) : setStep(steps[position]));

  const checkin: CheckinRecord = { days: checked.length > 0 ? { [dateKey()]: checked } : {}, lastCompletedAt: null };

  const toggle = (index: number) => {
    void haptic('tap');
    setChecked((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  };
  const changeAction = (s: number, a: number, text: string) =>
    setBoard((b) => ({ ...b, subs: b.subs.map((sub, i) => (i === s ? { ...sub, actions: sub.actions.map((t, j) => (j === a ? text : t)) } : sub)) }));
  const changeSubTitle = (s: number, title: string) => setBoard((b) => ({ ...b, subs: b.subs.map((sub, i) => (i === s ? { ...sub, title } : sub)) }));
  /** 실제 앱과 같은 자리 바꾸기(3.0): 두 실천의 글을 바꾸고 도장(체크)도 글을 따라가요 */
  const swapCells = (a: number, b: number) => {
    const block = cellOfRing(TRIAL_SUB);
    setBoard((prev) => swapBlockCells(prev, block, a, b));
    setChecked((prev) => swapIndices(prev, swapPairs(block, a, b)));
    setSwapped(true);
  };
  /**
   * 실제 앱과 같은 지우기(지운 실천은 체크에서도 빠져요). 되돌리면 지우기 전으로.
   * 판의 updatedAt 은 그대로라 편집 모드가 board_edit 를 보내지 않고, cells_delete 도 보내지 않아요(내 판이 아니에요).
   */
  const deleteCells = (cells: number[]) => {
    const before = { board, checked };
    const result = clearBlockCells(board, cellOfRing(TRIAL_SUB), cells);
    setBoard(result.board);
    setChecked((prev) => prev.filter((index) => !result.actions.includes(index)));
    setDeleted(true);
    void haptic('success');
    return () => {
      setBoard(before.board);
      setChecked(before.checked);
    };
  };

  const instruction =
    step === 'stamp'
      ? ready
        ? '잘했어요! 다시 누르면 도장이 들려요'
        : "오늘 한 실천을 눌러 '완료' 도장을 찍어 보세요"
      : step === 'move'
        ? ready
          ? '잘했어요! 홈에서 세부 목표를 옮기면 그 아래 실천도 함께 가요'
          : '칸을 꾹 누른 채 끌어 다른 칸 위에 놓아 보세요. 두 칸의 자리가 바뀌어요'
        : step === 'edit'
          ? ready
            ? "지운 칸은 아래 토스트의 '되돌리기'로 살릴 수 있어요"
            : editing
              ? '꾹 누르지 말고 칸을 빠르게 끌면 지나간 칸이 골라져요. 골라서 삭제해 보세요'
              : '먼저 칸을 길게 눌러 편집 모드로 들어가요'
          : 'AI로 초안을 만들면 이렇게 채워져요';

  const banner = (
    <div style={{ margin: '12px 20px 0', padding: '12px 14px', borderRadius: 14, background: withAlpha(brandColor, 0.1), display: 'grid', gap: 6 }}>
      <Text typography="t7" color={colors.grey700} fontWeight="semibold">
        체험판 · 저장되지 않아요 · {position}/{steps.length}
      </Text>
      <div aria-live="polite">
        <Text typography="t6" color={colors.grey900} fontWeight="semibold" display="block">
          {instruction}
        </Text>
      </div>
      {step !== 'ai' && (
        <div style={{ justifySelf: 'end' }}>
          <Button size="small" disabled={!ready} onClick={next}>
            {last ? finishLabel : '다음'}
          </Button>
        </div>
      )}
    </div>
  );

  if (step === 'ai') {
    return (
      <>
        {banner}
        <Top
          subtitleTop={<AiDraftBadge />}
          title={<Top.TitleParagraph size={22}>{aiBoard.goal}</Top.TitleParagraph>}
          subtitleBottom={<Top.SubtitleParagraph size={17}>AI가 세부 목표 8개와 실천 64개를 채운 예시예요</Top.SubtitleParagraph>}
        />
        <div style={{ padding: '0 20px' }}>
          <Block board={aiBoard} block={CENTER} size="main" />
        </div>
        <div className="text-balance" style={{ padding: '16px 24px 120px' }}>
          <Text typography="t7" color={colors.grey600} display="block">
            {fullScreenAdsEnabled() ? '목표를 적고 광고를 한 번 보면 AI가 빈 칸을 채워요.' : '목표를 적으면 AI가 빈 칸을 채워요.'} 적어 둔 칸은 그대로 두고, AI가 쓴 칸에는 'AI 초안' 표시가 붙어요. 내 말로 고치면 표시가 사라져요.
          </Text>
        </div>
        <FixedBottomCTA onClick={next}>{finishLabel}</FixedBottomCTA>
      </>
    );
  }

  return (
    <>
      {banner}
      <SubScreen
        board={board}
        subIndex={TRIAL_SUB}
        checkin={checkin}
        onToggle={toggle}
        onChangeAction={changeAction}
        onChangeSubTitle={changeSubTitle}
        onDeleteCells={deleteCells}
        onSwapCells={swapCells}
        editScreen="trial"
        onEditingChange={setEditing}
      />
    </>
  );
}
