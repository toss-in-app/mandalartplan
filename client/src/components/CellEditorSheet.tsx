import { colors } from '@toss/tds-colors';
import { BottomSheet, Text, TextArea } from '@toss/tds-mobile';

import { EDITOR_INPUT_ID, focusEditor, type CellEditTarget } from '../lib/cellEdit';
import { CENTER, MAX_TEXT } from '../lib/mandalart';
import { brandColor, withAlpha } from '../theme';

/** 지금 적는 칸이 3×3 의 어디인지 보여주는 작은 아이콘(장식, 읽지 않음) */
function CellPositionIcon({ cell }: { cell: number }) {
  return (
    <span aria-hidden style={{ display: 'inline-grid', gridTemplateColumns: 'repeat(3, 6px)', gap: 2, flexShrink: 0 }}>
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 1.5,
            background: i === cell ? brandColor : i === CENTER ? withAlpha(brandColor, 0.35) : colors.grey200,
          }}
        />
      ))}
    </span>
  );
}

interface CellEditorSheetProps {
  target: CellEditTarget | null;
  draft: string;
  onDraft: (text: string) => void;
  onClose: () => void;
  onCommit: () => void;
}

/** 칸 편집 바텀시트. 열고 닫기·반영은 `hooks/useCellEditor` 가 맡아요 */
export function CellEditorSheet({ target, draft, onDraft, onClose, onCommit }: CellEditorSheetProps) {
  return (
    <BottomSheet
      open={target !== null}
      onClose={onClose}
      // 시트의 포커스 잠금이 컨테이너로 포커스를 옮겨도 입력칸으로 돌려놔요
      onEntered={focusEditor}
      hasTextField
      ctaContentGap={20}
      header={<BottomSheet.Header>{target?.question ?? ''}</BottomSheet.Header>}
      cta={<BottomSheet.CTA onClick={onCommit}>완료</BottomSheet.CTA>}
    >
      {target && (
        <div className="mg-cell-editor" style={{ padding: '4px 24px 0', ['--mg-brand' as string]: brandColor }}>
          {/* 어느 칸인지: 3×3 위치 아이콘 + 칸 이름 (위 칸의 이름은 제목에 있어요) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CellPositionIcon cell={target.cell} />
            <Text typography="t7" color={colors.grey600} fontWeight="semibold">
              {target.position}
            </Text>
          </div>
          <div style={{ margin: '0 -24px' }}>
            {/* 칸 글은 짧은 한 줄이지만 40자까지라 큰 글씨가 잘리지 않게 여러 줄로 보여요. 줄바꿈은 넣지 않아요(Enter = 완료) */}
            <TextArea
              id={EDITOR_INPUT_ID}
              variant="big"
              aria-label={target.position}
              placeholder={target.placeholder}
              value={draft}
              maxLength={MAX_TEXT}
              enterKeyHint="done"
              onChange={(event) => onDraft(event.target.value.replace(/[\r\n]+/g, ' '))}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
                event.preventDefault();
                onCommit();
              }}
            />
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text typography="t7" color={draft.length >= MAX_TEXT ? colors.red500 : colors.grey500}>
              {draft.length}/{MAX_TEXT}
            </Text>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
