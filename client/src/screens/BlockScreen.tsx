import { colors } from '@toss/tds-colors';
import { BottomSheet, FixedBottomCTA, Text, TextArea, Top } from '@toss/tds-mobile';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

import { Block } from '../components/Block';
import { CENTER, MAX_TEXT, ringIndex, type Board } from '../lib/mandalart';
import { brandColor, withAlpha } from '../theme';

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

/** 입력칸에 포커스하고 커서를 글 끝에 둬요(이미 적힌 글을 이어서 고치기 쉽게) */
function focusEditor() {
  const el = document.getElementById(EDITOR_INPUT_ID) as HTMLTextAreaElement | null;
  if (!el) return;
  el.focus();
  const end = el.value.length;
  el.setSelectionRange(end, end);
}

interface CellSpec {
  /** 시트 제목(질문형) */
  question: string;
  /** 칸 위치 이름: 핵심 목표 · 세부 목표 n · 실천 n (위치 아이콘 옆, 입력칸 이름) */
  position: string;
  /** 위 칸의 글(알약 표시). 없으면 생략 */
  parent: { label: string; text: string } | null;
  placeholder: string;
  value: string;
  save: (text: string) => void;
}

/** 블록·칸 번호 → 그 칸의 질문, 위치 이름, 지금 글, 저장 콜백 */
function cellSpec(props: BlockScreenProps, cell: number): CellSpec {
  const { board, block } = props;
  const goal = board.goal.trim();
  const goalParent = goal ? { label: '핵심 목표', text: goal } : null;
  if (block === CENTER) {
    if (cell === CENTER) {
      return { question: '어떤 목표를 이루고 싶나요?', position: '핵심 목표', parent: null, placeholder: '예: 올해 안에 책 한 권 쓰기', value: board.goal, save: props.onChangeGoal };
    }
    const s = ringIndex(cell);
    return {
      question: '목표를 이루려면 무엇이 필요할까요?',
      position: `세부 목표 ${s + 1}`,
      parent: goalParent,
      placeholder: '예: 꾸준한 운동',
      value: board.subs[s].title,
      save: (text) => props.onChangeSubTitle(s, text),
    };
  }
  const s = ringIndex(block);
  const title = board.subs[s].title.trim();
  if (cell === CENTER) {
    return {
      question: '이 칸의 세부 목표는 무엇인가요?',
      position: `세부 목표 ${s + 1}`,
      parent: goalParent,
      placeholder: '예: 매일 글쓰기 습관',
      value: board.subs[s].title,
      save: (text) => props.onChangeSubTitle(s, text),
    };
  }
  const a = ringIndex(cell);
  return {
    question: '매일 체크할 행동을 적어 주세요',
    position: `실천 ${a + 1}`,
    parent: title ? { label: '세부 목표', text: title } : goalParent,
    placeholder: '예: 아침 스트레칭 10분',
    value: board.subs[s].actions[a],
    save: (text) => props.onChangeAction(s, a, text),
  };
}

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
    focusEditor();
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
        onEntered={focusEditor}
        hasTextField
        ctaContentGap={20}
        header={<BottomSheet.Header>{spec?.question ?? ''}</BottomSheet.Header>}
        cta={<BottomSheet.CTA onClick={commit}>완료</BottomSheet.CTA>}
      >
        {spec && (
          <div className="mg-cell-editor" style={{ padding: '4px 24px 0', ['--mg-brand' as string]: brandColor }}>
            {/* 어느 칸인지: 3×3 위치 아이콘 + 이 칸이 속한 위 칸의 글(알약) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <CellPositionIcon cell={editing ?? CENTER} />
              {spec.parent ? (
                <span
                  style={{
                    minWidth: 0,
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: withAlpha(brandColor, 0.1),
                    color: brandColor,
                    fontSize: 13,
                    fontWeight: 600,
                    lineHeight: '18px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {spec.parent.label} · {spec.parent.text}
                </span>
              ) : (
                <Text typography="t7" color={colors.grey600}>
                  만다라트 한가운데 칸이에요
                </Text>
              )}
            </div>
            <div style={{ marginTop: 16 }}>
              <Text typography="t7" color={colors.grey600} fontWeight="semibold">
                {spec.position}
              </Text>
            </div>
            <div style={{ margin: '0 -24px' }}>
              {/* 칸 글은 짧은 한 줄이지만 40자까지라 큰 글씨가 잘리지 않게 여러 줄로 보여요. 줄바꿈은 넣지 않아요(Enter = 완료) */}
              <TextArea
                id={EDITOR_INPUT_ID}
                variant="big"
                aria-label={spec.position}
                placeholder={spec.placeholder}
                value={draft}
                maxLength={MAX_TEXT}
                enterKeyHint="done"
                onChange={(event) => setDraft(event.target.value.replace(/[\r\n]+/g, ' '))}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
                  event.preventDefault();
                  commit();
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
    </>
  );
}
