import { colors } from '@toss/tds-colors';
import { Button, CTAButton, Chip, ChipItem, FixedBottomCTA, ProgressBar, Text, TextArea, Top, useDialog, useToast } from '@toss/tds-mobile';
import { useEffect, useRef, useState } from 'react';

import { AI_MESSAGES, CARE_PHONE_URL } from '../ai/messages';
import { cleanCell, emptyCellCount, hasBoardText } from '../ai/rules';
import type { AiResult, DraftHooks, DraftProgress, DraftValue } from '../ai/useAiDraft';
import { AdMark, AiDraftBadge } from '../components/AiDraftBadge';
import { MandalartGrid } from '../components/MandalartGrid';
import { openUrl } from '../lib/bridge';
import { MAX_TEXT, type Board } from '../lib/mandalart';
import { brandColor } from '../theme';

/** 목표 예시(시안 그대로). 누르면 입력칸에 들어가요 */
const EXAMPLES = ['8구단 드래프트 1순위', '토익 900점', '올해 10kg 감량', '하프 마라톤 완주'];
const GOAL_INPUT_ID = 'ai-draft-goal';
const GOAL_ERROR_ID = 'ai-draft-goal-error';

type Phase = 'input' | 'making' | 'preview';

interface DraftScreenProps {
  /** 지금 판(핵심 목표를 미리 넣고, 결과는 이 판의 빈 칸에만 들어가요) */
  board: Board;
  runsLeft: number;
  onGenerate: (goal: string, hooks: DraftHooks) => Promise<AiResult<DraftValue>>;
  onApply: (goal: string, draft: DraftValue) => void;
  onStartWithTemplate: () => void;
}

function CtaCaption({ text, strong = false }: { text: string; strong?: boolean }) {
  return (
    <div className="text-balance" style={{ padding: '0 4px 10px', textAlign: 'center' }}>
      <Text typography="t7" color={strong ? colors.grey700 : colors.grey600} fontWeight={strong ? 'semibold' : undefined}>
        {text}
      </Text>
    </div>
  );
}

function AdLabel({ children, onBrand }: { children: string; onBrand: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <AdMark onBrand={onBrand} />
      <span>{children}</span>
    </span>
  );
}

/**
 * AI 초안 만들기 (`#/draft`, 화면 시안 2·5·6): 목표 입력 → (처음이면 고지 시트) → 리워드 광고 → 만드는 중 → 미리보기.
 * '이대로 시작하기' 를 눌러야 판에 들어가요. 화면을 나가면 만들던 초안은 버려요.
 */
export function DraftScreen({ board, runsLeft, onGenerate, onApply, onStartWithTemplate }: DraftScreenProps) {
  const [goal, setGoal] = useState(board.goal);
  /** 칸을 일부 채운 판에서 왔어요(2.1) — 적어 둔 칸은 그대로 두고 빈 칸만 채운다는 문구로 */
  const partial = hasBoardText(board);
  const fillCount = emptyCellCount(board);
  const [phase, setPhase] = useState<Phase>('input');
  const [progress, setProgress] = useState<DraftProgress | null>(null);
  const [draft, setDraft] = useState<DraftValue | null>(null);
  const [issue, setIssue] = useState<'refused' | 'self_harm' | null>(null);
  /** 광고를 본 뒤 거절·실패해서 오늘 횟수에 넣지 않았어요 */
  const [notCounted, setNotCounted] = useState(false);
  const alive = useRef(true);
  /** 만들기 진행 중(고지·광고·서버·안내 다이얼로그까지). 두 번 눌러도 한 번만 */
  const running = useRef(false);
  const { openConfirm } = useDialog();
  const toast = useToast();

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  const offerTemplate = async (title: string, description: string) => {
    if (await openConfirm({ title, description, confirmButton: '예시로 시작하기', cancelButton: '닫기' })) onStartWithTemplate();
  };

  const generate = async () => {
    if (running.current) return;
    running.current = true;
    try {
      await runGenerate();
    } finally {
      running.current = false;
    }
  };

  const runGenerate = async () => {
    const from = phase;
    setIssue(null);
    const result = await onGenerate(goal, {
      onStarted: () => {
        if (!alive.current) return;
        setProgress(null);
        setPhase('making');
      },
      onProgress: (next) => {
        if (alive.current) setProgress(next);
      },
    });
    if (!alive.current || (result.kind === 'stopped' && result.reason === 'busy')) return;
    if (result.kind === 'ok') {
      setDraft(result.value);
      setNotCounted(false);
      setPhase('preview');
      return;
    }
    setPhase(from === 'preview' && draft ? 'preview' : 'input');
    if (result.kind === 'stopped') {
      if (result.reason === 'self_harm') setIssue('self_harm');
      else if (result.reason === 'limit') toast.openToast(AI_MESSAGES.limit);
      else if (result.reason === 'dismissed') toast.openToast(AI_MESSAGES.dismissed);
      else if (result.reason === 'key') toast.openToast(AI_MESSAGES.retryLater);
      else if (result.reason === 'no_ad') await offerTemplate(AI_MESSAGES.noAdTitle, AI_MESSAGES.noAdBody);
      return;
    }
    if (result.code === 'limited') {
      toast.openToast(AI_MESSAGES.serverLimited);
      return;
    }
    setNotCounted(true);
    if (result.code === 'refused' || result.code === 'self_harm') {
      setIssue(result.code === 'refused' ? 'refused' : 'self_harm');
      setPhase('input');
      return;
    }
    await offerTemplate(AI_MESSAGES.failTitle, AI_MESSAGES.failBody);
  };

  if (phase === 'making') {
    const shown = progress?.board ?? { ...board, goal: cleanCell(goal) };
    return (
      <>
        <Top
          title={<Top.TitleParagraph size={22}>{partial ? '빈 칸을 채우고 있어요' : '초안을 만들고 있어요'}</Top.TitleParagraph>}
          subtitleBottom={
            <Top.SubtitleParagraph size={17}>{progress ? '세부 목표를 정했어요. 실천을 채우고 있어요' : '세부 목표를 정하고 있어요'}</Top.SubtitleParagraph>
          }
        />
        {progress && progress.total > 0 && (
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text typography="t7" color={colors.grey600}>
                실천 채우는 중
              </Text>
              <Text typography="t7" color={colors.grey800} fontWeight="semibold">
                {progress.done} / {progress.total}
              </Text>
            </div>
            <ProgressBar size="normal" color={brandColor} progress={progress.done / progress.total} animate />
          </div>
        )}
        <div aria-hidden>
          <MandalartGrid board={shown} loading />
        </div>
        <div style={{ padding: '24px 24px 40px' }}>
          <Text typography="t7" color={colors.grey600} display="block">
            10초쯤 걸려요. 화면을 나가면 만들던 초안은 사라져요.
          </Text>
        </div>
      </>
    );
  }

  if (phase === 'preview' && draft) {
    return (
      <>
        <Top
          subtitleTop={<AiDraftBadge />}
          title={<Top.TitleParagraph size={22}>{draft.board.goal}</Top.TitleParagraph>}
          subtitleBottom={
            <Top.SubtitleParagraph size={17}>{partial ? '적어 둔 칸은 그대로예요. 넣은 뒤에도 칸을 눌러 고칠 수 있어요' : '시작한 뒤에도 칸을 눌러 고칠 수 있어요'}</Top.SubtitleParagraph>
          }
        />
        <MandalartGrid board={draft.board} />
        <div style={{ height: 160 }} />
        <FixedBottomCTA.Double
          topAccessory={
            <CtaCaption
              text={runsLeft === 0 ? AI_MESSAGES.limit : notCounted ? AI_MESSAGES.notCounted(runsLeft) : AI_MESSAGES.remakeCaption(runsLeft)}
              strong={runsLeft === 0}
            />
          }
          leftButton={
            <CTAButton color="dark" variant="weak" disabled={runsLeft === 0} onClick={() => void generate()} aria-label="광고 보고 다시 만들기">
              <AdLabel onBrand={false}>다시 만들기</AdLabel>
            </CTAButton>
          }
          rightButton={<CTAButton onClick={() => onApply(goal, draft)}>{partial ? '빈 칸에 넣기' : '이대로 시작하기'}</CTAButton>}
        />
      </>
    );
  }

  const canMake = cleanCell(goal).length > 0 && runsLeft > 0;
  return (
    <>
      <Top
        title={<Top.TitleParagraph size={22}>{partial ? 'AI로 빈 칸 채우기' : 'AI 초안 만들기'}</Top.TitleParagraph>}
        subtitleBottom={
          <Top.SubtitleParagraph size={17}>{partial ? AI_MESSAGES.fillDraftSubtitle(fillCount) : '핵심 목표를 적으면 세부 목표 8개와 실천 64개를 채워요'}</Top.SubtitleParagraph>
        }
      />
      <div className="mg-cell-editor" style={{ padding: '0 24px', ['--mg-brand' as string]: issue === 'refused' ? colors.red500 : brandColor }}>
        <Text typography="t7" color={colors.grey600} fontWeight="medium">
          핵심 목표
        </Text>
        <div style={{ margin: '0 -24px' }}>
          {/* 칸 편집 시트와 같은 큰 글씨 입력. 줄바꿈은 넣지 않고 Enter 는 키보드만 닫아요(광고가 바로 뜨지 않게) */}
          <TextArea
            id={GOAL_INPUT_ID}
            variant="big"
            aria-label="핵심 목표"
            aria-invalid={issue === 'refused' ? true : undefined}
            aria-describedby={issue === 'refused' ? GOAL_ERROR_ID : undefined}
            placeholder="예: 올해 안에 책 한 권 쓰기"
            value={goal}
            maxLength={MAX_TEXT}
            enterKeyHint="done"
            onChange={(event) => {
              setGoal(event.target.value.replace(/[\r\n]+/g, ' '));
              setIssue(null);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
              event.preventDefault();
              event.currentTarget.blur();
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div id={GOAL_ERROR_ID} aria-live="polite">
            {issue === 'refused' && (
              <Text typography="t7" color={colors.red700} display="block">
                {AI_MESSAGES.refused}
              </Text>
            )}
          </div>
          <div style={{ flexShrink: 0 }}>
            <Text typography="t7" color={goal.length >= MAX_TEXT ? colors.red700 : colors.grey600}>
              {goal.length}/{MAX_TEXT}
            </Text>
          </div>
        </div>
      </div>

      {issue === 'self_harm' ? (
        <section aria-live="polite" style={{ margin: '24px 20px 0', padding: 20, borderRadius: 16, background: colors.grey50 }}>
          <Text typography="t5" color={colors.grey900} fontWeight="bold" display="block">
            {AI_MESSAGES.careTitle}
          </Text>
          <div style={{ marginTop: 6 }}>
            <Text typography="t6" color={colors.grey700} display="block">
              {AI_MESSAGES.careBody}
            </Text>
          </div>
          <div style={{ marginTop: 16 }}>
            <Button display="block" size="large" color="dark" variant="weak" onClick={() => void openUrl(CARE_PHONE_URL)}>
              {AI_MESSAGES.careCall}
            </Button>
          </div>
        </section>
      ) : partial ? null : (
        // 예시 목표는 빈 판에서만 — 칸을 일부 채운 판에서 목표를 바꾸면 적어 둔 칸과 어긋나요
        <div style={{ paddingTop: 24 }}>
          <div style={{ padding: '0 24px 10px' }}>
            <Text typography="t7" color={colors.grey600} fontWeight="medium">
              예시
            </Text>
          </div>
          <Chip kind="action" wrap aria-label="목표 예시">
            {EXAMPLES.map((example) => (
              <ChipItem
                key={example}
                onClick={() => {
                  setGoal(example);
                  setIssue(null);
                }}
              >
                {example}
              </ChipItem>
            ))}
          </Chip>
        </div>
      )}

      <div style={{ height: 160 }} />
      <FixedBottomCTA
        topAccessory={
          <CtaCaption
            text={
              runsLeft === 0
                ? AI_MESSAGES.limit
                : notCounted
                  ? AI_MESSAGES.notCounted(runsLeft)
                  : partial
                    ? AI_MESSAGES.fillDraftCaption(runsLeft)
                    : AI_MESSAGES.draftCaption(runsLeft)
            }
            strong={runsLeft === 0}
          />
        }
        disabled={!canMake}
        aria-label={partial ? '광고 보고 AI로 빈 칸 채우기' : '광고 보고 AI 초안 만들기'}
        onClick={() => void generate()}
      >
        <AdLabel onBrand>{partial ? '광고 보고 채우기' : '광고 보고 만들기'}</AdLabel>
      </FixedBottomCTA>
    </>
  );
}
