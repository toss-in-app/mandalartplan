import { colors } from '@toss/tds-colors';
import type { CSSProperties } from 'react';

import { cellView, type CellView } from '../lib/cells';
import { CENTER, ringIndex, type Board } from '../lib/mandalart';
import { brandColor, withAlpha } from '../theme';
import './grid.css';

export type BlockSize = 'small' | 'large' | 'main';

/**
 * 칸 색. 빈 자리 글까지 글자 대비 4.5:1 이상으로 맞춰요.
 * 오늘 체크는 틴트에 브랜드 테두리를 더해요 — 틴트만으로는 세부 목표 칸(14%)과 1.1:1 이라 전체 보기에서 구분되지 않아요.
 */
function cellStyle(view: CellView, size: BlockSize): CSSProperties {
  switch (view.kind) {
    case 'goal':
      return { background: brandColor, color: colors.white, fontWeight: view.text ? 700 : 600 };
    case 'sub':
      if (view.checked) {
        // 글이 있는 실천을 오늘 전부 체크한 세부 목표: 진한 틴트 + 브랜드 테두리 (grey900 글자 대비 10:1)
        return {
          background: withAlpha(brandColor, 0.36),
          color: colors.grey900,
          fontWeight: 700,
          boxShadow: `inset 0 0 0 ${size === 'main' ? 2 : 1.5}px ${brandColor}`,
        };
      }
      return {
        background: withAlpha(brandColor, 0.14),
        color: view.text ? colors.grey900 : colors.grey700,
        fontWeight: view.text ? 600 : 500,
      };
    default:
      if (view.checked) {
        return {
          background: withAlpha(brandColor, 0.22),
          color: colors.grey900,
          fontWeight: 600,
          boxShadow: `inset 0 0 0 ${size === 'main' ? 2 : 1.5}px ${brandColor}`,
        };
      }
      if (!view.text) {
        // 빈 실천 칸은 흰 바탕에 옅은 테두리로 '비어 있음'을 보여줘요
        return { background: colors.white, color: colors.grey600, boxShadow: `inset 0 0 0 1px ${colors.grey200}` };
      }
      return { background: colors.grey100, color: colors.grey800 };
  }
}

/**
 * 누를 수 있는 빈 칸(세부 목표·실천)의 모양: 점선 테두리 + 옅은 틴트 + '+' 아이콘.
 * 비어 있다는 것보다 '눌러서 적을 수 있다' 는 걸 보여줘요(2026-10-20 사용자 피드백: 비면 너무 휑함).
 */
function inviteStyle(view: CellView): CSSProperties {
  return {
    background: view.kind === 'sub' ? withAlpha(brandColor, 0.06) : colors.white,
    color: brandColor,
    border: `1.5px dashed ${withAlpha(brandColor, 0.45)}`,
  };
}

function PlusIcon() {
  return (
    <svg className="mg-cell-plus" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M12 5v14M5 12h14" stroke={brandColor} strokeWidth={2.2} strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** 전체 보기 블록 버튼의 이름. aria-label 이 안의 글을 가리니 제목과 오늘 체크 수를 담아요. */
function blockButtonLabel(views: CellView[], label: string): string {
  const title = views[CENTER].text.trim();
  const done = views.filter((view) => view.kind === 'action' && view.checked).length;
  return `${title ? `${title}, ` : ''}${label} 열기${done > 0 ? `, 오늘 ${done}개 했어요` : ''}`;
}

/** 스크린리더용 칸 아래 글. "오늘 2/8" 은 날짜처럼 읽힐 수 있어 "오늘 8개 중 2개" 로 바꿔요. */
function spokenCaption(caption: string): string {
  return caption.replace(/(\d+)\/(\d+)/, '$2개 중 $1개');
}

interface BlockProps {
  board: Board;
  block: number;
  size: BlockSize;
  /** 오늘 체크한 실천 번호 */
  checked?: ReadonlySet<number>;
  /** 칸 아래 작은 글 (예: "오늘 2/5") */
  caption?: (view: CellView, cell: number) => string | null;
  /** 블록 전체를 하나의 버튼으로 (전체 보기 격자) */
  onSelect?: () => void;
  /** 칸 하나씩 누를 수 있게 (홈·세부 목표·편집 미리보기) */
  onSelectCell?: (cell: number, view: CellView) => void;
  /** onSelectCell 격자에서 누를 수 없는 칸을 정해요 (예: 세부 목표 화면의 가운데 이름표). 없으면 모두 눌러요 */
  interactive?: (cell: number, view: CellView) => boolean;
  /** 다음에 채울 칸(0~8): 은은하게 퍼지는 테두리와 '눌러서 적기' 를 보여줘요. `nextEmptyCell` */
  nextCell?: number | null;
}

interface CellContentProps {
  view: CellView;
  caption: string | null;
  size: BlockSize;
  /** 누를 수 있는 빈 칸(세부 목표·실천): '+' 아이콘 */
  invite?: boolean;
  /** 다음에 채울 칸: '눌러서 적기' */
  next?: boolean;
}

function CellContent({ view, caption, size, invite = false, next = false }: CellContentProps) {
  if (invite) {
    return (
      <>
        <PlusIcon />
        {next && <span className="mg-cell-hint">눌러서 적기</span>}
      </>
    );
  }
  const text = view.text || view.placeholder || (size === 'main' && view.kind === 'action' ? '비어 있어요' : '');
  return (
    <>
      <span className="mg-cell-text">{text}</span>
      {next && !view.text && <span className="mg-cell-hint">눌러서 적기</span>}
      {caption && <span className="mg-cell-caption">{caption}</span>}
      {view.checked && size === 'main' && (
        <span className="mg-cell-check" style={{ background: brandColor, color: colors.white }} aria-hidden>
          ✓
        </span>
      )}
    </>
  );
}

export function Block({ board, block, size, checked, caption, onSelect, onSelectCell, interactive, nextCell = null }: BlockProps) {
  const views = Array.from({ length: 9 }, (_, cell) => cellView(board, block, cell, checked));
  const className = `mg-block mg-block-${size}`;
  const label = block === CENTER ? '핵심 목표와 세부 목표' : `세부 목표 ${ringIndex(block) + 1}`;
  // 오늘 체크를 넘긴 화면(홈·세부 목표)만 실천 칸을 '오늘 했어요/아직' 토글로 읽어요. 편집 화면은 칸 글만
  const checkMode = checked !== undefined;

  if (onSelect) {
    return (
      <button type="button" className={className} onClick={onSelect} aria-label={blockButtonLabel(views, label)}>
        {views.map((view, cell) => (
          <span key={cell} className="mg-cell" style={cellStyle(view, size)}>
            <CellContent view={view} caption={caption?.(view, cell) ?? null} size={size} />
          </span>
        ))}
      </button>
    );
  }

  return (
    <div className={className} role="group" aria-label={label}>
      {views.map((view, cell) => {
        const cap = caption?.(view, cell) ?? null;
        // 빈 칸은 화면에 글이 없어도 스크린리더가 어느 칸인지 알 수 있게 이름을 붙여요
        const name =
          view.text ||
          view.placeholder ||
          (view.kind === 'sub' && view.index !== null ? `세부 목표 ${view.index + 1}` : view.kind === 'action' && view.index !== null ? `실천 ${(view.index % 8) + 1}` : '');
        const pressable = Boolean(onSelectCell) && (interactive?.(cell, view) ?? true);
        // 누를 수 있는 빈 세부 목표·실천 칸은 '+' 로 초대하고, 다음에 채울 칸은 은은하게 깜빡여요(동작 줄이기면 멈춤)
        const invite = pressable && size === 'main' && view.kind !== 'goal' && !view.text.trim();
        const next = pressable && size === 'main' && nextCell === cell;
        return onSelectCell && pressable ? (
          <button
            key={cell}
            type="button"
            className={next ? 'mg-cell mg-cell-next' : 'mg-cell'}
            style={{ ...(invite ? inviteStyle(view) : cellStyle(view, size)), ['--mg-invite' as string]: withAlpha(brandColor, 0.4) }}
            onClick={() => onSelectCell(cell, view)}
            aria-label={
              checkMode && view.kind === 'action' && view.text
                ? `${name}, 오늘 ${view.checked ? '했어요' : '아직'}`
                : `${name}${cap ? `, ${spokenCaption(cap)}` : ''}`
            }
            aria-pressed={checkMode && view.kind === 'action' && view.text ? view.checked : undefined}
          >
            <CellContent view={view} caption={cap} size={size} invite={invite} next={next} />
          </button>
        ) : (
          <span key={cell} className="mg-cell" style={cellStyle(view, size)}>
            <CellContent view={view} caption={cap} size={size} />
          </span>
        );
      })}
    </div>
  );
}
