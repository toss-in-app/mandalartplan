import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from './App';
import { getBundledContent } from './content';

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
