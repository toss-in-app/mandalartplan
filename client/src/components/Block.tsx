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
}

function CellContent({ view, caption, size }: { view: CellView; caption: string | null; size: BlockSize }) {
  const text = view.text || view.placeholder || (size === 'main' ? '비어 있어요' : '');
  return (
    <>
      <span className="mg-cell-text">{text}</span>
      {caption && <span className="mg-cell-caption">{caption}</span>}
      {view.checked && size === 'main' && (
        <span className="mg-cell-check" style={{ background: brandColor, color: colors.white }} aria-hidden>
          ✓
        </span>
      )}
    </>
  );
}

export function Block({ board, block, size, checked, caption, onSelect, onSelectCell, interactive }: BlockProps) {
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
        const name = view.text || view.placeholder || `실천 ${view.kind === 'action' && view.index !== null ? (view.index % 8) + 1 : ''}`;
        return onSelectCell && (interactive?.(cell, view) ?? true) ? (
          <button
            key={cell}
            type="button"
            className="mg-cell"
            style={cellStyle(view, size)}
            onClick={() => onSelectCell(cell, view)}
            aria-label={
              checkMode && view.kind === 'action' && view.text
                ? `${name}, 오늘 ${view.checked ? '했어요' : '아직'}`
                : `${name}${cap ? `, ${spokenCaption(cap)}` : ''}`
            }
            aria-pressed={checkMode && view.kind === 'action' && view.text ? view.checked : undefined}
          >
            <CellContent view={view} caption={cap} size={size} />
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
