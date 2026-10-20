/**
 * 요청 하나 처리 (계약 contract/ai-draft.api.md). Claude·DB 는 밖에서 넣어 주는 함수(deps)라 Deno 없이 시험할 수 있어요.
 * 순서: 형식 검사 → 자해 표현(Claude 를 부르지 않고 횟수에도 넣지 않음) → 하루 상한 → Claude(형식 실패·빈 칸 많음이면 1회 더) → 칸 정리.
 * 목표 글·칸 글·결과는 저장하지도 로그에 남기지도 않아요.
 */
import { ACTIONS_SCHEMA, MODEL, PROMPT_VERSION, SUBS_SCHEMA, actionsMessage, subsMessage } from './prompt.ts';
import { looksLikeSelfHarm } from './safety.ts';
import { RETRY_IF_EMPTY_OVER, mergeOutput, parseModelJson, parseRequest, type DraftRequest, type MergedCells } from './validate.ts';

export interface ClaudeUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export type ClaudeOutcome =
  | { kind: 'text'; text: string; usage: ClaudeUsage }
  | { kind: 'refusal'; usage: ClaudeUsage }
  /** 429·5xx·시간 초과·연결 실패 */
  | { kind: 'error' };

export interface DraftDeps {
  /** 키당·전체 하루 상한 안이면 1 늘리고 true */
  take: (key: string) => Promise<boolean>;
  /** 날짜별 비용 기록(실패해도 응답에는 영향 없음) */
  addCost: (calls: number, usage: ClaudeUsage) => Promise<void>;
  callClaude: (user: string, schema: Record<string, unknown>) => Promise<ClaudeOutcome>;
}

export type DraftError = 'invalid' | 'self_harm' | 'limited' | 'refused' | 'invalid_output' | 'busy';

export interface DraftResult {
  status: number;
  body: Record<string, unknown>;
  /** 로그용 결과 코드(글 없음) */
  result: 'ok' | DraftError;
}

function fail(error: DraftError, status = 200): DraftResult {
  return { status, body: { ok: false, error }, result: error };
}

/** Claude 1~2회. 형식이 틀리거나 비운 칸이 많으면 한 번 더, 그래도 형식이 틀리면 invalid_output */
async function generate(req: DraftRequest, deps: DraftDeps): Promise<MergedCells | DraftError> {
  const field = req.mode;
  const user = req.mode === 'subs' ? subsMessage(req.goal, req.subs) : actionsMessage(req.goal, req.subs, req.only, req.actions);
  const schema = req.mode === 'subs' ? SUBS_SCHEMA : ACTIONS_SCHEMA;
  const input = req.mode === 'subs' ? req.subs : req.actions;
  // 실천은 세부 목표 이름을 그대로 반복하지 않게
  const avoid = req.mode === 'subs' ? [req.goal] : [req.goal, req.subs[req.only]];
  let best: MergedCells | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const outcome = await deps.callClaude(user, schema);
    if (outcome.kind === 'error') return best ?? 'busy';
    await deps.addCost(1, outcome.usage).catch(() => {});
    if (outcome.kind === 'refusal') return 'refused';
    const parsed = parseModelJson(outcome.text, field);
    if (parsed?.refused) return 'refused';
    const merged = parsed ? mergeOutput(input, parsed.list, avoid) : null;
    if (merged && (!best || merged.filled > best.filled)) best = merged;
    if (merged && merged.empty <= RETRY_IF_EMPTY_OVER) return merged;
  }
  return best ?? 'invalid_output';
}

export async function handleDraft(body: unknown, deps: DraftDeps): Promise<DraftResult> {
  const req = parseRequest(body);
  if (!req) return fail('invalid', 400);
  const texts = [req.goal, ...req.subs, ...(req.mode === 'actions' ? req.actions : [])];
  if (looksLikeSelfHarm(...texts)) return fail('self_harm');
  let allowed: boolean;
  try {
    allowed = await deps.take(req.key);
  } catch {
    return fail('busy');
  }
  if (!allowed) return fail('limited');

  const merged = await generate(req, deps);
  if (typeof merged === 'string') return fail(merged);
  const meta = { model: MODEL, promptVersion: PROMPT_VERSION };
  if (req.mode === 'subs') return { status: 200, body: { ok: true, mode: 'subs', subs: merged.cells, ...meta }, result: 'ok' };
  return { status: 200, body: { ok: true, mode: 'actions', only: req.only, actions: merged.cells, filled: merged.filled, ...meta }, result: 'ok' };
}
