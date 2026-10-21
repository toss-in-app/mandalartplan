import { Top } from '@toss/tds-mobile';

/**
 * Top 오른쪽의 '완료' — 홈·세부 목표 화면의 제자리 편집 모드(`hooks/useGridEdit`)에서만 보여요.
 * 평소에도 자리는 잡아 둬요: '완료'가 생기며 부제 줄바꿈이 바뀌면 길게 누르는 중에 3×3 이 손가락 밑에서 밀려 내려가요.
 * 안 보일 때는 누를 수도, 읽을 수도 없어요(visibility·aria-hidden).
 */
export function EditDoneButton({ editing, onClick }: { editing: boolean; onClick: () => void }) {
  return (
    <span style={{ visibility: editing ? 'visible' : 'hidden' }} aria-hidden={editing ? undefined : true}>
      <Top.RightButton onClick={onClick}>완료</Top.RightButton>
    </span>
  );
}
