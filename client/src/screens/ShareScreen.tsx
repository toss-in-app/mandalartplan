import { colors } from '@toss/tds-colors';
import { FixedBottomCTA, List, ListRow, Result, Text, Top } from '@toss/tds-mobile';
import { useMemo } from 'react';

import { BASIC_CARD, renderCard, type RenderedCard } from '../lib/card';
import { todaySet } from '../lib/checkin';
import { getProgress, type Board } from '../lib/mandalart';
import { dateKey, streak, type CheckinRecord } from '../lib/state';

interface ShareScreenProps {
  board: Board;
  checkin: CheckinRecord | undefined;
  /** 토스앱 버전이 이미지 저장을 지원하는지 (미지원이면 버튼 대신 안내) */
  canSave: boolean;
  busy: boolean;
  onSaveImage: (card: RenderedCard) => void;
  /** 리워드 광고를 보고 고화질(워터마크 없음)로 저장. 광고를 지원하지 않는 환경이면 undefined → 행을 숨겨요 */
  onSaveHd?: () => void;
  onShareText: () => void;
  onShareLink: () => void;
  /** 빈 판일 때 '홈으로' */
  onDone: () => void;
}

/**
 * 공유 (주요 기능 3). 9×9 이미지 카드 미리보기 + 이미지 저장(사진첩) · 고화질로 저장(리워드 광고) · 글로 공유 · 링크 공유.
 */
export function ShareScreen({ board, checkin, canSave, busy, onSaveImage, onSaveHd, onShareText, onShareLink, onDone }: ShareScreenProps) {
  const today = dateKey();
  const card = useMemo(
    () => renderCard({ board, checked: todaySet(checkin, today), today, streakDays: streak(checkin, today) }, BASIC_CARD),
    [board, checkin, today],
  );

  if (getProgress(board).filled === 0) {
    return (
      <>
        <Top title={<Top.TitleParagraph size={22}>만다라트 공유</Top.TitleParagraph>} />
        <Result
          title="아직 적은 목표가 없어요"
          description="홈에서 핵심 목표부터 적으면 이미지로 저장하거나 공유할 수 있어요"
          button={<Result.Button onClick={onDone}>홈으로</Result.Button>}
        />
      </>
    );
  }

  return (
    <>
      <Top
        title={<Top.TitleParagraph size={22}>만다라트 공유</Top.TitleParagraph>}
        subtitleBottom={<Top.SubtitleParagraph size={17}>오늘 체크까지 담은 9×9 이미지예요</Top.SubtitleParagraph>}
      />

      <div style={{ padding: '0 20px 8px' }}>
        {card ? (
          <img
            src={card.dataUrl}
            alt="만다라트 9×9 이미지 미리보기"
            style={{ display: 'block', width: '100%', borderRadius: 16, border: `1px solid ${colors.grey200}`, boxSizing: 'border-box' }}
          />
        ) : (
          <div style={{ padding: '32px 20px', borderRadius: 16, background: colors.grey100, textAlign: 'center' }}>
            <Text typography="t6" color={colors.grey700} display="block">
              미리보기를 만들 수 없어요
            </Text>
            <Text typography="t7" color={colors.grey500} display="block" style={{ marginTop: 6 }}>
              글이나 링크로는 공유할 수 있어요
            </Text>
          </div>
        )}
      </div>

      <List>
        <ListRow
          withArrow
          disabled={busy}
          onClick={onShareText}
          contents={<ListRow.Texts type="2RowTypeA" top="글로 공유하기" bottom="핵심 목표·세부 목표·실천을 글로 보내요" />}
        />
        <ListRow
          withArrow
          disabled={busy}
          onClick={onShareLink}
          contents={<ListRow.Texts type="2RowTypeA" top="링크 공유하기" bottom="토스에서 만다라트를 여는 링크를 보내요" />}
        />
        {canSave && onSaveHd && (
          <ListRow
            disabled={busy}
            onClick={onSaveHd}
            contents={<ListRow.Texts type="2RowTypeA" top="고화질로 저장" bottom="광고를 보면 워터마크 없이 2배 크기로 저장해요" />}
            right={
              <Text typography="t7" color={colors.grey500}>
                광고 보기
              </Text>
            }
          />
        )}
      </List>

      <div style={{ padding: '8px 20px 120px' }}>
        <Text typography="t7" color={colors.grey500} display="block">
          {canSave
            ? '이미지 저장하기를 누르면 사진 접근을 한 번 물어요. 저장한 이미지에는 작은 워터마크가 들어가요.'
            : '이미지 저장은 토스앱을 업데이트하면 쓸 수 있어요. 글이나 링크로는 지금도 공유할 수 있어요.'}
        </Text>
      </div>

      {canSave && (
        <FixedBottomCTA disabled={busy || !card} onClick={() => card && onSaveImage(card)}>
          이미지 저장하기
        </FixedBottomCTA>
      )}
    </>
  );
}
