import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import type { RewardedOutcome } from './ads/useRewardedAd';
import { logEvent } from './lib/analytics';
import { dateKey } from './lib/state';

// AI 초안(2.0) 흐름: 서버 주소·키·광고·서버 응답만 가짜로 두고 화면부터 저장까지 봐요.
vi.mock('./lib/analytics', () => ({ logEvent: vi.fn() }));
vi.mock('./ai/config', () => ({
  AI_DRAFT_URL: 'https://example.supabase.co/functions/v1/mandalart-draft',
  AI_PUBLISHABLE_KEY: 'sb_publishable_test',
  isAiConfigured: () => true,
}));
vi.mock('./ai/key', () => ({ getAiKey: vi.fn(async () => `k${'a'.repeat(64)}`) }));

const ad = vi.hoisted(() => ({ outcome: 'rewarded' as RewardedOutcome, watched: 0 }));
vi.mock('./ads/useRewardedAd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ads/useRewardedAd')>();
  return {
    ...actual,
    useRewardedAd: () => ({
      watch: async () => {
        ad.watched += 1;
        return ad.outcome;
      },
      supported: true,
    }),
  };
});

const server = vi.hoisted(() => ({ error: null as string | null, calls: [] as Record<string, unknown>[], failOnce: null as number | null }));

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** 계약(contract/ai-draft.api.md)대로 빈 칸만 채워 돌려주는 가짜 서버. 원격 콘텐츠 요청은 404 로 번들 콘텐츠를 써요 */
const fakeFetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
  if (!String(url).includes('mandalart-draft')) return new Response('{}', { status: 404 });
  const body = JSON.parse(String(init?.body)) as { mode: string; subs: string[]; only: number; actions: string[] };
  server.calls.push(body);
  if (server.error) return json({ ok: false, error: server.error });
  // 실천 한 묶음이 처음 한 번만 플랫폼 오류(546)로 실패하는 경우
  if (body.mode === 'actions' && server.failOnce === body.only) {
    server.failOnce = null;
    return new Response(JSON.stringify({ code: 'WORKER_LIMIT' }), { status: 546 });
  }
  const meta = { model: 'claude-haiku-5-5', promptVersion: 1 };
  if (body.mode === 'subs') return json({ ok: true, mode: 'subs', subs: body.subs.map((t, i) => t || `영역 ${i + 1}`), ...meta });
  const actions = body.actions.map((t, j) => t || `실천 ${body.only + 1}-${j + 1}`);
  return json({ ok: true, mode: 'actions', only: body.only, actions, filled: body.actions.filter((t) => !t).length, ...meta });
});

beforeEach(() => {
  ad.outcome = 'rewarded';
  ad.watched = 0;
  server.error = null;
  server.calls = [];
  server.failOnce = null;
  vi.stubGlobal('fetch', fakeFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(logEvent).mockClear();
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

function saveAi(ai: Record<string, unknown>) {
  window.localStorage.setItem('__ait_storage:mandalart.settings.v1', JSON.stringify({ version: 1, ai }));
}

const savedBoard = () => JSON.parse(window.localStorage.getItem('__ait_storage:mandalart.boards.v1')!).boards[0];
const savedAi = () => JSON.parse(window.localStorage.getItem('__ait_storage:mandalart.settings.v1')!).ai;

describe('App (AI 초안)', () => {
  it('빈 판 홈 → 목표 입력 → 처음 한 번 고지 → 광고 → 미리보기 → 이대로 시작하기 → 홈에 AI 초안 표시', async () => {
    renderAt();
    fireEvent.click(await screen.findByText('AI로 초안 만들기'));
    await screen.findByText('핵심 목표를 적으면 세부 목표 8개와 실천 64개를 채워요');
    expect(screen.getByText('광고를 끝까지 보면 AI가 초안을 만들어요 · 오늘 20번 남았어요')).toBeInTheDocument();
    expect(ad.watched).toBe(0); // 들어오기만 해서는 광고도 고지도 없어요

    fireEvent.click(screen.getByText('토익 900점')); // 예시 칩 → 입력칸
    expect(screen.getByRole('textbox', { name: '핵심 목표' })).toHaveValue('토익 900점');
    fireEvent.click(screen.getByRole('button', { name: '광고 보고 AI 초안 만들기' }));

    await screen.findByText('AI로 초안을 만들어요');
    expect(ad.watched).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    await screen.findByText('시작한 뒤에도 칸을 눌러 고칠 수 있어요');
    expect(ad.watched).toBe(1);
    expect(screen.getByText('AI 초안')).toBeInTheDocument();
    expect(server.calls.filter((c) => c.mode === 'subs')).toHaveLength(1);
    expect(server.calls.filter((c) => c.mode === 'actions')).toHaveLength(8); // 세부 목표마다 하나씩
    expect(screen.getByText('다시 만들기는 광고를 한 번 더 봐요 · 오늘 19번 남았어요')).toBeInTheDocument();

    fireEvent.click(screen.getByText('이대로 시작하기'));
    await screen.findByRole('heading', { level: 1, name: '토익 900점' });
    expect(screen.getByText('AI 초안')).toBeInTheDocument();
    await waitFor(() => expect(savedBoard().aiDraft).toMatchObject({ model: 'claude-haiku-5-5', promptVersion: 1 }));
    expect(savedBoard().subs[7].actions[7]).toBe('실천 8-8');
    expect(savedAi().runs).toEqual({ date: dateKey(), count: 1 });
    expect(savedAi().noticeAt).toEqual(expect.any(Number));
    expect(logEvent).toHaveBeenCalledWith('ai_notice_agree');
    expect(logEvent).toHaveBeenCalledWith('ai_draft_reward', { mode: 'draft', result: 'rewarded' });
    expect(logEvent).toHaveBeenCalledWith('ai_draft_result', { mode: 'draft', result: 'ok', ms: expect.any(Number) });
    expect(logEvent).toHaveBeenCalledWith('ai_draft_apply', { mode: 'draft', filled: 73 });
  });

  it('버튼을 겹쳐 눌러도 고지·광고·서버·횟수는 한 번만', async () => {
    saveBoard('토익 900점');
    renderAt('#/draft');
    const cta = await screen.findByRole('button', { name: '광고 보고 AI 초안 만들기' });
    fireEvent.click(cta);
    fireEvent.click(cta);
    await screen.findByText('AI로 초안을 만들어요');
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    fireEvent.click(cta); // 시트가 닫히며 아래 버튼이 한 번 더 눌린 경우
    await screen.findByText('시작한 뒤에도 칸을 눌러 고칠 수 있어요');
    expect(ad.watched).toBe(1);
    expect(server.calls.filter((c) => c.mode === 'subs')).toHaveLength(1);
    await waitFor(() => expect(savedAi().runs.count).toBe(1));
  });

  it('실천 한 묶음이 서버 일시 오류로 실패하면 한 번만 다시 받아 판을 다 채워요', async () => {
    server.failOnce = 3;
    saveAi({ noticeAt: 1, runs: { date: null, count: 0 } });
    saveBoard('토익 900점');
    renderAt('#/draft');
    fireEvent.click(await screen.findByRole('button', { name: '광고 보고 AI 초안 만들기' }));
    await screen.findByText('시작한 뒤에도 칸을 눌러 고칠 수 있어요');
    expect(server.calls.filter((c) => c.mode === 'actions' && c.only === 3)).toHaveLength(2);
    expect(server.calls.filter((c) => c.mode === 'actions')).toHaveLength(9);
    fireEvent.click(screen.getByText('이대로 시작하기'));
    await waitFor(() => expect(savedBoard().subs[3].actions[7]).toBe('실천 4-8'));
  });

  it('광고를 못 불러오면 AI 를 쓰지 않고 잠시 뒤에 다시 해 달라고 알려요(예시 시작은 2.1 에서 없어짐)', async () => {
    ad.outcome = 'unavailable';
    saveAi({ noticeAt: 1, runs: { date: null, count: 0 } });
    saveBoard('8구단 드래프트 1순위');
    renderAt('#/draft');
    fireEvent.click(await screen.findByRole('button', { name: '광고 보고 AI 초안 만들기' }));
    await screen.findByText('지금은 광고를 불러올 수 없어요');
    expect(screen.getByText('확인')).toBeInTheDocument();
    expect(screen.queryByText('예시로 시작하기')).not.toBeInTheDocument();
    expect(server.calls).toHaveLength(0);
    expect(savedAi().runs.count).toBe(0);
  });

  it('자해·자살 표현이면 광고도 서버도 부르지 않고 109 안내만', async () => {
    saveAi({ noticeAt: 1, runs: { date: null, count: 0 } });
    renderAt('#/draft');
    fireEvent.change(await screen.findByRole('textbox', { name: '핵심 목표' }), { target: { value: '죽고 싶다' } });
    fireEvent.click(screen.getByRole('button', { name: '광고 보고 AI 초안 만들기' }));
    await screen.findByText('지금 마음이 힘들다면');
    expect(screen.getByText('109에 전화하기')).toBeInTheDocument();
    expect(ad.watched).toBe(0);
    expect(server.calls).toHaveLength(0);
    expect(vi.mocked(logEvent).mock.calls.some(([name]) => String(name).startsWith('ai_draft'))).toBe(false);
  });

  it('AI 가 거절하면 입력칸 아래에 안내하고 오늘 횟수에서 빼지 않아요', async () => {
    server.error = 'refused';
    saveAi({ noticeAt: 1, runs: { date: null, count: 0 } });
    saveBoard('도박으로 1억 벌기');
    renderAt('#/draft');
    fireEvent.click(await screen.findByRole('button', { name: '광고 보고 AI 초안 만들기' }));
    await screen.findByText('이 목표로는 초안을 만들 수 없어요. 다른 목표로 적어 보세요.');
    expect(screen.getByText('방금 본 광고는 오늘 횟수에서 빼지 않았어요 · 20번 남았어요')).toBeInTheDocument();
    expect(ad.watched).toBe(1);
    expect(savedAi().runs.count).toBe(0);
  });

  it('오늘 20번(2.1)을 다 썼으면 버튼이 잠기고 안내해요', async () => {
    saveAi({ noticeAt: 1, runs: { date: dateKey(), count: 20 } });
    saveBoard('토익 900점');
    renderAt('#/draft');
    await screen.findByText('오늘 AI 초안 20번을 다 썼어요. 내일 다시 만들 수 있어요');
    expect(screen.getByRole('button', { name: '광고 보고 AI 초안 만들기' })).toBeDisabled();
  });

  it("'AI 초안' 표시는 AI 가 쓴 칸을 사용자가 다 고치면 사라져요(칸 단위)", async () => {
    saveAi({ noticeAt: 1, runs: { date: null, count: 0 } });
    saveBoard('토익 900점', ['듣기'], { 0: ['받아쓰기', '쉐도잉', '팟캐스트', '단어장', '모의고사'] });
    renderAt('#/sub/0');
    fireEvent.click(await screen.findByRole('button', { name: '광고 보고 빈 실천 AI로 채우기' }));
    await waitFor(() => expect(savedBoard().aiDraft?.cells).toEqual([14, 15, 16])); // 실천 1-6~1-8 = AI_CELL 9 + 5·6·7
    // 길게 누르기와 같은 편집 모드(키보드 입구)에서 칸을 눌러 고쳐요
    fireEvent.click(screen.getByRole('button', { name: '편집' }));

    /** 칸을 눌러 시트에서 글을 바꾸고 시트의 '완료' */
    const rewrite = async (name: string, text: string) => {
      fireEvent.click(await screen.findByRole('button', { name }));
      fireEvent.change(await screen.findByRole('textbox'), { target: { value: text } });
      let node: HTMLElement | null = document.getElementById('mandalart-cell-editor');
      while (node && !within(node).queryByText('완료')) node = node.parentElement;
      fireEvent.click(within(node!).getByText('완료'));
      await waitFor(() => expect(document.getElementById('mandalart-cell-editor')).toBeNull());
    };
    await rewrite('실천 1-6', '내가 쓴 실천');
    await waitFor(() => expect(savedBoard().aiDraft?.cells).toEqual([15, 16]));
    await rewrite('실천 1-7', '두 번째');
    await rewrite('실천 1-8', '세 번째');
    await waitFor(() => expect(savedBoard().aiDraft).toBeNull());

    window.location.hash = '#/';
    await screen.findByRole('heading', { level: 1, name: '토익 900점' });
    expect(screen.queryByText('AI 초안')).not.toBeInTheDocument();
  });

  it("칸을 일부 채운 판(2.1): 홈 'AI로 빈 칸 채우기'는 초안 화면 없이 바로 광고 → 그 자리에서 빈 칸만 채워요, 적어 둔 칸은 그대로", async () => {
    saveAi({ noticeAt: 1, runs: { date: null, count: 0 } });
    saveBoard('토익 900점', ['듣기', '', '읽기']); // 빈 칸 = 세부 목표 6 + 실천 64
    renderAt();
    expect(await screen.findByText('빈 칸 70개만 채우고, 적어 둔 칸은 그대로예요. 광고를 끝까지 보면 채워져요 · 오늘 20번 남았어요')).toBeInTheDocument();
    expect(screen.queryByText('AI로 초안 만들기')).not.toBeInTheDocument();
    expect(ad.watched).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: '광고 보고 AI로 빈 칸 채우기' }));

    await waitFor(() =>
      expect(savedBoard().subs.map((s: { title: string }) => s.title)).toEqual(['듣기', '영역 2', '읽기', '영역 4', '영역 5', '영역 6', '영역 7', '영역 8']),
    );
    expect(ad.watched).toBe(1);
    // 초안 화면(목표 고치기·미리보기)에 들어가지 않고 홈 그대로예요
    expect(window.location.hash).not.toBe('#/draft');
    expect(screen.getByRole('heading', { level: 1, name: '토익 900점' })).toBeInTheDocument();
    // 서버에는 사용자가 적은 세부 목표를 그대로 보내요(빈 칸만 채움)
    expect(server.calls.find((c) => c.mode === 'subs')?.subs).toEqual(['듣기', '', '읽기', '', '', '', '', '']);
    expect(savedBoard().subs[0].actions).toEqual(Array.from({ length: 8 }, (_, j) => `실천 1-${j + 1}`));
    expect(logEvent).toHaveBeenCalledWith('ai_draft_start', { mode: 'draft', from: 'partial' });
    expect((await screen.findAllByText('빈 칸 70개를 AI로 채웠어요')).length).toBeGreaterThan(0);
    await waitFor(() => expect(savedAi().runs.count).toBe(1));
    expect(screen.getByText('AI 초안')).toBeInTheDocument();
    // 판이 다 차면 버튼이 사라져요
    await waitFor(() => expect(screen.queryByRole('button', { name: '광고 보고 AI로 빈 칸 채우기' })).not.toBeInTheDocument());
  });

  it('홈 채우기도 처음이면 광고 전에 생성형 AI 고지부터 해요', async () => {
    saveBoard('토익 900점', ['듣기']);
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: '광고 보고 AI로 빈 칸 채우기' }));
    await screen.findByText('AI로 초안을 만들어요');
    expect(ad.watched).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await waitFor(() => expect(savedBoard().subs[1].title).toBe('영역 2'));
    expect(ad.watched).toBe(1);
  });

  it("핵심 목표가 없으면 홈에 'AI로 빈 칸 채우기'가 없어요(가운데 칸부터 적어요)", async () => {
    saveAi({ noticeAt: 1, runs: { date: null, count: 0 } });
    saveBoard('', ['듣기']);
    renderAt();
    await screen.findByText('세부 목표 칸을 눌러 실천을 적어 보세요');
    expect(screen.queryByRole('button', { name: '광고 보고 AI로 빈 칸 채우기' })).not.toBeInTheDocument();
  });

  it("세부 목표 화면(2.1): '빈 실천 AI로 채우기'로 그 세부 목표의 빈 실천만 채워요", async () => {
    saveAi({ noticeAt: 1, runs: { date: null, count: 0 } });
    saveBoard('토익 900점', ['듣기']);
    renderAt('#/sub/0');
    await screen.findByText("'듣기'의 빈 실천 8칸을 채워요. 광고를 끝까지 보면 채워져요 · 오늘 20번 남았어요");
    fireEvent.click(screen.getByRole('button', { name: '광고 보고 빈 실천 AI로 채우기' }));
    await waitFor(() => expect(savedBoard().subs[0].actions).toEqual(Array.from({ length: 8 }, (_, j) => `실천 1-${j + 1}`)));
    expect(server.calls).toEqual([expect.objectContaining({ mode: 'actions', only: 0 })]);
    expect(ad.watched).toBe(1);
    expect(logEvent).toHaveBeenCalledWith('ai_draft_start', { mode: 'actions', from: 'sub' });
    await waitFor(() => expect(screen.queryByRole('button', { name: '광고 보고 빈 실천 AI로 채우기' })).not.toBeInTheDocument());
  });

  it('핵심 목표가 없으면 세부 목표 화면에 채우기 버튼이 없어요', async () => {
    saveAi({ noticeAt: 1, runs: { date: null, count: 0 } });
    saveBoard('', ['듣기']);
    renderAt('#/sub/0');
    await screen.findByText('핵심 목표는 홈 가운데 칸에서 적어요');
    expect(screen.queryByRole('button', { name: '광고 보고 빈 실천 AI로 채우기' })).not.toBeInTheDocument();
  });

  it("핵심 목표만 있는 홈에는 'AI로 초안 만들기'만 있고 '예시로 시작하기'는 없어요(2.1)", async () => {
    saveBoard('내 목표');
    renderAt();
    await screen.findByRole('heading', { level: 1, name: '내 목표' });
    expect(screen.getByText('AI로 초안 만들기')).toBeInTheDocument();
    expect(screen.queryByText('예시로 시작하기')).not.toBeInTheDocument();
  });

  it('칸이 다 찬 판으로 초안 화면에 들어오면(딥링크 등) 광고 버튼이 잠겨요 — 광고만 보고 채울 게 없으니까', async () => {
    saveAi({ noticeAt: 1, runs: { date: null, count: 0 } });
    window.localStorage.setItem(
      '__ait_storage:mandalart.boards.v1',
      JSON.stringify({
        version: 1,
        active: 0,
        boards: [
          {
            id: 'b1759000000000',
            goal: '토익 900점',
            subs: Array.from({ length: 8 }, (_, i) => ({ title: `영역 ${i + 1}`, actions: Array.from({ length: 8 }, (__, j) => `실천 ${i + 1}-${j + 1}`) })),
            templateId: null,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
    );
    renderAt('#/draft');
    await screen.findByText('채울 빈 칸이 없어요. 칸을 비우면 AI가 채울 수 있어요');
    expect(screen.getByRole('button', { name: '광고 보고 AI로 빈 칸 채우기' })).toBeDisabled();
    expect(ad.watched).toBe(0);
  });
});
