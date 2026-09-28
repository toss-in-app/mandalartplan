import { Checkbox, FixedBottomCTA, TextField, Top } from '@toss/tds-mobile';

import { Block } from '../components/Block';
import { haptic } from '../lib/bridge';
import { ACTION_COUNT, CENTER, MAX_TEXT, SUB_COUNT, cellOfRing, ringIndex, type Board } from '../lib/mandalart';

interface BlockScreenProps {
  board: Board;
  /** 0~8. 4 는 가운데 블록(핵심 목표 + 세부 목표 8개) */
  block: number;
  onChangeGoal: (goal: string) => void;
  onChangeSubTitle: (subIndex: number, title: string) => void;
  onChangeAction: (subIndex: number, actionIndex: number, text: string) => void;
  onToggleDone: (subIndex: number, actionIndex: number) => void;
  onDone: () => void;
}

const inputId = (cell: number) => `mandalart-cell-${cell}`;

function focusCell(cell: number) {
  document.getElementById(inputId(cell))?.focus();
}

export function BlockScreen(props: BlockScreenProps) {
  const { board, block, onDone } = props;
  const isCenter = block === CENTER;
  const subIndex = isCenter ? null : ringIndex(block);
  const sub = subIndex === null ? null : board.subs[subIndex];

  const title = isCenter ? '핵심 목표와 세부 목표' : sub?.title.trim() || `세부 목표 ${(subIndex ?? 0) + 1}`;
  const subtitle = isCenter
    ? '가운데가 핵심 목표, 둘레 8칸이 세부 목표예요'
    : `${board.goal.trim() || '핵심 목표'}를 이루기 위한 실천 항목 8개예요`;

  return (
    <>
      <Top
        title={<Top.TitleParagraph size={22}>{title}</Top.TitleParagraph>}
        subtitleBottom={<Top.SubtitleParagraph size={17}>{subtitle}</Top.SubtitleParagraph>}
      />

      <div style={{ padding: '0 20px' }}>
        <Block board={board} block={block} size="large" onSelectCell={focusCell} />
      </div>

      <div style={{ padding: '16px 0 120px' }}>
        {isCenter || subIndex === null || sub === null ? (
          <CenterForm board={board} onChangeGoal={props.onChangeGoal} onChangeSubTitle={props.onChangeSubTitle} />
        ) : (
          <SubForm
            subIndex={subIndex}
            title={sub.title}
            actions={sub.actions}
            done={sub.done}
            onChangeSubTitle={props.onChangeSubTitle}
            onChangeAction={props.onChangeAction}
            onToggleDone={props.onToggleDone}
          />
        )}
      </div>

      <FixedBottomCTA onClick={onDone}>완료</FixedBottomCTA>
    </>
  );
}

interface CenterFormProps {
  board: Board;
  onChangeGoal: (goal: string) => void;
  onChangeSubTitle: (subIndex: number, title: string) => void;
}

function CenterForm({ board, onChangeGoal, onChangeSubTitle }: CenterFormProps) {
  return (
    <>
      <TextField
        id={inputId(CENTER)}
        variant="line"
        label="핵심 목표"
        labelOption="sustain"
        placeholder="예: 올해 안에 책 한 권 쓰기"
        value={board.goal}
        maxLength={MAX_TEXT}
        onChange={(event) => onChangeGoal(event.target.value)}
      />
      {Array.from({ length: SUB_COUNT }, (_, i) => (
        <TextField
          key={i}
          id={inputId(cellOfRing(i))}
          variant="line"
          label={`세부 목표 ${i + 1}`}
          labelOption="sustain"
          placeholder="핵심 목표를 이루는 데 필요한 것"
          value={board.subs[i].title}
          maxLength={MAX_TEXT}
          onChange={(event) => onChangeSubTitle(i, event.target.value)}
        />
      ))}
    </>
  );
}

interface SubFormProps {
  subIndex: number;
  title: string;
  actions: string[];
  done: boolean[];
  onChangeSubTitle: (subIndex: number, title: string) => void;
  onChangeAction: (subIndex: number, actionIndex: number, text: string) => void;
  onToggleDone: (subIndex: number, actionIndex: number) => void;
}

function SubForm({ subIndex, title, actions, done, onChangeSubTitle, onChangeAction, onToggleDone }: SubFormProps) {
  return (
    <>
      <TextField
        id={inputId(CENTER)}
        variant="line"
        label="세부 목표"
        labelOption="sustain"
        placeholder="예: 매일 글쓰기 습관"
        value={title}
        maxLength={MAX_TEXT}
        onChange={(event) => onChangeSubTitle(subIndex, event.target.value)}
      />
      {Array.from({ length: ACTION_COUNT }, (_, i) => {
        const hasText = actions[i].trim().length > 0;
        return (
          <TextField
            key={i}
            id={inputId(cellOfRing(i))}
            variant="line"
            label={`실천 ${i + 1}`}
            labelOption="sustain"
            placeholder="구체적인 행동 한 가지"
            value={actions[i]}
            maxLength={MAX_TEXT}
            onChange={(event) => onChangeAction(subIndex, i, event.target.value)}
            right={
              <Checkbox.Circle
                checked={done[i]}
                disabled={!hasText}
                aria-label={`실천 ${i + 1} 완료`}
                onCheckedChange={() => {
                  void haptic('tap');
                  onToggleDone(subIndex, i);
                }}
              />
            }
          />
        );
      })}
    </>
  );
}
