import { colors } from '@toss/tds-colors';
import { BottomSheet, FixedBottomCTA, Text, TextField, Top } from '@toss/tds-mobile';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

import { Block } from '../components/Block';
import { CENTER, MAX_TEXT, ringIndex, type Board } from '../lib/mandalart';

interface BlockScreenProps {
  board: Board;
  /** 0~8. 4 는 가운데 블록(핵심 목표 + 세부 목표 8개) */
  block: number;
  onChangeGoal: (goal: string) => void;
  onChangeSubTitle: (subIndex: number, title: string) => void;
  onChangeAction: (subIndex: number, actionIndex: number, text: string) => void;
  onDone: () => void;
  /** 들어오자마자 입력창을 열 칸(0~8). 세부 목표 화면에서 빈 실천 칸을 눌러 왔을 때 */
  initialCell?: number | null;
}

const EDITOR_INPUT_ID = 'mandalart-cell-editor';

interface CellSpec {
  /** 시트 제목: 어느 칸인지 */
  label: string;
  /** 시트 부제: 무엇을 위한 칸인지(위 칸의 글). 없으면 생략 */
  context: string | null;
  placeholder: string;
  value: string;
  save: (text: string) => void;
}

/** 블록·칸 번호 → 그 칸의 이름, 지금 글, 저장 콜백 */
function cellSpec(props: BlockScreenProps, cell: number): CellSpec {
  const { board, block } = props;
  const goal = board.goal.trim();
  if (block === CENTER) {
    if (cell === CENTER) {
      return { label: '핵심 목표', context: null, placeholder: '예: 올해 안에 책 한 권 쓰기', value: board.goal, save: props.onChangeGoal };
    }
    const s = ringIndex(cell);
    return {
      label: `세부 목표 ${s + 1}`,
      context: goal ? `핵심 목표 · ${goal}` : null,
      placeholder: '핵심 목표를 이루는 데 필요한 것',
      value: board.subs[s].title,
      save: (text) => props.onChangeSubTitle(s, text),
    };
  }
  const s = ringIndex(block);
  const title = board.subs[s].title.trim();
  if (cell === CENTER) {
    return {
      label: '세부 목표',
      context: goal ? `핵심 목표 · ${goal}` : null,
      placeholder: '예: 매일 글쓰기 습관',
      value: board.subs[s].title,
      save: (text) => props.onChangeSubTitle(s, text),
    };
  }
  const a = ringIndex(cell);
  return {
    label: `실천 ${a + 1}`,
    context: title ? `세부 목표 · ${title}` : null,
    placeholder: '구체적인 행동 한 가지',
    value: board.subs[s].actions[a],
    save: (text) => props.onChangeAction(s, a, text),
  };
}

/**
 * 편집 = 3×3 칸을 눌러 바텀시트에서 한 칸씩 적어요. '완료' 를 눌러야 반영되고, 시트를 닫으면 그대로예요.
 * (2026-10-20 사용자 피드백: 아래에 입력칸이 줄줄이 있는 대신 누른 칸만 입력)
 */
export function BlockScreen(props: BlockScreenProps) {
  const { board, block, onDone, initialCell = null } = props;
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  // 세부 목표 화면에서 빈 칸을 눌러 왔으면 그 칸의 입력창을 바로 열어요(키보드는 입력칸을 한 번 누르면 올라와요)
  useEffect(() => {
    if (initialCell === null) return;
    setDraft(cellSpec(props, initialCell).value);
    setEditing(initialCell);
    // 화면이 처음 뜰 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCell]);

  /** 칸을 누른 그 순간 안에서 시트를 그리고 입력칸에 포커스해요 — 그래야 iOS 웹뷰도 키보드를 올려요 */
  const openFromTap = (cell: number) => {
    flushSync(() => {
      setDraft(cellSpec(props, cell).value);
      setEditing(cell);
    });
    document.getElementById(EDITOR_INPUT_ID)?.focus();
  };

  const close = () => setEditing(null);
  const commit = () => {
    if (editing === null) return;
    cellSpec(props, editing).save(draft.trim());
    setEditing(null);
  };

  const isCenter = block === CENTER;
  const subIndex = isCenter ? null : ringIndex(block);
  const sub = subIndex === null ? null : board.subs[subIndex];
  const title = isCenter ? '핵심 목표와 세부 목표' : sub?.title.trim() || `세부 목표 ${(subIndex ?? 0) + 1}`;
  const subtitle = isCenter
    ? '가운데가 핵심 목표, 둘레 8칸이 세부 목표예요'
    : `${board.goal.trim() || '핵심 목표'}를 이루기 위한 실천 항목 8개예요`;
  const spec = editing === null ? null : cellSpec(props, editing);

  return (
    <>
      <Top
        title={<Top.TitleParagraph size={22}>{title}</Top.TitleParagraph>}
        subtitleBottom={<Top.SubtitleParagraph size={17}>{subtitle}</Top.SubtitleParagraph>}
      />

      <div style={{ padding: '0 20px' }}>
        <Block board={board} block={block} size="main" onSelectCell={(cell) => openFromTap(cell)} />
      </div>

      <div style={{ padding: '16px 24px 120px' }}>
        <Text typography="t7" color={colors.grey600} display="block">
          칸을 누르면 글을 적을 수 있어요. 한 칸에 {MAX_TEXT}자까지예요.
        </Text>
      </div>

      <FixedBottomCTA onClick={onDone}>완료</FixedBottomCTA>

      <BottomSheet
        open={spec !== null}
        onClose={close}
        // 시트의 포커스 잠금이 컨테이너로 포커스를 옮겨도 입력칸으로 돌려놔요(다른 화면에서 들어와 바로 열린 경우 포함)
        onEntered={() => document.getElementById(EDITOR_INPUT_ID)?.focus()}
        hasTextField
        header={<BottomSheet.Header>{spec?.label ?? ''}</BottomSheet.Header>}
        headerDescription={spec?.context ? <BottomSheet.HeaderDescription>{spec.context}</BottomSheet.HeaderDescription> : undefined}
        cta={<BottomSheet.CTA onClick={commit}>완료</BottomSheet.CTA>}
      >
        {spec && (
          <div style={{ padding: '8px 0 0' }}>
            <TextField
              id={EDITOR_INPUT_ID}
              variant="box"
              placeholder={spec.placeholder}
              value={draft}
              maxLength={MAX_TEXT}
              aria-label={spec.label}
              enterKeyHint="done"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
                event.preventDefault();
                commit();
              }}
            />
          </div>
        )}
      </BottomSheet>
    </>
  );
}
