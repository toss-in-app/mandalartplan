import { colors } from '@toss/tds-colors';
import { Badge, Checkbox, FixedBottomCTA, List, ListHeader, ListRow, Result, Top, useToast } from '@toss/tds-mobile';
import { useMemo, useState } from 'react';

import { cheerFor, type Content } from '../content';
import { haptic } from '../lib/bridge';
import { checkinGroups, formatDateLabel, todayChecked } from '../lib/checkin';
import type { Board } from '../lib/mandalart';
import { dateKey, streak, type CheckinRecord } from '../lib/state';

interface CheckinScreenProps {
  board: Board;
  record: CheckinRecord | undefined;
  content: Content;
  /** 아직 한 번도 체크인을 완료한 적이 없으면 true — 완료 뒤 결과 화면을 보여줘요 */
  isFirstEver: boolean;
  onComplete: (indices: number[]) => void;
  onDone: () => void;
}

/**
 * 오늘 체크인 (주요 기능 1).
 * 글이 있는 실천을 세부 목표별로 보여주고, 오늘 한 것을 체크한 뒤 '완료' 로 기록해요.
 * 전면 광고(기능 4)·알림 동의 버튼(기능 5)은 뒤에 이 화면에 붙어요.
 */
export function CheckinScreen({ board, record, content, isFirstEver, onComplete, onDone }: CheckinScreenProps) {
  const toast = useToast();
  const today = dateKey();
  const completedToday = todayChecked(record, today);
  const groups = useMemo(() => checkinGroups(board), [board]);
  const days = streak(record, today);

  const [checked, setChecked] = useState<Set<number>>(() => new Set(completedToday ?? []));
  const [phase, setPhase] = useState<'list' | 'first-done'>('list');

  const toggle = (index: number) => {
    void haptic('tap');
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const complete = () => {
    const indices = Array.from(checked).sort((a, b) => a - b);
    onComplete(indices);
    void haptic('success');
    if (isFirstEver) {
      setPhase('first-done');
      return;
    }
    if (completedToday) toast.openToast('오늘 체크인을 수정했어요');
    else toast.openToast(indices.length === 0 ? '오늘은 쉬어요. 내일 다시 해요' : cheerFor(content, today));
    onDone();
  };

  if (phase === 'first-done') {
    return (
      <>
        <Top title={<Top.TitleParagraph size={22}>오늘 체크인</Top.TitleParagraph>} />
        <Result
          title="첫 체크인을 마쳤어요"
          description={
            <span style={{ whiteSpace: 'pre-line' }}>{`${cheerFor(content, today)}\n매일 저녁 알림은 설정에서 받을 수 있어요`}</span>
          }
          button={<Result.Button onClick={onDone}>홈으로</Result.Button>}
        />
      </>
    );
  }

  if (groups.length === 0) {
    return (
      <>
        <Top title={<Top.TitleParagraph size={22}>오늘 체크인</Top.TitleParagraph>} />
        <Result
          title="체크할 실천이 없어요"
          description="만다라트에 실천 항목을 적으면 여기서 오늘 한 일을 체크할 수 있어요"
          button={<Result.Button onClick={onDone}>홈으로</Result.Button>}
        />
      </>
    );
  }

  const subtitle = days > 0 ? `${formatDateLabel(today)} · ${days}일째` : `${formatDateLabel(today)} · 오늘 한 실천을 체크해요`;

  return (
    <>
      <Top
        title={<Top.TitleParagraph size={22}>오늘 체크인</Top.TitleParagraph>}
        subtitleBottom={<Top.SubtitleParagraph size={17}>{subtitle}</Top.SubtitleParagraph>}
      />

      <div style={{ paddingBottom: 120 }}>
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
              {group.items.map((item) => {
                const isChecked = checked.has(item.index);
                return (
                  <ListRow
                    key={item.index}
                    onClick={() => toggle(item.index)}
                    left={
                      <Checkbox.Circle
                        checked={isChecked}
                        readOnly
                        tabIndex={-1}
                        aria-hidden
                        labelProps={{ style: { pointerEvents: 'none' } }}
                      />
                    }
                    contents={
                      <ListRow.Texts
                        type="1RowTypeA"
                        top={item.text}
                        topProps={{ color: isChecked ? colors.grey900 : colors.grey700, fontWeight: isChecked ? 'semibold' : 'regular' }}
                      />
                    }
                    right={
                      item.done ? (
                        <Badge size="xsmall" color="green" variant="weak">
                          달성
                        </Badge>
                      ) : undefined
                    }
                    aria-pressed={isChecked}
                  />
                );
              })}
            </List>
          </section>
        ))}
      </div>

      <FixedBottomCTA onClick={complete}>{completedToday ? '수정 완료' : '오늘 체크인 완료'}</FixedBottomCTA>
    </>
  );
}
