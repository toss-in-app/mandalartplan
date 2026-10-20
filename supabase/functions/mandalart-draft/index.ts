/**
 * Supabase Edge Function `mandalart-draft` — 만다라트 AI 초안 (계약 contract/ai-draft.api.md, 설계 plans/2.0-ai-draft-design.md).
 * 배포: `supabase functions deploy mandalart-draft --no-verify-jwt` (앱은 로그인 없이 publishable key 만 보내요 — README.md).
 * 비밀 값: ANTHROPIC_API_KEY 는 `supabase secrets set` 으로만(저장소·앱에 절대 없음). Supabase 키는 플랫폼이 넣어 줘요.
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0';

import { handleDraft, type ClaudeOutcome, type ClaudeUsage, type DraftDeps } from './handler.ts';
import { EFFORT, MAX_TOKENS, MODEL, SYSTEM_PROMPT } from './prompt.ts';

/** 토스 미니앱 웹뷰(SDK 3.1.0+ 규칙: 라이브·QR 테스트)와 개발 서버만 */
const ALLOWED_ORIGINS = new Set([
  'https://mandalartplan.apps.tossmini.com',
  'https://mandalartplan.private-apps.tossmini.com',
  'http://localhost:5180',
]);

/** Claude 를 25초까지 기다리고, 429·5xx 는 SDK 가 한 번만 다시 해요(자동 재시도 상한) */
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '', maxRetries: 1, timeout: 25_000 });

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';

function readKeys(name: string): string[] {
  try {
    const parsed = JSON.parse(Deno.env.get(name) ?? '{}') as Record<string, unknown>;
    return Object.values(parsed).filter((value): value is string => typeof value === 'string' && value.length > 0);
  } catch {
    return [];
  }
}

/** DB 함수(ai_draft_take·ai_draft_cost_add)는 서버 키만 실행할 수 있어요. 새 secret key 를 apikey 헤더로, 없으면 예전 service_role */
function serverHeaders(): Record<string, string> {
  const secret = (() => {
    try {
      const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, unknown>;
      return typeof keys.default === 'string' ? keys.default : null;
    } catch {
      return null;
    }
  })();
  if (secret) return { apikey: secret };
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return { apikey: legacy, Authorization: `Bearer ${legacy}` };
}

/** 앱이 보내는 publishable key 인지(공개 값이라 인증은 아니고, 아무 요청이나 받지 않으려는 거름망) */
const PUBLISHABLE = [...readKeys('SUPABASE_PUBLISHABLE_KEYS'), Deno.env.get('SUPABASE_ANON_KEY') ?? ''].filter(Boolean);

async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { ...serverHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error(`rpc ${fn} ${response.status}`);
  return response.json();
}

interface UsageFields {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

function usageOf(usage: UsageFields): ClaudeUsage {
  return {
    input: usage.input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
    cacheWrite: usage.cache_creation_input_tokens ?? 0,
  };
}

const deps: DraftDeps = {
  take: async (key) => (await rpc('ai_draft_take', { p_key: key })) === true,
  addCost: async (calls, usage) => {
    await rpc('ai_draft_cost_add', {
      p_calls: calls,
      p_in: usage.input,
      p_out: usage.output,
      p_cache_read: usage.cacheRead,
      p_cache_write: usage.cacheWrite,
    });
  },
  callClaude: async (user, schema): Promise<ClaudeOutcome> => {
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // 고정 시스템 프롬프트를 캐시(실천 8개 동시 요청이 같은 프롬프트를 써요). 샘플링 값·prefill 은 보내지 않아요(Haiku 5.5 는 400)
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: user }],
        output_config: { effort: EFFORT, format: { type: 'json_schema', schema } },
      });
      const usage = usageOf(response.usage);
      // 거절은 정상 200 + stop_reason 'refusal'(Haiku 5.5 는 서버 쪽 대체 모델 없음)
      if (response.stop_reason === 'refusal') return { kind: 'refusal', usage };
      // 앞에 thinking 블록이 올 수 있어 종류로 골라 읽어요
      const text = response.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
      return { kind: 'text', text, usage };
    } catch (error) {
      const status = error instanceof Anthropic.APIError ? error.status : 'network';
      console.error(JSON.stringify({ at: 'claude', status }));
      return { kind: 'error' };
    }
  },
};

function json(status: number, body: Record<string, unknown>, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') ?? '';
  const cors = ALLOWED_ORIGINS.has(origin)
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'apikey, content-type, authorization, x-client-info',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      }
    : null;
  if (req.method === 'OPTIONS') return new Response(null, { status: cors ? 204 : 403, headers: cors ?? {} });
  if (!cors) return json(403, { ok: false, error: 'forbidden' });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'invalid' }, cors);
  if (PUBLISHABLE.length > 0 && !PUBLISHABLE.includes(req.headers.get('apikey') ?? '')) return json(401, { ok: false, error: 'invalid' }, cors);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: 'invalid' }, cors);
  }
  const startedAt = Date.now();
  const result = await handleDraft(body, deps);
  // 결과 코드·시간만 남겨요(목표·칸 글·키 없음)
  const mode = body && typeof body === 'object' ? (body as Record<string, unknown>).mode : null;
  console.log(JSON.stringify({ at: 'draft', mode: mode === 'subs' || mode === 'actions' ? mode : 'other', result: result.result, ms: Date.now() - startedAt }));
  return json(result.status, result.body, cors);
});
