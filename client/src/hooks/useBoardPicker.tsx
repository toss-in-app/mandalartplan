import { colors } from '@toss/tds-colors';
import { List, ListRow, Text, useBottomSheet } from '@toss/tds-mobile';
import { useCallback } from 'react';

import { TOTAL_CELLS, getProgress } from '../lib/mandalart';
import { boardLabel, type BoardsState } from '../lib/state';

/**
 * 판 바꾸기 바텀시트. 판이 2개일 때 홈 제목(Top.TitleSelector)을 누른 뒤에만 열려요.
 * 보고 있는 판은 '보는 중' 으로 표시하고, 다른 판을 누르면 그 판으로 바꿔요.
 */
export function useBoardPicker(boards: BoardsState, onPick: (index: number) => void) {
  const sheet = useBottomSheet();

  return useCallback(() => {
    sheet.open({
      header: '판 바꾸기',
      children: (
        <div style={{ paddingBottom: 16 }}>
          <List>
            {boards.boards.map((board, index) => {
              const active = index === boards.active;
              const goal = board.goal.trim();
              const filled = getProgress(board).filled;
              return (
                <ListRow
                  key={board.id}
                  withArrow={!active}
                  onClick={() => {
                    sheet.close();
                    if (!active) onPick(index);
                  }}
                  contents={
                    <ListRow.Texts
                      type="2RowTypeA"
                      top={goal || boardLabel(index)}
                      bottom={goal ? `${boardLabel(index)} · ${TOTAL_CELLS}칸 중 ${filled}칸` : '아직 비어 있어요'}
                    />
                  }
                  right={
                    active ? (
                      <Text typography="t7" color={colors.grey500}>
                        보는 중
                      </Text>
                    ) : undefined
                  }
                />
              );
            })}
          </List>
        </div>
      ),
      onClose: () => sheet.close(),
    });
  }, [sheet, boards, onPick]);
}
