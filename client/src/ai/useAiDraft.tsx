import { useRef, useState } from 'react';

import type { RewardedOutcome } from '../ads/useRewardedAd';
import { AiNoticeSheet } from '../components/AiNoticeSheet';
import { PRIVACY_URL } from '../content';
import type { useAppState } from '../hooks/useAppState';
import { logEvent } from '../lib/analytics';
import { openUrl } from '../lib/bridge';
import type { Board } from '../lib/mandalart';
import { dateKey } from '../lib/state';
import { AiDraftError, requestActions, requestSubs, type AiErrorCode, type AiMeta } from './api';
import { getAiKey } from './key';
import { cleanCell, emptySubCount, hasBoardText, markAiDraft, mergeActions, mergeDraft, mergeSubs, recordRun, runsLeft, subsNeedingActions } from './rules';
import { looksLikeSelfHarm } from './safety';

type AppState = ReturnType<typeof useAppState>;

interface Reward {
  watch: () => Promise<RewardedOutcome>;
}

/** draft = 목표 입력 화면에서 판 전체, subs = 편집 화면 빈 세부 목표, actions = 편집 화면 한 세부 목표의 빈 실천 */
export type AiMode = 'draft' | 'subs' | 'actions';
/** 분석 이벤트 `ai_draft_start` 의 from: 판 전체 초안은 빈 판에서(new)·칸을 일부 채운 판에서(partial), 채우기는 편집 화면(edit)·세부 목표 화면(sub) */
export type AiFrom = 'new' | 'partial' | 'edit' | 'sub';

/** 서버를 부르기 전에 멈춘 이유. dismissed 말고는 광고를 보지 않았어요. busy = 이미 진행 중(두 번 누름) */
export type AiStopReason = 'limit' | 'self_harm' | 'notice_closed' | 'no_ad' | 'dismissed' | 'key' | 'busy';

export type AiResult<T> = { kind: 'ok'; value: T } | { kind: 'stopped'; reason: AiStopReason } | { kind: 'failed'; code: AiErrorCode };

export interface DraftValue {
  /** 미리보기 판(아직 저장하지 않음) */
  board: Board;
  meta: AiMeta;
}

export interface DraftProgress {
  board: Board;
  /** 실천을 다 받은 세부 목표 수 / 받을 세부 목표 수 */
  done: number;
  total: number;
}

export interface DraftHooks {
  /** 광고를 끝까지 봐서 서버를 부르기 시작할 때(만드는 중 화면으로) */
  onStarted?: () => void;
  /** 세부 목표를 받은 뒤, 실천 한 묶음을 받을 때마다 */
  onProgress?: (progress: DraftProgress) => void;
}

function codeOf(error: unknown): AiErrorCode {
  return error instanceof AiDraftError ? error.code : 'network';
}

/** 연결이 끊기거나 서버가 잠깐 못 받은 경우(network·busy)만 1번 다시 해요. 정책 2-5 는 무제한 재시도를 막아요(1회까지) */
const RETRY_DELAY_MS = 800;

async function once<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const code = codeOf(error);
    if (code !== 'network' && code !== 'busy') throw error;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return call();
  }
}

/** 판의 글 전부 (자해 표현 사전 검사용) */
function boardTexts(board: Board): string[] {
  return [board.goal, ...board.subs.flatMap((sub) => [sub.title, ...sub.actions])];
}

/**
 * AI 한 번 = 사전 검사(하루 10회·자해 표현) → 처음이면 생성형 AI 고지 → 키 → 리워드 광고 → 서버.
 * 광고를 못 불러오면 AI 를 쓰지 않고(2026-10-20 결정), 서버가 결과를 돌려줬을 때만 하루 횟수에 넣어요.
 */
export function useAiDraft(app: AppState, reward: Reward) {
  const [noticeOpen, setNoticeOpen] = useState(false);
  const noticeResolve = useRef<((agreed: boolean) => void) | null>(null);
  /** 편집 화면 채우기가 진행 중(버튼 잠금) */
  const [busy, setBusy] = useState(false);
  /** AI 실행은 한 번에 하나만 — 두 번 누르거나 시트가 닫히며 아래 버튼이 눌려도 광고·횟수가 겹치지 않게(state 보다 먼저 바뀌는 ref) */
  const running = useRef(false);

  const settleNotice = (agreed: boolean) => {
    setNoticeOpen(false);
    noticeResolve.current?.(agreed);
    noticeResolve.current = null;
  };

  const askNotice = () =>
    new Promise<boolean>((resolve) => {
      noticeResolve.current = resolve;
      setNoticeOpen(true);
    });

  const prepare = async (mode: AiMode, texts: string[], from: AiFrom): Promise<{ ok: true; key: string } | { ok: false; reason: AiStopReason }> => {
    const state = app.getState();
    if (!state || runsLeft(state.settings.ai, dateKey()) === 0) return { ok: false, reason: 'limit' };
    if (looksLikeSelfHarm(...texts)) return { ok: false, reason: 'self_harm' };
    if (state.settings.ai.noticeAt === null) {
      if (!(await askNotice())) return { ok: false, reason: 'notice_closed' };
      const at = Date.now();
      app.updateSettings((settings) => ({ ...settings, ai: { ...settings.ai, noticeAt: at } }));
      logEvent('ai_notice_agree');
    }
    let key: string;
    try {
      key = await getAiKey();
    } catch {
      return { ok: false, reason: 'key' };
    }
    logEvent('ai_draft_start', { mode, from });
    let outcome = await reward.watch();
    // 개발 서버 전용: AIT Devtools 의 모의 광고는 보상(userEarnedReward)을 주지 않아서, localStorage 'mandalart.dev.aiReward' = '1' 이면
    // 끝까지 본 것으로 쳐요(만드는 중·미리보기 화면 확인용). 출시 빌드에서는 import.meta.env.DEV 가 false 라 이 줄이 빠져요.
    if (import.meta.env.DEV && outcome === 'dismissed' && window.localStorage.getItem('mandalart.dev.aiReward') === '1') outcome = 'rewarded';
    logEvent('ai_draft_reward', { mode, result: outcome });
    if (outcome === 'unavailable') return { ok: false, reason: 'no_ad' };
    if (outcome === 'dismissed') return { ok: false, reason: 'dismissed' };
    return { ok: true, key };
  };

  const countRun = () => app.updateSettings((settings) => ({ ...settings, ai: recordRun(settings.ai, dateKey()) }));

  /**
   * 목표 입력 화면: 세부 목표(빈 칸만) → 실천(세부 목표마다 동시에, 빈 칸만). 판에는 아직 넣지 않고 미리보기 판을 돌려줘요.
   * 실천 일부가 실패해도 채운 만큼 돌려줘요(나머지는 편집 화면에서 다시 채울 수 있어요).
   */
  const runDraft = async (goal: string, base: Board, hooks: DraftHooks = {}): Promise<AiResult<DraftValue>> => {
    if (running.current) return { kind: 'stopped', reason: 'busy' };
    running.current = true;
    try {
      return await generateDraft(goal, base, hooks);
    } finally {
      running.current = false;
    }
  };

  const generateDraft = async (goal: string, base: Board, hooks: DraftHooks): Promise<AiResult<DraftValue>> => {
    const cleanGoal = cleanCell(goal);
    const prep = await prepare('draft', [cleanGoal, ...boardTexts(base)], hasBoardText(base) ? 'partial' : 'new');
    if (!prep.ok) return { kind: 'stopped', reason: prep.reason };
    hooks.onStarted?.();
    const onProgress = hooks.onProgress ?? (() => {});
    const startedAt = Date.now();
    const finish = (result: string) => logEvent('ai_draft_result', { mode: 'draft', result, ms: Date.now() - startedAt });

    let preview: Board = { ...base, goal: cleanGoal };
    let meta: AiMeta | null = null;
    if (emptySubCount(preview) > 0) {
      try {
        const res = await once(() => requestSubs(prep.key, cleanGoal, preview.subs.map((sub) => sub.title)));
        preview = mergeSubs(preview, res.subs).board;
        meta = res;
      } catch (error) {
        const code = codeOf(error);
        finish(code);
        return { kind: 'failed', code };
      }
    }

    const targets = subsNeedingActions(preview);
    const titles = preview.subs.map((sub) => sub.title);
    const failures: AiErrorCode[] = [];
    let done = 0;
    onProgress({ board: preview, done, total: targets.length });
    await Promise.all(
      targets.map(async (subIndex) => {
        try {
          const res = await once(() => requestActions(prep.key, cleanGoal, titles, subIndex, preview.subs[subIndex].actions));
          preview = mergeActions(preview, subIndex, res.actions).board;
          meta = meta ?? res;
        } catch (error) {
          failures.push(codeOf(error));
        }
        done += 1;
        onProgress({ board: preview, done, total: targets.length });
      }),
    );

    if (meta === null) {
      const code = failures[0] ?? 'invalid_output';
      finish(code);
      return { kind: 'failed', code };
    }
    countRun();
    finish('ok');
    return { kind: 'ok', value: { board: preview, meta } };
  };

  /** 미리보기 '이대로 시작하기': 지금 판의 빈 칸에만 넣고 'AI 초안' 기록을 남겨요 */
  const applyDraft = (goal: string, draft: DraftValue): number => {
    const current = app.board;
    if (!current) return 0;
    const { filled } = mergeDraft(current, goal, draft.board);
    const now = Date.now();
    app.updateBoard((board) => {
      const merged = mergeDraft(board, goal, draft.board);
      return markAiDraft(merged.board, draft.meta, now, merged.cells);
    });
    logEvent('ai_draft_apply', { mode: 'draft', filled });
    return filled;
  };

  /** 편집 화면: 결과를 바로 판에 넣어요(빈 칸만). 돌려준 수 = 새로 채운 칸 */
  const fill = async (mode: 'subs' | 'actions', subIndex: number | null, from: AiFrom): Promise<AiResult<number>> => {
    const board = app.board;
    if (!board || running.current) return { kind: 'stopped', reason: 'busy' };
    running.current = true;
    setBusy(true);
    try {
      const prep = await prepare(mode, boardTexts(board), from);
      if (!prep.ok) return { kind: 'stopped', reason: prep.reason };
      const startedAt = Date.now();
      const titles = board.subs.map((sub) => sub.title);
      let filled = 0;
      try {
        const now = Date.now();
        if (mode === 'subs') {
          const res = await once(() => requestSubs(prep.key, board.goal, titles));
          const latest = app.getState();
          const current = latest ? latest.boards.boards[latest.boards.active] : board;
          filled = mergeSubs(current, res.subs).filled;
          if (filled > 0)
            app.updateBoard((b) => {
              const merged = mergeSubs(b, res.subs);
              return markAiDraft(merged.board, res, now, merged.cells);
            });
        } else if (subIndex !== null) {
          const res = await once(() => requestActions(prep.key, board.goal, titles, subIndex, board.subs[subIndex].actions));
          const latest = app.getState();
          const current = latest ? latest.boards.boards[latest.boards.active] : board;
          filled = mergeActions(current, subIndex, res.actions).filled;
          if (filled > 0)
            app.updateBoard((b) => {
              const merged = mergeActions(b, subIndex, res.actions);
              return markAiDraft(merged.board, res, now, merged.cells);
            });
        }
      } catch (error) {
        const code = codeOf(error);
        logEvent('ai_draft_result', { mode, result: code, ms: Date.now() - startedAt });
        return { kind: 'failed', code };
      }
      countRun();
      logEvent('ai_draft_result', { mode, result: 'ok', ms: Date.now() - startedAt });
      logEvent('ai_draft_apply', { mode, filled });
      return { kind: 'ok', value: filled };
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  const noticeSheet = (
    <AiNoticeSheet open={noticeOpen} onClose={() => settleNotice(false)} onConfirm={() => settleNotice(true)} onPrivacy={() => void openUrl(PRIVACY_URL)} />
  );

  return {
    /** 오늘 남은 AI 횟수 */
    runsLeft: app.state ? runsLeft(app.state.settings.ai, dateKey()) : 0,
    busy,
    runDraft,
    applyDraft,
    fillSubs: (from: AiFrom = 'edit') => fill('subs', null, from),
    fillActions: (subIndex: number, from: AiFrom = 'edit') => fill('actions', subIndex, from),
    noticeSheet,
  };
}
