import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';

// 3.0.3: AI 초안 리워드를 AI 전용 지면(rewarded-ai-draft)으로. App 은 AI·두 번째 판 설정의 ID 가 같을 때만(테스트 ID, 2.0.0~3.0.2 의 공지 54047 임시 공유)
// '두 번째 판' 훅 하나로 묶어요. 출시 빌드처럼 ID 가 다르면 AI 화면은 AI 지면만, 설정은 두 번째 판 지면만 미리 불러오고, 광고는 미리 불러온 그 훅으로 보는지 봐요.
vi.mock('./lib/analytics', () => ({ logEvent: vi.fn() }));
vi.mock('./ai/config', () => ({
  AI_DRAFT_URL: 'https://example.supabase.co/functions/v1/mandalart-draft',
  AI_PUBLISHABLE_KEY: 'sb_publishable_test',
  isAiConfigured: () => true,
}));
vi.mock('./ai/key', () => ({ getAiKey: vi.fn(async () => `k${'a'.repeat(64)}`) }));

// 테스트마다 ID 를 바꿀 수 있게 App 이 읽을 때마다 ids 를 봐요
const ids = vi.hoisted(() => ({ ai: '', extra: 'ait.v2.live.extra-board' }));
vi.mock('./ads/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ads/config')>();
  return {
    ...actual,
    AD_GROUPS: {
      ...actual.AD_GROUPS,
      get rewardedAiDraft() {
        return ids.ai;
      },
      get rewardedExtraBoard() {
        return ids.extra;
      },
    },
  };
});

// 훅마다 미리 불러오는 지면을 모으고, 광고를 본 훅의 지면을 남겨요 — 미리 불러오지 않던 훅으로 봤으면 표시가 붙어요
const ad = vi.hoisted(() => ({ preloading: new Set<string>(), watched: [] as string[] }));
vi.mock('./ads/useRewardedAd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ads/useRewardedAd')>();
  return {
    ...actual,
    useRewardedAd: (adGroupId: string, active: boolean) => {
      if (active) ad.preloading.add(adGroupId);
      return {
        watch: async () => {
          ad.watched.push(active ? adGroupId : `${adGroupId}(미리 불러오지 않은 훅)`);
          return 'rewarded' as const;
        },
        supported: true,
        free: false,
      };
    },
  };
});

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

/** 빈 칸만 채워 돌려주는 가짜 AI 서버(App.ai.test.tsx 와 같은 모양). 원격 콘텐츠 요청은 404 로 번들 콘텐츠를 써요 */
const fakeFetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
  if (!String(url).includes('mandalart-draft')) return new Response('{}', { status: 404 });
  const body = JSON.parse(String(init?.body)) as { mode: string; subs: string[]; only: number; actions: string[] };
  const meta = { model: 'claude-haiku-5-5', promptVersion: 1 };
  if (body.mode === 'subs') return json({ ok: true, mode: 'subs', subs: body.subs.map((t, i) => t || `영역 ${i + 1}`), ...meta });
  const actions = body.actions.map((t, j) => t || `실천 ${body.only + 1}-${j + 1}`);
  return json({ ok: true, mode: 'actions', only: body.only, actions, filled: body.actions.filter((t) => !t).length, ...meta });
});

beforeEach(() => {
  ids.ai = '';
  ad.preloading = new Set();
  ad.watched = [];
  vi.stubGlobal('fetch', fakeFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fakeFetch.mockClear();
});

function renderAt(hash = '') {
  window.location.hash = hash;
  return render(
    <TDSMobileAITProvider brandPrimaryColor="#6B5CFF">
      <App />
    </TDSMobileAITProvider>,
  );
}

function saveBoard(goal: string, subs: string[] = []) {
  window.localStorage.setItem(
    '__ait_storage:mandalart.boards.v1',
    JSON.stringify({
      version: 1,
      active: 0,
      boards: [
        {
          id: 'b1759000000000',
          goal,
          subs: Array.from({ length: 8 }, (_, i) => ({ title: subs[i] ?? '', actions: Array.from({ length: 8 }, () => '') })),
          templateId: null,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    }),
  );
}

/** 생성형 AI 고지는 이미 본 것으로 */
function saveAiNoticeSeen() {
  window.localStorage.setItem('__ait_storage:mandalart.settings.v1', JSON.stringify({ version: 1, ai: { noticeAt: 1, runs: { date: null, count: 0 } } }));
}

const savedBoard = () => JSON.parse(window.localStorage.getItem('__ait_storage:mandalart.boards.v1')!).boards[0];

describe('App (리워드 광고 지면 — 3.0.3 AI 전용 지면)', () => {
  it("ID 가 다르면(출시 빌드): 홈 'AI로 빈 칸 채우기'는 AI 지면만 미리 불러오고 그 훅으로 광고를 봐요", async () => {
    ids.ai = 'ait.v2.live.ai-draft';
    saveAiNoticeSeen();
    saveBoard('토익 900점', ['듣기']);
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: '광고 보고 AI로 빈 칸 채우기' }));
    await waitFor(() => expect(savedBoard().subs[1].title).toBe('영역 2'));
    expect(ad.watched).toEqual(['ait.v2.live.ai-draft']);
    expect([...ad.preloading]).toEqual(['ait.v2.live.ai-draft']); // 두 번째 판 지면은 홈에서 불러오지 않아요
  });

  it("ID 가 다르면: 설정 '두 번째 만다라트 판'은 두 번째 판 지면만 불러와서 봐요", async () => {
    ids.ai = 'ait.v2.live.ai-draft';
    saveBoard('토익 900점');
    renderAt('#/settings');
    fireEvent.click(await screen.findByText('두 번째 만다라트 판'));
    await screen.findByText('광고를 보고 두 번째 판을 열까요?');
    expect([...ad.preloading]).toEqual(['ait.v2.live.extra-board']); // 설정에서는 AI 지면을 불러오지 않아요
    fireEvent.click(screen.getByRole('button', { name: '광고 보기' }));
    await waitFor(() => expect(screen.getAllByText('두 번째 판을 열었어요').length).toBeGreaterThan(0));
    expect(ad.watched).toEqual(['ait.v2.live.extra-board']);
  });

  it('ID 가 같으면(테스트 ID·2.0.0~3.0.2 공유): AI 도 두 번째 판 훅 하나로 불러오고 그 훅으로 봐요', async () => {
    ids.ai = ids.extra;
    saveAiNoticeSeen();
    saveBoard('토익 900점', ['듣기']);
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: '광고 보고 AI로 빈 칸 채우기' }));
    await waitFor(() => expect(savedBoard().subs[1].title).toBe('영역 2'));
    expect(ad.watched).toEqual(['ait.v2.live.extra-board']); // '(미리 불러오지 않은 훅)' 이 붙지 않아요
  });
});
