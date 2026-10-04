import { colors } from '@toss/tds-colors';
import { List, ListRow, Text, Top } from '@toss/tds-mobile';

import { PRIVACY_URL, TERMS_URL, type Content } from '../content';
import { openUrl } from '../lib/bridge';
import type { NotificationStatus } from '../lib/state';

interface SettingsScreenProps {
  content: Content;
  notification: NotificationStatus;
  hasAnyText: boolean;
  onPickTemplate: () => void;
  onReset: () => void;
}

const NOTIFICATION_LABEL: Record<NotificationStatus, string> = {
  unknown: '준비 중',
  agreed: '받는 중',
  declined: '꺼짐',
};

/**
 * 설정. 알림(기능 5)·두 번째 판(기능 6)은 자리만 두고, 지금은 예시 템플릿·초기화·약관·버전.
 */
export function SettingsScreen({ content, notification, hasAnyText, onPickTemplate, onReset }: SettingsScreenProps) {
  const rightText = (text: string) => (
    <Text typography="t7" color={colors.grey500}>
      {text}
    </Text>
  );

  return (
    <>
      <Top title={<Top.TitleParagraph size={22}>설정</Top.TitleParagraph>} />

      <List>
        <ListRow contents={<ListRow.Texts type="1RowTypeA" top="매일 저녁 알림" />} right={rightText(NOTIFICATION_LABEL[notification])} />
        <ListRow withArrow onClick={onPickTemplate} contents={<ListRow.Texts type="1RowTypeA" top="예시 템플릿 불러오기" />} />
        <ListRow contents={<ListRow.Texts type="1RowTypeA" top="두 번째 만다라트 판" />} right={rightText('준비 중')} />
        <ListRow
          onClick={hasAnyText ? onReset : undefined}
          disabled={!hasAnyText}
          contents={<ListRow.Texts type="1RowTypeA" top="처음부터 다시 만들기" topProps={{ color: hasAnyText ? colors.red500 : colors.grey400 }} />}
        />
      </List>

      <List>
        <ListRow withArrow onClick={() => void openUrl(TERMS_URL)} contents={<ListRow.Texts type="1RowTypeA" top="이용약관" />} />
        <ListRow withArrow onClick={() => void openUrl(PRIVACY_URL)} contents={<ListRow.Texts type="1RowTypeA" top="개인정보처리방침" />} />
      </List>

      <div style={{ padding: '24px 24px 40px' }}>
        <Text typography="t7" color={colors.grey500} display="block">
          적은 내용과 체크 기록은 이 기기에만 저장돼요. 기기를 바꾸면 옮겨지지 않아요.
        </Text>
        <div style={{ height: 8 }} />
        <Text typography="t7" color={colors.grey400} display="block">
          앱 {__APP_VERSION__} · 콘텐츠 {content.contentVersion} ({content.updatedAt})
        </Text>
      </div>
    </>
  );
}
