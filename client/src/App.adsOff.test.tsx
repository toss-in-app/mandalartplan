import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { logEvent } from './lib/analytics';
import { dateKey } from './lib/state';

/**
 * 3.0.1: 전면·리워드 광고를 띄우지 않는 동안(.env VITE_FULL_SCREEN_ADS=off, 배너만) — 사용자 2026-10-22 결정.
 * 3.0.4 도 같은 off 에 배너까지 꺼요(VITE_BANNER_ADS=off — 사용자 2026-10-29 '광고 다 떼어버려'). 배너 끔은 records.test.tsx·AdBanner.test.tsx 에서 봐요.
 * 테스트 기본은 on(vite.config test.env)이라 여기서만 off 로 두고, 광고 브릿지를 한 번도 부르지 않는지와 광고 없이 기능이 열리는지 봐요.
 */
vi.mock('./lib/analytics', () => ({ logEvent: vi.fn() }));
vi.mock('./ai/config', () => ({
  AI_DRAFT_URL: 'https://example.supabase.co/functions/v1/mandalart-draft',
  AI_PUBLISHABLE_KEY: 'sb_publishable_test',
  isAiConfigured: () => true,
}));
vi.mock('./ai/key', () => ({ getAiKey: vi.fn(async () => `k${'a'.repeat(64)}`) }));

const bridge = vi.hoisted(() => ({ loaded: 0, shown: 0 }));
vi.mock('@apps-in-toss/web-framework', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apps-in-toss/web-framework')>();
  return {
    ...actual,
    loadFullScreenAd: Object.assign(
      () => {
        bridge.loaded += 1;
        return () => {};
      },
      { isSupported: () => true },
    ),
    showFullScreenAd: Object.assign(
      () => {
        bridge.shown += 1;
        return () => {};
      },
      { isSupported: () => true },
    ),
  };
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** 계약대로 빈 칸만 채워 돌려주는 가짜 AI 서버. 원격 콘텐츠 요청은 404 로 번들 콘텐츠를 써요 */
const serverCalls: Record<string, unknown>[] = [];
const fakeFetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
  if (!String(url).includes('mandalart-draft')) return new Response('{}', { status: 404 });
  const body = JSON.parse(String(init?.body)) as { mode: string; subs: string[]; only: number; actions: string[] };
  serverCalls.push(body);
  const meta = { model: 'claude-haiku-5-5', promptVersion: 1 };
  if (body.mode === 'subs') return json({ ok: true, mode: 'subs', subs: body.subs.map((t, i) => t || `영역 ${i + 1}`), ...meta });
  const actions = body.actions.map((t, j) => t || `실천 ${body.only + 1}-${j + 1}`);
  return json({ ok: true, mode: 'actions', only: body.only, actions, filled: body.actions.filter((t) => !t).length, ...meta });
});

beforeEach(() => {
  vi.stubEnv('VITE_FULL_SCREEN_ADS', 'off');
  bridge.loaded = 0;
  bridge.shown = 0;
  serverCalls.length = 0;
  vi.stubGlobal('fetch', fakeFetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.mocked(logEvent).mockClear();
});

function renderAt(hash = '') {
  window.location.hash = hash;
  return render(
    <TDSMobileAITProvider brandPrimaryColor="#6B5CFF">
      <App />
    </TDSMobileAITProvider>,
  );
}

function saveBoard(goal: string, subs: string[] = [], actions: Record<number, string[]> = {}) {
  window.localStorage.setItem(
    '__ait_storage:mandalart.boards.v1',
    JSON.stringify({
      version: 1,
      active: 0,
      boards: [
        {
          id: 'b1759000000000',
          goal,
          subs: Array.from({ length: 8 }, (_, i) => ({ title: subs[i] ?? '', actions: Array.from({ length: 8 }, (__, j) => actions[i]?.[j] ?? '') })),
          templateId: null,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    }),
  );
}

const saveSettings = (settings: Record<string, unknown>) => window.localStorage.setItem('__ait_storage:mandalart.settings.v1', JSON.stringify({ version: 1, ...settings }));
const savedBoards = () => JSON.parse(window.localStorage.getItem('__ait_storage:mandalart.boards.v1')!).boards as unknown[];
const savedSettings = () => JSON.parse(window.localStorage.getItem('__ait_storage:mandalart.settings.v1')!);

describe('App (3.0.1 전면·리워드 광고 끔, 배너만)', () => {
  it('AI 초안: AD 표시·광고 문구 없이 바로 만들고, 광고 브릿지는 부르지 않고, ai_draft_reward 도 보내지 않아요', async () => {
    saveSettings({ ai: { noticeAt: 1, runs: { date: null, count: 0 } } });
    saveBoard('올해 10kg 감량');
    renderAt('#/draft');
    const cta = await screen.findByRole('button', { name: 'AI 초안 만들기' });
    expect(screen.queryByRole('button', { name: '광고 보고 AI 초안 만들기' })).not.toBeInTheDocument();
    expect(screen.getByText('AI가 세부 목표와 실천 초안을 만들어요 · 오늘 20번 남았어요')).toBeInTheDocument();
    fireEvent.click(cta);
    await screen.findByText('시작한 뒤에도 칸을 눌러 고칠 수 있어요');
    expect(serverCalls.filter((c) => c.mode === 'subs')).toHaveLength(1);
    expect(bridge.loaded).toBe(0);
    expect(bridge.shown).toBe(0);
    expect(logEvent).toHaveBeenCalledWith('ai_draft_start', { mode: 'draft', from: 'new' });
    expect(logEvent).not.toHaveBeenCalledWith('ai_draft_reward', expect.anything());
    expect(screen.getByText(/다시 만들면 오늘 횟수를 한 번 더 써요 · 오늘 (19|20)번 남았어요/)).toBeInTheDocument(); // 서버가 답하면 횟수 1 사용
    expect(screen.getByRole('button', { name: '다시 만들기' })).toBeInTheDocument();
  });

  it("홈: 빈 판 안내가 '목표를 적으면'이고, 오늘 체크가 있어도 '기록 보기'에 AD 표시·사전 안내가 없고 전면 광고를 불러오지 않아요", async () => {
    saveBoard('건강한 한 해', ['꾸준한 운동'], { 0: ['아침 스트레칭'] });
    window.localStorage.setItem('__ait_storage:mandalart.checkins.v1', JSON.stringify({ version: 1, byBoard: { b1759000000000: { days: { [dateKey()]: [0] }, lastCompletedAt: 1 } } }));
    renderAt();
    expect(await screen.findByRole('button', { name: '기록 보기' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '광고 보고 기록 보기' })).not.toBeInTheDocument();
    expect(screen.queryByText('기록 보기를 누르면 광고가 한 번 나와요. 오늘은 그 뒤로 광고 없이 볼 수 있어요.')).not.toBeInTheDocument();
    // 'AI로 빈 칸 채우기'(칸을 일부 채운 판)도 AD 표시·'광고 보고' 없이
    expect(screen.getByRole('button', { name: 'AI로 빈 칸 채우기' })).toBeInTheDocument();
    expect(screen.queryByText(/광고를 끝까지 보면/)).not.toBeInTheDocument();
    await waitFor(() => expect(bridge.loaded).toBe(0));

    window.localStorage.clear();
    saveBoard('');
    renderAt();
    expect(await screen.findByText('목표를 적으면 AI가 세부 목표와 실천을 채워요.')).toBeInTheDocument();
  });

  it("설정 '두 번째 만다라트 판': 안내·광고 없이 '만들기'로 바로 열리고 reward_unlock 은 보내지 않아요", async () => {
    saveBoard('건강한 한 해', ['꾸준한 운동']);
    renderAt('#/settings');
    expect(await screen.findByText('만들기')).toBeInTheDocument();
    expect(screen.queryByText('광고 보기')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('두 번째 만다라트 판'));
    expect(screen.queryByText('광고를 보고 두 번째 판을 열까요?')).not.toBeInTheDocument();
    await waitFor(() => expect(savedBoards()).toHaveLength(2));
    expect(savedSettings().unlocks.extraBoard).toBe(true);
    expect(logEvent).toHaveBeenCalledWith('board_add', { boards: 2 });
    expect(logEvent).not.toHaveBeenCalledWith('reward_unlock', expect.anything());
    expect(bridge.loaded).toBe(0);
    expect(bridge.shown).toBe(0);
  });
});
