/**
 * AI 초안 서버 호출 (계약 contract/ai-draft.api.md). 자동 재시도는 하지 않아요(정책 2-5) — 사용자가 다시 누를 때만.
 */
import { withTimeout } from '../lib/async';
import { ACTION_COUNT, MAX_TEXT, SUB_COUNT } from '../lib/mandalart';
import { AI_DRAFT_URL, AI_PUBLISHABLE_KEY } from './config';

/** 서버는 Claude 를 25초까지 기다려요. 그보다 조금 넉넉하게 */
const REQUEST_TIMEOUT_MS = 30_000;

/** 서버 오류 코드 + 앱 쪽에서 붙인 것(network: 연결·시간 초과, invalid: 요청 형식) */
export type AiErrorCode = 'refused' | 'self_harm' | 'limited' | 'invalid_output' | 'busy' | 'network' | 'invalid';

const SERVER_ERRORS: ReadonlySet<string> = new Set(['refused', 'self_harm', 'limited', 'invalid_output', 'busy', 'invalid']);

export class AiDraftError extends Error {
  constructor(public readonly code: AiErrorCode) {
    super(`AI 초안 실패: ${code}`);
    this.name = 'AiDraftError';
  }
}

export interface AiMeta {
  model: string;
  promptVersion: number;
}

export interface SubsResponse extends AiMeta {
  subs: string[];
}

export interface ActionsResponse extends AiMeta {
  only: number;
  actions: string[];
  filled: number;
}

function isCells(value: unknown, length: number): value is string[] {
  return Array.isArray(value) && value.length === length && value.every((cell) => typeof cell === 'string' && cell.length <= MAX_TEXT);
}

function readMeta(body: Record<string, unknown>): AiMeta {
  const model = typeof body.model === 'string' && body.model.length > 0 && body.model.length <= 64 ? body.model : null;
  const promptVersion = typeof body.promptVersion === 'number' && Number.isInteger(body.promptVersion) && body.promptVersion >= 1 ? body.promptVersion : null;
  if (model === null || promptVersion === null) throw new AiDraftError('invalid_output');
  return { model, promptVersion };
}

async function post(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await withTimeout(
      fetch(AI_DRAFT_URL, {
        method: 'POST',
        // publishable key 는 JWT 가 아니라 apikey 헤더로만(백업과 같은 규칙)
        headers: { apikey: AI_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      REQUEST_TIMEOUT_MS,
    );
  } catch {
    throw new AiDraftError('network');
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AiDraftError(response.status >= 500 || response.status === 429 ? 'busy' : response.ok ? 'invalid_output' : 'invalid');
  }
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (record.ok === true && response.ok) return record;
  const code = typeof record.error === 'string' && SERVER_ERRORS.has(record.error) ? (record.error as AiErrorCode) : null;
  if (code) throw new AiDraftError(code);
  throw new AiDraftError(response.status >= 500 || response.status === 429 ? 'busy' : 'invalid');
}

/** 빈 세부 목표만 채워요. 응답의 사용자 칸은 서버가 원래 글로 돌려놔요(앱도 빈 칸만 받아요) */
export async function requestSubs(key: string, goal: string, subs: readonly string[]): Promise<SubsResponse> {
  const body = await post({ mode: 'subs', key, goal, subs: [...subs] });
  if (!isCells(body.subs, SUB_COUNT)) throw new AiDraftError('invalid_output');
  return { subs: body.subs, ...readMeta(body) };
}

/** 세부 목표 하나(only)의 빈 실천만 채워요. 판 전체는 세부 목표마다 동시에 불러요 */
export async function requestActions(
  key: string,
  goal: string,
  subs: readonly string[],
  only: number,
  actions: readonly string[],
): Promise<ActionsResponse> {
  const body = await post({ mode: 'actions', key, goal, subs: [...subs], only, actions: [...actions] });
  if (!isCells(body.actions, ACTION_COUNT)) throw new AiDraftError('invalid_output');
  const filled = typeof body.filled === 'number' && body.filled >= 0 ? Math.floor(body.filled) : 0;
  return { only, actions: body.actions, filled, ...readMeta(body) };
}
