import { useEffect } from 'react';

import { useBoard } from './hooks/useBoard';
import { goBack, navigate, useRoute } from './lib/router';
import { BlockScreen } from './screens/BlockScreen';
import { HomeScreen } from './screens/HomeScreen';
import './App.css';

function App() {
  const route = useRoute();
  const { board, setGoal, setSubTitle, setAction, toggleDone, reset } = useBoard();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  // 저장된 보드를 읽는 동안(수십 ms)은 빈 화면. 번들 안에서 끝나는 일이라 로더는 두지 않아요.
  if (!board) return null;

  if (route.name === 'block') {
    return (
      <BlockScreen
        board={board}
        block={route.block}
        onChangeGoal={setGoal}
        onChangeSubTitle={setSubTitle}
        onChangeAction={setAction}
        onToggleDone={toggleDone}
        onDone={goBack}
      />
    );
  }

  return <HomeScreen board={board} onSelectBlock={(block) => navigate({ name: 'block', block })} onReset={reset} />;
}

export default App;
