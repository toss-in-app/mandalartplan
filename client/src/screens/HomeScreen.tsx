import { colors } from '@toss/tds-colors';
import { Button, ProgressBar, Text, Top, useDialog, useToast } from '@toss/tds-mobile';

import { MandalartGrid } from '../components/MandalartGrid';
import { shareText } from '../lib/bridge';
import { boardToText, getProgress, type Board } from '../lib/mandalart';
import { brandColor } from '../theme';

interface HomeScreenProps {
  board: Board;
  onSelectBlock: (block: number) => void;
  onReset: () => Promise<void>;
}

export function HomeScreen({ board, onSelectBlock, onReset }: HomeScreenProps) {
  const { openConfirm } = useDialog();
  const toast = useToast();

  const progress = getProgress(board);
  const hasGoal = board.goal.trim().length > 0;
  const isEmpty = progress.filled === 0;
  const percent = Math.round((progress.done / progress.totalActions) * 100);

  const handleShare = async () => {
    const result = await shareText(boardToText(board));
    if (result === 'copied') toast.openToast('만다라트를 글로 복사했어요');
    if (result === 'failed') toast.openToast('지금은 공유할 수 없어요');
  };

  const handleReset = async () => {
    const confirmed = await openConfirm({
      title: '처음부터 다시 만들까요?',
      description: '지금까지 적은 목표와 실천 항목이 모두 지워져요.',
      confirmButton: '지우기',
      cancelButton: '닫기',
    });
    if (!confirmed) return;
    await onReset();
    toast.openToast('새 만다라트를 시작해요');
  };

  return (
    <>
      <Top
        title={<Top.TitleParagraph size={22}>{hasGoal ? board.goal : '만다라트'}</Top.TitleParagraph>}
        subtitleBottom={
          <Top.SubtitleParagraph size={17}>
            {isEmpty
              ? '가운데 칸을 눌러 핵심 목표부터 정해 보세요'
              : `${progress.filled}칸 작성 · 실천 ${progress.done}/${progress.totalActions}`}
          </Top.SubtitleParagraph>
        }
        right={
          <Top.RightButton color="dark" variant="weak" disabled={isEmpty} onClick={handleShare}>
            공유
          </Top.RightButton>
        }
      />

      <MandalartGrid board={board} onSelectBlock={onSelectBlock} />

      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text typography="t7" color={colors.grey600}>
            실천 진행률
          </Text>
          <Text typography="t7" color={colors.grey800} fontWeight="semibold">
            {percent}%
          </Text>
        </div>
        <ProgressBar size="normal" color={brandColor} progress={progress.done / progress.totalActions} animate />
      </div>

      <div style={{ padding: '32px 20px 40px' }}>
        <Button color="dark" variant="weak" display="full" size="large" disabled={isEmpty} onClick={handleReset}>
          처음부터 다시 만들기
        </Button>
      </div>
    </>
  );
}
