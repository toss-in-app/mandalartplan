import { colors } from '@toss/tds-colors';
import { List, ListRow, Text, Top } from '@toss/tds-mobile';

import { PRIVACY_URL, TERMS_URL, type Content } from '../content';
import { openUrl } from '../lib/bridge';
import { formatDateTime } from '../lib/format';
import type { NotificationStatus } from '../lib/state';

export interface BackupPanelProps {
  configured: boolean;
  enabled: boolean;
  busy: boolean;
  lastBackupAt: number | null;
  onEnable: () => void;
  onBackupNow: () => void;
  onRestore: () => void;
  onDisable: () => void;
}

interface SettingsScreenProps {
  content: Content;
  notification: NotificationStatus;
  hasAnyText: boolean;
  backup: BackupPanelProps;
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
export function SettingsScreen({ content, notification, hasAnyText, backup, onPickTemplate, onReset }: SettingsScreenProps) {
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
        {!backup.configured && (
          <ListRow contents={<ListRow.Texts type="1RowTypeA" top="서버 백업" />} right={rightText('준비 중')} />
        )}
        {backup.configured && !backup.enabled && (
          <ListRow
            withArrow
            disabled={backup.busy}
            onClick={backup.onEnable}
            contents={<ListRow.Texts type="2RowTypeA" top="서버 백업 켜기" bottom="폰을 바꿔도 만다라트를 이어서 써요" />}
          />
        )}
        {backup.configured && backup.enabled && (
          <>
            <ListRow
              contents={<ListRow.Texts type="1RowTypeA" top="마지막 백업" />}
              right={rightText(backup.lastBackupAt ? formatDateTime(backup.lastBackupAt) : '아직 없음')}
            />
            <ListRow withArrow disabled={backup.busy} onClick={backup.onBackupNow} contents={<ListRow.Texts type="1RowTypeA" top="지금 백업하기" />} />
            <ListRow withArrow disabled={backup.busy} onClick={backup.onRestore} contents={<ListRow.Texts type="1RowTypeA" top="서버에서 복원하기" />} />
            <ListRow
              disabled={backup.busy}
              onClick={backup.onDisable}
              contents={<ListRow.Texts type="1RowTypeA" top="백업 끄고 서버 데이터 지우기" topProps={{ color: colors.red500 }} />}
            />
          </>
        )}
      </List>

      <List>
        <ListRow withArrow onClick={() => void openUrl(TERMS_URL)} contents={<ListRow.Texts type="1RowTypeA" top="이용약관" />} />
        <ListRow withArrow onClick={() => void openUrl(PRIVACY_URL)} contents={<ListRow.Texts type="1RowTypeA" top="개인정보처리방침" />} />
      </List>

      <div style={{ padding: '24px 24px 40px' }}>
        <Text typography="t7" color={colors.grey500} display="block">
          적은 내용과 체크 기록은 이 기기에 저장돼요. 서버 백업을 켜면 토스 익명 식별값으로 만든 키와 함께 서버에도 보관해요.
        </Text>
        <div style={{ height: 8 }} />
        <Text typography="t7" color={colors.grey400} display="block">
          앱 {__APP_VERSION__} · 콘텐츠 {content.contentVersion} ({content.updatedAt})
        </Text>
      </div>
    </>
  );
}
