import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import type { useRewardedAd } from './ads/useRewardedAd';
import { getBundledContent } from './content';
import { saveImageToPhotos } from './lib/bridge';
import { dateKey } from './lib/state';
import { fakeCanvasContext } from './test/fakeCanvas';

// 사진첩 저장 브릿지만 가짜로(권한 요청 → File.saveBase64 는 토스앱에서만 실제 동작). 나머지 브릿지는 Devtools mock 그대로.
vi.mock('./lib/bridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/bridge')>()),
  saveImageToPhotos: vi.fn(async () => 'saved' as const),
}));

// 리워드 광고 훅: 기본은 진짜(Devtools mock 은 끝까지 봐도 userEarnedReward 를 주지 않아요). 보상 경로를 보려는 테스트만 impl 을 바꿔요.
const rewarded = vi.hoisted(() => ({ impl: null as null | typeof useRewardedAd }));
vi.mock('./ads/useRewardedAd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ads/useRewardedAd')>();
  return { ...actual, useRewardedAd: (adGroupId: string, active: boolean) => (rewarded.impl ?? actual.useRewardedAd)(adGroupId, active) };
});

/** 브라우저(jsdom)에는 앱인토스 브릿지가 없어요 → Storage 는 localStorage 로 대체돼요. */
function renderApp() {
  window.location.hash = '';
  return render(
    <TDSMobileAITProvider brandPrimaryColor="#6B5CFF">
      <App />
    </TDSMobileAITProvider>,
  );
}

describe('App (설정·예시 템플릿)', () => {
  it('빈 판 홈에서 예시를 넣으면 핵심 목표가 바뀌고, 설정에서 처음부터 다시 만들면 비워져요', async () => {
    renderApp();
    const template = getBundledContent().templates[0];

    // 빈 판: 홈 안내 + '예시로 시작하기'
    await screen.findByText('가운데 칸을 눌러 핵심 목표부터 정해 보세요');
    fireEvent.click(screen.getByText('예시로 시작하기'));

    // 바텀시트에서 템플릿 선택 → 빈 판이라 확인 없이 바로 적용
    fireEvent.click(await screen.findByText(template.title));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(template.goal));
    expect(screen.getAllByText(`${template.title} 예시를 넣었어요`).length).toBeGreaterThan(0); // 토스트는 읽기용 사본이 하나 더 있어요

    // 설정 → 처음부터 다시 만들기 → 확인 다이얼로그(왼쪽 '닫기') → '지우기'
    fireEvent.click(screen.getByText('설정'));
    await screen.findByText('예시 템플릿 불러오기');
    expect(screen.getByText(/앱 \d+\.\d+\.\d+ · 콘텐츠 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('처음부터 다시 만들기'));
    await screen.findByText('처음부터 다시 만들까요?');
    expect(screen.getByText('닫기')).toBeInTheDocument();
    fireEvent.click(screen.getByText('지우기'));

    await screen.findByText('가운데 칸을 눌러 핵심 목표부터 정해 보세요');
    expect(window.localStorage.getItem('mandalart.boards.v1')).toContain('"goal":""');
  });

  it('글이 있는 판에 예시를 넣으려 하면 먼저 물어보고, 닫기를 누르면 그대로예요', async () => {
    // 테스트에서는 AIT Devtools mock 이 Storage 를 `__ait_storage:` 접두어 localStorage 로 흉내 내요
    window.localStorage.setItem(
      '__ait_storage:mandalart.boards.v1',
      JSON.stringify({
        version: 1,
        active: 0,
        boards: [{ id: 'b1759000000000', goal: '내 목표', subs: Array.from({ length: 8 }, () => ({ title: '', actions: Array(8).fill('') })), templateId: null, createdAt: 1, updatedAt: 1 }],
      }),
    );
    renderApp();
    await screen.findByRole('heading', { level: 1, name: '내 목표' });

    fireEvent.click(screen.getByText('설정'));
    fireEvent.click(await screen.findByText('예시 템플릿 불러오기'));
    fireEvent.click(await screen.findByText(getBundledContent().templates[1].title));
    await screen.findByText('예시로 바꿀까요?');
    fireEvent.click(screen.getByText('닫기'));
    await waitFor(() => expect(screen.queryByText('예시로 바꿀까요?')).not.toBeInTheDocument());
    // 설정 화면에 그대로 있고, 판은 바뀌지 않았어요 (mock Storage 키로 확인)
    expect(screen.getByText('예시 템플릿 불러오기')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('__ait_storage:mandalart.boards.v1')!).boards[0].goal).toBe('내 목표');
  });
});

describe('App (공유)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(saveImageToPhotos).mockClear();
  });

  it('홈의 공유 버튼으로 공유 화면에 가고, 저장을 누르면 PNG 본문과 날짜 파일명으로 사진첩 저장 브릿지를 불러요', async () => {
    const { ctx } = fakeCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,QUJD');
    window.localStorage.setItem(
      '__ait_storage:mandalart.boards.v1',
      JSON.stringify({
        version: 1,
        active: 0,
        boards: [{ id: 'b1759000000000', goal: '건강한 한 해', subs: Array.from({ length: 8 }, () => ({ title: '', actions: Array(8).fill('') })), templateId: null, createdAt: 1, updatedAt: 1 }],
      }),
    );
    renderApp();
    await screen.findByRole('heading', { level: 1, name: '건강한 한 해' });
    fireEvent.click(screen.getByText('공유'));

    await screen.findByText('오늘 체크까지 담은 9×9 이미지예요');
    expect(screen.getByText('글로 공유하기')).toBeInTheDocument();
    expect(screen.getByText('링크 공유하기')).toBeInTheDocument();
    expect((screen.getByAltText('만다라트 9×9 이미지 미리보기') as HTMLImageElement).src).toBe('data:image/png;base64,QUJD');

    fireEvent.click(screen.getByText('이미지 저장하기'));
    await waitFor(() => expect(screen.getAllByText('사진에 저장했어요').length).toBeGreaterThan(0));
    expect(saveImageToPhotos).toHaveBeenCalledWith('QUJD', `mandalart-${dateKey()}.png`);

    // 글로 공유: Devtools mock 의 Share.sendMessage 가 받아요(jsdom 은 navigator.share 없음 → 콘솔 출력)
    fireEvent.click(screen.getByText('글로 공유하기'));
    await waitFor(() => expect(screen.queryByText('지금은 공유할 수 없어요')).not.toBeInTheDocument());
  });

  it('캔버스가 없는 환경에서는 미리보기 안내만 보이고 저장은 비활성이에요', async () => {
    window.location.hash = '#/share';
    window.localStorage.setItem(
      '__ait_storage:mandalart.boards.v1',
      JSON.stringify({
        version: 1,
        active: 0,
        boards: [{ id: 'b1759000000000', goal: '건강한 한 해', subs: Array.from({ length: 8 }, () => ({ title: '', actions: Array(8).fill('') })), templateId: null, createdAt: 1, updatedAt: 1 }],
      }),
    );
    render(
      <TDSMobileAITProvider brandPrimaryColor="#6B5CFF">
        <App />
      </TDSMobileAITProvider>,
    );
    await screen.findByText('미리보기를 만들 수 없어요');
    expect(screen.getByText('이미지 저장하기').closest('button')).toBeDisabled();
    window.location.hash = '';
  });
});

describe('App (광고)', () => {
  const boards = JSON.stringify({
    version: 1,
    active: 0,
    boards: [
      {
        id: 'b1759000000000',
        goal: '건강한 한 해',
        subs: Array.from({ length: 8 }, (_, i) => ({ title: i === 0 ? '운동' : '', actions: i === 0 ? ['아침 스트레칭', ...Array(7).fill('')] : Array(8).fill('') })),
        templateId: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  });

  it("오늘 체크가 있으면 '오늘 기록 보기' 에서 전면 광고를 보여준 뒤 오늘 기록으로 가고, 날짜를 남겨 하루 1회만", async () => {
    window.localStorage.setItem('__ait_storage:mandalart.boards.v1', boards);
    window.localStorage.setItem('__ait_storage:mandalart.checkins.v1', JSON.stringify({ version: 1, byBoard: { b1759000000000: { days: { [dateKey()]: [0] }, lastCompletedAt: 1 } } }));
    renderApp();
    await screen.findByRole('heading', { level: 1, name: '건강한 한 해' });
    // 전면 광고 사전 로딩(Devtools mock: 200ms 뒤 loaded)
    await new Promise((r) => setTimeout(r, 400));
    fireEvent.click(screen.getByText('오늘 기록 보기'));
    // mock: 1.5초 뒤 dismissed → today
    await screen.findByText('오늘 기록', {}, { timeout: 4000 });
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem('__ait_storage:mandalart.settings.v1')!).ads.lastInterstitialDate).toBe(dateKey()));
    // 오늘 기록 하단 배너(mock 자리표시)
    await waitFor(() => expect(screen.getByTestId('ad-banner').querySelector('[data-ait-slot-id]')).not.toBeNull());
  });

  it("공유 '고화질로 저장' 은 안내 → 광고 → 보상이 없으면 저장하지 않아요", async () => {
    window.localStorage.setItem('__ait_storage:mandalart.boards.v1', boards);
    window.location.hash = '#/share';
    render(
      <TDSMobileAITProvider brandPrimaryColor="#6B5CFF">
        <App />
      </TDSMobileAITProvider>,
    );
    fireEvent.click(await screen.findByText('고화질로 저장'));
    await screen.findByText('광고를 보고 고화질로 저장할까요?');
    fireEvent.click(screen.getByRole('button', { name: '광고 보기' })); // 행의 오른쪽 글에도 '광고 보기' 가 있어요
    // Devtools mock 은 userEarnedReward 를 주지 않아요 → 끝까지 보라는 안내, 저장 브릿지 호출 없음
    await waitFor(() => expect(screen.getAllByText('광고를 끝까지 보면 고화질로 저장할 수 있어요').length).toBeGreaterThan(0), { timeout: 6000 });
    expect(saveImageToPhotos).not.toHaveBeenCalled();
    window.location.hash = '';
  });
});

describe('App (알림 동의)', () => {
  it('첫 체크 뒤 홈 행을 누르면 동의 화면(mock: newAgreement) → 받는 중으로 저장되고 행이 사라져요', async () => {
    window.localStorage.setItem(
      '__ait_storage:mandalart.boards.v1',
      JSON.stringify({
        version: 1,
        active: 0,
        boards: [
          {
            id: 'b1759000000000',
            goal: '건강한 한 해',
            subs: Array.from({ length: 8 }, (_, i) => ({ title: i === 0 ? '운동' : '', actions: i === 0 ? ['아침 스트레칭', ...Array(7).fill('')] : Array(8).fill('') })),
            templateId: null,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
    );
    renderApp();
    await screen.findByRole('heading', { level: 1, name: '건강한 한 해' });
    expect(screen.queryByText('매일 저녁 알림 받기')).not.toBeInTheDocument(); // 아직 체크 전

    // 세부 목표 1 → 실천 탭(첫 체크) → 홈으로
    fireEvent.click(screen.getByRole('button', { name: '운동' }));
    fireEvent.click(await screen.findByRole('button', { name: '아침 스트레칭, 오늘 아직' }));
    window.history.back();
    await screen.findByText('매일 저녁 알림 받기');

    fireEvent.click(screen.getByText('매일 저녁 알림 받기'));
    await waitFor(() => expect(screen.getAllByText('매일 저녁 9시에 알림을 보내요').length).toBeGreaterThan(0));
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem('__ait_storage:mandalart.settings.v1')!).notification).toBe('agreed'));
    expect(screen.queryByText('매일 저녁 알림 받기')).not.toBeInTheDocument();

    // 설정 행은 '받는 중', 다시 누르면 끄는 길 안내
    fireEvent.click(screen.getByText('설정'));
    await screen.findByText('받는 중');
    fireEvent.click(screen.getByText('매일 저녁 알림'));
    await waitFor(() => expect(screen.getAllByText('알림은 토스 앱의 알림 설정에서 끌 수 있어요').length).toBeGreaterThan(0));
  });
});

describe('App (두 번째 판)', () => {
  const boards = JSON.stringify({
    version: 1,
    active: 0,
    boards: [
      {
        id: 'b1759000000000',
        goal: '건강한 한 해',
        subs: Array.from({ length: 8 }, (_, i) => ({ title: i === 0 ? '운동' : '', actions: i === 0 ? ['아침 스트레칭', ...Array(7).fill('')] : Array(8).fill('') })),
        templateId: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  });
  const settings = (extraBoard: boolean) =>
    JSON.stringify({ version: 1, notification: 'unknown', unlocks: { extraBoard }, seenContentVersion: 0, firstCheckinAt: null, backup: { enabled: false, key: null, lastBackupAt: null }, ads: { lastInterstitialDate: null } });

  afterEach(() => {
    rewarded.impl = null;
  });
  /** 홈 제목 셀렉터(Top.TitleSelector). 3×3 가운데 칸 버튼도 핵심 목표를 이름으로 가져서 제목 영역 안에서만 찾아요 */
  const titleSelector = () => within(screen.getByRole('heading', { level: 1 })).getByRole('button');

  it('설정 행 → 안내 → 리워드 보상(userEarnedReward)이면 잠금 해제 + 빈 두 번째 판 → 홈 제목이 셀렉터, 판을 바꾸면 체크 기록도 판별', async () => {
    rewarded.impl = () => ({ watch: async () => 'rewarded' as const, supported: true });
    window.localStorage.setItem('__ait_storage:mandalart.boards.v1', boards);
    window.localStorage.setItem('__ait_storage:mandalart.checkins.v1', JSON.stringify({ version: 1, byBoard: { b1759000000000: { days: { [dateKey()]: [0] }, lastCompletedAt: 1 } } }));
    renderApp();
    await screen.findByRole('heading', { level: 1, name: '건강한 한 해' });
    expect(screen.getByText('1 / 1')).toBeInTheDocument(); // 첫 판: 오늘 1개 / 실천 1개

    fireEvent.click(screen.getByText('설정'));
    await screen.findByText('광고를 보면 판을 하나 더 만들 수 있어요');
    fireEvent.click(screen.getByText('두 번째 만다라트 판'));
    await screen.findByText('광고를 보고 두 번째 판을 열까요?');
    expect(screen.getByText('닫기')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '광고 보기' }));

    // 보상 → 잠금 해제 저장, 판 2개(두 번째가 보이는 판), 홈으로
    await waitFor(() => expect(screen.getAllByText('두 번째 판을 열었어요').length).toBeGreaterThan(0));
    await waitFor(() => expect(titleSelector()).toHaveTextContent('두 번째 판'));
    expect(screen.getByText('가운데 칸을 눌러 핵심 목표부터 정해 보세요')).toBeInTheDocument();
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem('__ait_storage:mandalart.settings.v1')!).unlocks.extraBoard).toBe(true);
      const saved = JSON.parse(window.localStorage.getItem('__ait_storage:mandalart.boards.v1')!);
      expect(saved.boards).toHaveLength(2);
      expect(saved.active).toBe(1);
    });

    // 제목 → 판 바꾸기 시트 → 첫 판으로. 체크 기록(오늘 1개)은 첫 판의 것
    fireEvent.click(titleSelector());
    await screen.findByText('판 바꾸기');
    expect(screen.getByText('보는 중')).toBeInTheDocument();
    fireEvent.click(screen.getByText('건강한 한 해'));
    await waitFor(() => expect(titleSelector()).toHaveTextContent('건강한 한 해'));
    expect(screen.getByText('1 / 1')).toBeInTheDocument();

    // 설정 행은 '사용 중'
    fireEvent.click(screen.getByText('설정'));
    await screen.findByText('사용 중');
    expect(screen.queryByText('광고 보기')).not.toBeInTheDocument();
  });

  it('광고를 끝까지 보지 않으면(Devtools mock: dismissed) 잠금 그대로예요', async () => {
    window.localStorage.setItem('__ait_storage:mandalart.boards.v1', boards);
    window.location.hash = '#/settings';
    render(
      <TDSMobileAITProvider brandPrimaryColor="#6B5CFF">
        <App />
      </TDSMobileAITProvider>,
    );
    fireEvent.click(await screen.findByText('두 번째 만다라트 판'));
    await screen.findByText('광고를 보고 두 번째 판을 열까요?');
    fireEvent.click(screen.getByRole('button', { name: '광고 보기' }));
    await waitFor(() => expect(screen.getAllByText('광고를 끝까지 보면 두 번째 판을 열 수 있어요').length).toBeGreaterThan(0), { timeout: 6000 });
    expect(screen.getByText('광고 보기')).toBeInTheDocument(); // 행 그대로
    const saved = window.localStorage.getItem('__ait_storage:mandalart.settings.v1');
    expect(saved === null || JSON.parse(saved).unlocks.extraBoard === false).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('__ait_storage:mandalart.boards.v1')!).boards).toHaveLength(1);
    window.location.hash = '';
  });

  it('이미 열렸는데 판이 하나면(처음부터 다시 만든 뒤) 광고 없이 빈 판을 더하고, 초기화 안내는 두 판을 말해요', async () => {
    window.localStorage.setItem('__ait_storage:mandalart.boards.v1', boards);
    window.localStorage.setItem('__ait_storage:mandalart.settings.v1', settings(true));
    window.location.hash = '#/settings';
    render(
      <TDSMobileAITProvider brandPrimaryColor="#6B5CFF">
        <App />
      </TDSMobileAITProvider>,
    );
    await screen.findByText('빈 판을 하나 더 만들어요');
    fireEvent.click(screen.getByText('두 번째 만다라트 판'));
    await waitFor(() => expect(screen.getAllByText('두 번째 판을 만들었어요').length).toBeGreaterThan(0));
    await waitFor(() => expect(titleSelector()).toHaveTextContent('두 번째 판'));

    fireEvent.click(screen.getByText('설정'));
    fireEvent.click(await screen.findByText('처음부터 다시 만들기'));
    await screen.findByText('두 판에 적은 목표·실천과 체크 기록이 모두 지워져요. 되돌릴 수 없어요.');
    fireEvent.click(screen.getByText('지우기'));
    await screen.findByText('가운데 칸을 눌러 핵심 목표부터 정해 보세요');
    expect(screen.getByRole('heading', { level: 1, name: '만다라트' })).toBeInTheDocument(); // 판 하나 → 제목은 다시 문단
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem('__ait_storage:mandalart.boards.v1')!).boards).toHaveLength(1));
    expect(JSON.parse(window.localStorage.getItem('__ait_storage:mandalart.settings.v1')!).unlocks.extraBoard).toBe(true); // 잠금 해제는 남아요
    window.location.hash = '';
  });
});
