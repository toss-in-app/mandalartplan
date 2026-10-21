import { colors } from '@toss/tds-colors';
import { Border, List, ListRow, Text, Top } from '@toss/tds-mobile';

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

export interface ExtraBoardPanelProps {
  /** 리워드로 열렸거나(settings.unlocks.extraBoard) 이미 판이 2개 */
  unlocked: boolean;
  /** 지금 판 수(1~2) */
  count: number;
  /** 리워드 광고가 뜨는 동안 행 잠금 */
  busy: boolean;
  /** 잠겨 있을 때: 안내 → 리워드 광고 → 잠금 해제 + 판 추가 */
  onUnlock: () => void;
  /** 열렸는데 판이 하나일 때(처음부터 다시 만든 뒤 등): 빈 판 추가 */
  onAdd: () => void;
}

interface SettingsScreenProps {
  content: Content;
  notification: NotificationStatus;
  /** 템플릿 코드가 있고 토스앱이 지원할 때만 알림 행이 눌려요 */
  notificationAvailable: boolean;
  onNotification: () => void;
  hasAnyText: boolean;
  extraBoard: ExtraBoardPanelProps;
  backup: BackupPanelProps;
  onReset: () => void;
}

const NOTIFICATION_LABEL: Record<NotificationStatus, string> = {
  unknown: '받기',
  agreed: '받는 중',
  declined: '꺼짐 · 다시 받기',
};

/**
 * 설정. 매일 저녁 알림(동의 요청·상태) · 두 번째 판(리워드 잠금) | 백업 | 약관 | 초기화 · 버전.
 * (예시 템플릿 불러오기는 2.1 에서 뺐어요 — 사용자 결정 2026-10-21. 예시는 빈 판 홈의 '예시로 시작하기'에서만)
 * 묶음 사이는 TDS Border(height16)로 나누고, 되돌릴 수 없는 초기화는 맨 아래 따로 둬요.
 */
export function SettingsScreen({
  content,
  notification,
  notificationAvailable,
  onNotification,
  hasAnyText,
  extraBoard,
  backup,
  onReset,
}: SettingsScreenProps) {
  const rightText = (text: string) => (
    <Text typography="t7" color={colors.grey600}>
      {text}
    </Text>
  );

  return (
    <>
      <Top title={<Top.TitleParagraph size={22}>설정</Top.TitleParagraph>} />

      <List>
        <ListRow
          onClick={notificationAvailable ? onNotification : undefined}
          disabled={!notificationAvailable}
          contents={<ListRow.Texts type="2RowTypeA" top="매일 저녁 알림" bottom="저녁 8시에 오늘 실천을 체크하라고 알려요" />}
          right={rightText(notificationAvailable ? NOTIFICATION_LABEL[notification] : '준비 중')}
        />
        {!extraBoard.unlocked && (
          <ListRow
            disabled={extraBoard.busy}
            onClick={extraBoard.onUnlock}
            contents={<ListRow.Texts type="2RowTypeA" top="두 번째 만다라트 판" bottom="광고를 보면 판을 하나 더 만들 수 있어요" />}
            right={rightText('광고 보기')}
          />
        )}
        {extraBoard.unlocked && extraBoard.count < 2 && (
          <ListRow
            withArrow
            onClick={extraBoard.onAdd}
            contents={<ListRow.Texts type="2RowTypeA" top="두 번째 만다라트 판" bottom="빈 판을 하나 더 만들어요" />}
          />
        )}
        {extraBoard.unlocked && extraBoard.count >= 2 && (
          <ListRow
            contents={<ListRow.Texts type="2RowTypeA" top="두 번째 만다라트 판" bottom="홈 제목을 누르면 판을 바꿀 수 있어요" />}
            right={rightText('사용 중')}
          />
        )}
      </List>

      <Border variant="height16" />
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

      <Border variant="height16" />
      <List>
        <ListRow withArrow onClick={() => void openUrl(TERMS_URL)} contents={<ListRow.Texts type="1RowTypeA" top="이용약관" />} />
        <ListRow withArrow onClick={() => void openUrl(PRIVACY_URL)} contents={<ListRow.Texts type="1RowTypeA" top="개인정보처리방침" />} />
      </List>

      <Border variant="height16" />
      <List>
        <ListRow
          onClick={hasAnyText ? onReset : undefined}
          disabled={!hasAnyText}
          contents={<ListRow.Texts type="1RowTypeA" top="처음부터 다시 만들기" topProps={{ color: hasAnyText ? colors.red500 : colors.grey400 }} />}
        />
      </List>

      <div style={{ padding: '24px 24px 40px' }}>
        <Text typography="t7" color={colors.grey600} display="block">
          적은 내용과 체크 기록은 이 기기에 저장돼요. 서버 백업을 켜면 토스 익명 식별값으로 만든 키와 함께 서버에도 보관해요.
        </Text>
        <div style={{ height: 8 }} />
        <Text typography="t7" color={colors.grey600} display="block">
          앱 {__APP_VERSION__} · 콘텐츠 {content.contentVersion} ({content.updatedAt})
        </Text>
      </div>
    </>
  );
}
