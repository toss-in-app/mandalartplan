/**
 * 요청·응답 검사 (계약 contract/ai-draft.api.md). Deno·npm 에 기대지 않는 순수 함수라 앱 쪽 vitest 로도 시험해요.
 */
export const KEY_RE = /^k[0-9a-f]{64}$/;
export const MAX_TEXT = 40;
export const SLOTS = 8;
/** 검사에 걸려 비운 칸이 이보다 많으면 한 번 다시 요청해요(설계 '출력 검사') */
export const RETRY_IF_EMPTY_OVER = 3;

export type DraftRequest =
  | { mode: 'subs'; key: string; goal: string; subs: string[] }
  | { mode: 'actions'; key: string; goal: string; subs: string[]; only: number; actions: string[] };

/** 제어문자를 지우고 공백을 하나로 */
export function cleanInput(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function cells(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length !== SLOTS) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.length > MAX_TEXT) return null;
    out.push(cleanInput(item));
  }
  return out;
}

/** 형식이 틀리거나 채울 칸이 없으면 null(→ 400 invalid) */
export function parseRequest(body: unknown): DraftRequest | null {
  if (!body || typeof body !== 'object') return null;
  const raw = body as Record<string, unknown>;
  if (typeof raw.key !== 'string' || !KEY_RE.test(raw.key)) return null;
  if (typeof raw.goal !== 'string' || raw.goal.length > MAX_TEXT) return null;
  const goal = cleanInput(raw.goal);
  if (goal.length === 0) return null;
  const subs = cells(raw.subs);
  if (!subs) return null;
  if (raw.mode === 'subs') {
    if (!subs.some((sub) => sub === '')) return null;
    return { mode: 'subs', key: raw.key, goal, subs };
  }
  if (raw.mode === 'actions') {
    const only = raw.only;
    if (typeof only !== 'number' || !Number.isInteger(only) || only < 0 || only >= SLOTS) return null;
    if (subs[only] === '') return null;
    const actions = cells(raw.actions);
    if (!actions || !actions.some((action) => action === '')) return null;
    return { mode: 'actions', key: raw.key, goal, subs, only, actions };
  }
  return null;
}

const QUOTES = /["'`“”‘’「」『』]/g;
const URL_LIKE = /(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|kr|io|co|me)\b)/i;
const EMAIL_LIKE = /\S+@\S+/;
const PHONE_LIKE = /\d{2,4}-\d{3,4}-\d{4}/;
const EMOJI = /\p{Extended_Pictographic}/u;

/** 모델 칸을 비운 이유(글 내용 없이 개수만 로그·응답에 남겨요) */
export type RejectReason = 'not_string' | 'blank' | 'too_long' | 'url' | 'email' | 'phone' | 'emoji' | 'dup';

/**
 * 모델이 준 칸 하나. 따옴표·느낌표·물음표와 끝의 마침표는 지우고, URL·이메일·전화번호·이모지가 있거나 40자를 넘으면 비워요.
 * (숫자 안의 점 '2.5km' 는 남겨요)
 */
export function classifyOutputCell(value: unknown): { text: string } | { reason: RejectReason } {
  if (typeof value !== 'string') return { reason: 'not_string' };
  const text = cleanInput(value).replace(QUOTES, '').replace(/[!?！？]/g, '').replace(/[.。]+$/u, '').trim().replace(/\s+/g, ' ');
  if (!text) return { reason: 'blank' };
  if (text.length > MAX_TEXT) return { reason: 'too_long' };
  if (URL_LIKE.test(text)) return { reason: 'url' };
  if (EMAIL_LIKE.test(text)) return { reason: 'email' };
  if (PHONE_LIKE.test(text)) return { reason: 'phone' };
  if (EMOJI.test(text)) return { reason: 'emoji' };
  return { text };
}

export function cleanOutputCell(value: unknown): string {
  const result = classifyOutputCell(value);
  return 'text' in result ? result.text : '';
}

export interface MergedCells {
  cells: string[];
  /** 이번에 새로 채운 칸 수 */
  filled: number;
  /** 빈 칸이었는데 결과가 없거나 검사에 걸려 비운 칸 수 */
  empty: number;
  /** 비운 이유별 개수 */
  reasons: Partial<Record<RejectReason, number>>;
}

/**
 * 사용자가 적은 칸은 원래 글 그대로 두고 빈 칸만 모델 결과로 채워요. 이미 있는 글(avoid 포함)과 같은 칸은 버려요.
 * output 이 길이 8 배열이 아니면 null(→ 다시 요청).
 */
export function mergeOutput(input: readonly string[], output: unknown, avoid: readonly string[] = []): MergedCells | null {
  if (!Array.isArray(output) || output.length !== SLOTS) return null;
  const seen = new Set([...input, ...avoid].map((text) => text.replace(/\s+/g, '')).filter(Boolean));
  let filled = 0;
  let empty = 0;
  const reasons: Partial<Record<RejectReason, number>> = {};
  const reject = (reason: RejectReason) => {
    empty += 1;
    reasons[reason] = (reasons[reason] ?? 0) + 1;
    return '';
  };
  const merged = input.map((current, i) => {
    if (current !== '') return current;
    const result = classifyOutputCell(output[i]);
    if (!('text' in result)) return reject(result.reason);
    const compact = result.text.replace(/\s+/g, '');
    if (seen.has(compact)) return reject('dup');
    seen.add(compact);
    filled += 1;
    return result.text;
  });
  return { cells: merged, filled, empty, reasons };
}

/** 구조화 출력 글({ refused, items }) → { refused, list }. 형식이 다르면 null */
export function parseModelJson(text: string): { refused: boolean; list: unknown } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;
  if (typeof record.refused !== 'boolean') return null;
  return { refused: record.refused, list: record.items };
}
