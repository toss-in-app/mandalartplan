import { colors } from '@toss/tds-colors';
import { List, ListHeader, ListRow, Result, Text, Top } from '@toss/tds-mobile';

import { cheerFor, type Content } from '../content';
import { checkinGroups, formatDateLabel, todaySet } from '../lib/checkin';
import type { Board } from '../lib/mandalart';
import { dateKey, streak, type CheckinRecord } from '../lib/state';

interface TodayScreenProps {
  board: Board;
  record: CheckinRecord | undefined;
  content: Content;
  onDone: () => void;
}

/**
 * 오늘 기록 (홈 '오늘 기록 보기'). 오늘 체크한 실천을 세부 목표별로 보여줘요.
 * 전면 광고(기능 4)는 홈 → 이 화면 전환에, 배너(기능 4)는 목록 하단에, 알림 동의 버튼(기능 5)은 위에 붙어요.
 */
export function TodayScreen({ board, record, content, onDone }: TodayScreenProps) {
  const today = dateKey();
  const checked = todaySet(record, today);
  const groups = checkinGroups(board)
    .map((g) => ({ ...g, items: g.items.filter((item) => checked.has(item.index)) }))
    .filter((g) => g.items.length > 0);
  const days = streak(record, today);

  if (checked.size === 0) {
    return (
      <>
        <Top title={<Top.TitleParagraph size={22}>오늘 기록</Top.TitleParagraph>} />
        <Result
          title="아직 오늘 한 실천이 없어요"
          description="세부 목표 화면에서 실천 칸을 누르면 여기에 모여요"
          button={<Result.Button onClick={onDone}>홈으로</Result.Button>}
        />
      </>
    );
  }

  return (
    <>
      <Top
        title={<Top.TitleParagraph size={22}>오늘 기록</Top.TitleParagraph>}
        subtitleBottom={
          <Top.SubtitleParagraph size={17}>
            {formatDateLabel(today)} · {days}일째 · {checked.size}개 실천
          </Top.SubtitleParagraph>
        }
      />
      <div style={{ padding: '0 20px 16px' }}>
        <Text typography="t6" color={colors.grey800} fontWeight="semibold" display="block">
          {cheerFor(content, today)}
        </Text>
      </div>
      <div style={{ paddingBottom: 40 }}>
        {groups.map((group) => (
          <section key={group.subIndex}>
            <ListHeader
              title={
                <ListHeader.TitleParagraph typography="t5" fontWeight="bold" color={colors.grey800}>
                  {group.title}
                </ListHeader.TitleParagraph>
              }
            />
            <List>
              {group.items.map((item) => (
                <ListRow key={item.index} contents={<ListRow.Texts type="1RowTypeA" top={item.text} />} />
              ))}
            </List>
          </section>
        ))}
      </div>
    </>
  );
}
