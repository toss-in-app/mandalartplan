import { colors } from '@toss/tds-colors';
import { List, ListRow, Text, useBottomSheet } from '@toss/tds-mobile';
import { useCallback } from 'react';

import type { Content, ContentTemplate } from '../content';

/**
 * 예시 템플릿 고르기 바텀시트. 사용자가 버튼(홈 '예시로 시작하기', 설정 '예시 템플릿 불러오기')을 누른 뒤에만 열려요.
 */
export function useTemplatePicker(content: Content, onPick: (template: ContentTemplate) => void) {
  const sheet = useBottomSheet();

  return useCallback(() => {
    sheet.open({
      header: '예시로 시작하기',
      children: (
        <div style={{ paddingBottom: 16 }}>
          <div style={{ padding: '0 24px 12px' }}>
            <Text typography="t7" color={colors.grey600}>
              골라서 넣은 뒤 칸을 자유롭게 고쳐 쓰면 돼요
            </Text>
          </div>
          <List>
            {content.templates.map((template) => (
              <ListRow
                key={template.id}
                withArrow
                onClick={() => {
                  sheet.close();
                  onPick(template);
                }}
                contents={<ListRow.Texts type="2RowTypeA" top={template.title} bottom={template.goal} />}
              />
            ))}
          </List>
        </div>
      ),
      onClose: () => sheet.close(),
    });
  }, [sheet, content, onPick]);
}
