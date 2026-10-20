// AI 초안 평가 세트 실행 (설계 '테스트': plans/2.0-ai-eval-goals.json 20개).
// 배포된 Edge Function 을 앱과 같은 방식(세부 목표 1회 → 실천 8회 동시)으로 불러 결과·형식·시간을 기록해요.
// 실제 Claude 를 부르니 돈이 들어요(한 바퀴 약 150 호출 ≈ 50~100원) — 돌리기 전에 사용자 확인.
// 사용: node scripts/eval-ai-draft.mjs [이름표]   → plans/eval-results/<날짜>-<이름표>.md
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(resolve(root, 'client/.env'), 'utf8')
    .split('\n')
    .filter((line) => /^VITE_[A-Z_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()]),
);
const URL = `${env.VITE_SUPABASE_URL}/functions/v1/mandalart-draft`;
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const label = process.argv[2] ?? 'run';
const goals = JSON.parse(readFileSync(resolve(root, 'plans/2.0-ai-eval-goals.json'), 'utf8')).goals;

async function call(body) {
  const started = Date.now();
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json', Origin: 'http://localhost:5180' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { ms: Date.now() - started, status: res.status, json };
  } catch (error) {
    return { ms: Date.now() - started, status: 0, json: { ok: false, error: `network ${error}` } };
  }
}

const empty8 = () => Array(8).fill('');

function checkFormat(subs, actions) {
  const problems = [];
  const all = [...subs, ...actions.flat()];
  if (subs.filter(Boolean).length < 8) problems.push(`세부 목표 빈 칸 ${8 - subs.filter(Boolean).length}`);
  const emptyActions = actions.flat().filter((a) => !a).length;
  if (emptyActions) problems.push(`실천 빈 칸 ${emptyActions}`);
  const longSubs = subs.filter((s) => s.length > 10).length;
  const longActions = actions.flat().filter((a) => a.length > 14).length;
  if (longSubs) problems.push(`세부 목표 10자 초과 ${longSubs}`);
  if (longActions) problems.push(`실천 14자 초과 ${longActions}`);
  const filled = all.filter(Boolean);
  const dup = filled.length - new Set(filled.map((t) => t.replace(/\s+/g, ''))).size;
  if (dup) problems.push(`중복 ${dup}`);
  return problems;
}

const rows = [];
for (const g of goals) {
  const key = `k${createHash('sha256').update(`eval:${g.id}`).digest('hex')}`;
  const first = await call({ mode: 'subs', key, goal: g.goal, subs: empty8() });
  if (!first.json.ok) {
    rows.push({ ...g, result: first.json.error ?? `http_${first.status}`, subsMs: first.ms, actionsMs: 0, subs: [], actions: [], problems: [] });
    console.log(`${g.id} ${g.goal} → ${first.json.error} (${first.ms}ms)`);
    continue;
  }
  const subs = first.json.subs;
  const started = Date.now();
  const results = await Promise.all(subs.map((sub, only) => (sub ? call({ mode: 'actions', key, goal: g.goal, subs, only, actions: empty8() }) : null)));
  const actionsMs = Date.now() - started;
  const actions = results.map((r) => (r && r.json.ok ? r.json.actions : empty8()));
  const failed = results.filter((r) => r && !r.json.ok).map((r) => r.json.error);
  const problems = checkFormat(subs, actions);
  if (failed.length) problems.push(`실천 실패 ${failed.join(',')}`);
  rows.push({ ...g, result: 'ok', subsMs: first.ms, actionsMs, subs, actions, problems });
  console.log(`${g.id} ${g.goal} → ok (세부 ${first.ms}ms · 실천 ${actionsMs}ms)${problems.length ? ` ⚠ ${problems.join(' / ')}` : ''}`);
}

const expectMatch = (r) => (r.expect === 'refused' ? r.result === 'refused' : r.expect === 'self_harm' ? r.result === 'self_harm' : r.result === 'ok');
const okRows = rows.filter((r) => r.result === 'ok');
const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const lines = [
  `# AI 초안 평가 — ${label} (${new Date().toISOString().slice(0, 16)}Z)`,
  '',
  `- 기대와 일치 ${rows.filter(expectMatch).length}/${rows.length} · 형식 문제 없는 판 ${okRows.filter((r) => r.problems.length === 0).length}/${okRows.length}`,
  `- 평균 시간: 세부 목표 ${avg(okRows.map((r) => r.subsMs))}ms · 실천(8개 동시) ${avg(okRows.map((r) => r.actionsMs))}ms`,
  '',
  '| id | 목표 | 기대 | 결과 | 문제 |',
  '|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.id} | ${r.goal} | ${r.expect} | ${expectMatch(r) ? '' : '❌ '}${r.result} | ${r.problems.join(' / ')} |`),
  '',
  '## 결과 판 (사람 눈 채점: 영역이 겹치지 않는지 · 오늘 체크할 수 있는 행동인지 · 약/극단 식단/종목/실명 없는지)',
  ...okRows.flatMap((r) => ['', `### ${r.id} ${r.goal}`, ...r.subs.map((sub, i) => `- **${sub || '(빈 칸)'}**: ${r.actions[i].map((a) => a || '(빈 칸)').join(' · ')}`)]),
];
mkdirSync(resolve(root, 'plans/eval-results'), { recursive: true });
const out = resolve(root, `plans/eval-results/${new Date().toISOString().slice(0, 10)}-${label}.md`);
writeFileSync(out, `${lines.join('\n')}\n`);
console.log(`\n→ ${out}`);
