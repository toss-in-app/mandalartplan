import { useEffect, useState } from 'react';

import { fetchRemoteContent, getBundledContent, type Content } from './content';
import { useAppState } from './hooks/useAppState';
import { applyCheckin } from './lib/checkin';
import { goBack, navigate, useRoute } from './lib/router';
import { dateKey } from './lib/state';
import { BlockScreen } from './screens/BlockScreen';
import { CheckinScreen } from './screens/CheckinScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import './App.css';

function App() {
  const route = useRoute();
  const app = useAppState();
  const [content, setContent] = useState<Content>(getBundledContent);

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

  switch (route.name) {
    case 'block':
      return (
        <BlockScreen
          board={board}
          block={route.block}
          onChangeGoal={app.setGoal}
          onChangeSubTitle={app.setSubTitle}
          onChangeAction={app.setAction}
          onToggleDone={app.toggleDone}
          onDone={goBack}
        />
      );
    case 'checkin':
      return (
        <CheckinScreen
          board={board}
          record={state.checkins.byBoard[board.id]}
          content={content}
          isFirstEver={state.settings.firstCheckinAt === null}
          onComplete={(indices) => {
            const now = Date.now();
            app.updateCheckins((checkins) => applyCheckin(checkins, board.id, dateKey(), indices, now));
            if (state.settings.firstCheckinAt === null) {
              app.updateSettings((settings) => ({ ...settings, firstCheckinAt: now }));
            }
          }}
          onDone={goBack}
        />
      );
    case 'share':
      return <PlaceholderScreen title="만다라트 공유" description="주요 기능 3 — 이미지로 저장하거나 글로 보내요" onDone={goBack} />;
    case 'settings':
      return <PlaceholderScreen title="설정" description="알림·템플릿·두 번째 판·초기화·약관" onDone={goBack} />;
    default:
      return (
        <HomeScreen
          board={board}
          content={content}
          checkin={state.checkins.byBoard[board.id]}
          notificationVisible={state.settings.firstCheckinAt !== null && state.settings.notification === 'unknown'}
          onSelectBlock={(block) => navigate({ name: 'block', block })}
          onCheckin={() => navigate({ name: 'checkin' })}
          onShare={() => navigate({ name: 'share' })}
          onSettings={() => navigate({ name: 'settings' })}
        />
      );
  }
}

export default App;
