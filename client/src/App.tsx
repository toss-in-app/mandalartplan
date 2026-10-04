import { useDialog, useToast } from '@toss/tds-mobile';
import { useCallback, useEffect, useState } from 'react';

import { fetchRemoteContent, getBundledContent, type Content, type ContentTemplate } from './content';
import { useAppState } from './hooks/useAppState';
import { useTemplatePicker } from './hooks/useTemplatePicker';
import { haptic } from './lib/bridge';
import { toggleCheck } from './lib/checkin';
import { CENTER, cellOfRing, getProgress } from './lib/mandalart';
import { goBack, navigate, useRoute } from './lib/router';
import { dateKey } from './lib/state';
import { BlockScreen } from './screens/BlockScreen';
import { HomeScreen } from './screens/HomeScreen';
import { OverviewScreen } from './screens/OverviewScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SubScreen } from './screens/SubScreen';
import { TodayScreen } from './screens/TodayScreen';
import './App.css';

function App() {
  const route = useRoute();
  const app = useAppState();
  const [content, setContent] = useState<Content>(getBundledContent);
  const { openConfirm } = useDialog();
  const toast = useToast();

  /** 예시 템플릿 적용. 이미 적은 글이 있으면 덮어쓸지 먼저 물어요. */
  const pickTemplate = useCallback(
    async (template: ContentTemplate) => {
      const current = app.board;
      if (!current) return;
      if (getProgress(current).filled > 0) {
        const ok = await openConfirm({
          title: '예시로 바꿀까요?',
          description: '지금 적은 내용과 오늘 체크 기록이 예시 내용으로 바뀌어요.',
          confirmButton: '바꾸기',
          cancelButton: '닫기',
        });
        if (!ok) return;
      }
      app.applyTemplate(template);
      toast.openToast(`${template.title} 예시를 넣었어요`);
      navigate({ name: 'home' });
    },
    [app, openConfirm, toast],
  );
  const openTemplatePicker = useTemplatePicker(content, pickTemplate);

  const resetAll = useCallback(async () => {
    const ok = await openConfirm({
      title: '처음부터 다시 만들까요?',
      description: '적은 목표·실천과 체크 기록이 모두 지워져요. 되돌릴 수 없어요.',
      confirmButton: '지우기',
      cancelButton: '닫기',
    });
    if (!ok) return;
    await app.reset();
    toast.openToast('새 만다라트를 시작해요');
    navigate({ name: 'home' });
  }, [app, openConfirm, toast]);

  // 첫 화면은 번들 콘텐츠로 즉시 그리고, 원격은 뒤에서 한 번만 시도해요.
  useEffect(() => {
    let alive = true;
    void fetchRemoteContent().then((remote) => {
      if (alive && remote) setContent(remote);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  const { state, board } = app;
  // 저장된 상태를 읽는 동안(수십 ms)은 빈 화면. 번들 안에서 끝나는 일이라 로더는 두지 않아요.
  if (!state || !board) return null;

  const record = state.checkins.byBoard[board.id];
  const editCore = () => navigate({ name: 'block', block: CENTER });
  const openSub = (subIndex: number) => navigate({ name: 'sub', sub: subIndex });

  /** 실천 칸 탭 = 오늘 했어요 체크/해제. 처음 체크한 순간을 settings 에 남겨요(알림 안내용). */
  const toggleToday = (actionIndex: number) => {
    const now = Date.now();
    void haptic('tap');
    app.updateCheckins((checkins) => toggleCheck(checkins, board.id, dateKey(), actionIndex, now));
    if (state.settings.firstCheckinAt === null) {
      app.updateSettings((settings) => ({ ...settings, firstCheckinAt: now }));
    }
  };

  switch (route.name) {
    case 'sub':
      return (
        <SubScreen
          board={board}
          subIndex={route.sub}
          checkin={record}
          onToggle={toggleToday}
          onEdit={() => navigate({ name: 'block', block: cellOfRing(route.sub) })}
        />
      );
    case 'block':
      return (
        <BlockScreen
          board={board}
          block={route.block}
          onChangeGoal={app.setGoal}
          onChangeSubTitle={app.setSubTitle}
          onChangeAction={app.setAction}
          onDone={goBack}
        />
      );
    case 'overview':
      return <OverviewScreen board={board} checkin={record} onSelectSub={openSub} onEditCore={editCore} />;
    case 'today':
      return <TodayScreen board={board} record={record} content={content} onDone={goBack} />;
    case 'share':
      return <PlaceholderScreen title="만다라트 공유" description="주요 기능 3 — 이미지로 저장하거나 글로 보내요" onDone={goBack} />;
    case 'settings':
      return (
        <SettingsScreen
          content={content}
          notification={state.settings.notification}
          hasAnyText={getProgress(board).filled > 0}
          onPickTemplate={openTemplatePicker}
          onReset={() => void resetAll()}
        />
      );
    default:
      return (
        <HomeScreen
          board={board}
          content={content}
          checkin={record}
          notificationVisible={state.settings.firstCheckinAt !== null && state.settings.notification === 'unknown'}
          onEditCore={editCore}
          onSelectSub={openSub}
          onToday={() => navigate({ name: 'today' })}
          onOverview={() => navigate({ name: 'overview' })}
          onShare={() => navigate({ name: 'share' })}
          onSettings={() => navigate({ name: 'settings' })}
          onStartWithTemplate={openTemplatePicker}
        />
      );
  }
}

export default App;
