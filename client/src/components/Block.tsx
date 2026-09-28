import { colors } from '@toss/tds-colors';
import type { CSSProperties } from 'react';

import { cellView, type CellView } from '../lib/cells';
import { CENTER, ringIndex, type Board } from '../lib/mandalart';
import { brandColor, withAlpha } from '../theme';
import './grid.css';

export type BlockSize = 'small' | 'large' | 'main';

function cellStyle(view: CellView, size: BlockSize): CSSProperties {
  switch (view.kind) {
    case 'goal':
      return { background: brandColor, color: colors.white, fontWeight: 700 };
    case 'sub':
      return {
        background: withAlpha(brandColor, 0.14),
        color: view.text ? colors.grey900 : colors.grey600,
        fontWeight: 600,
      };
    default:
      if (view.checked) {
        return {
          background: withAlpha(brandColor, 0.22),
          color: colors.grey900,
          fontWeight: 600,
          boxShadow: size === 'main' ? `inset 0 0 0 2px ${brandColor}` : undefined,
        };
      }
      return { background: colors.grey100, color: view.text ? colors.grey800 : colors.grey400 };
  }
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
}

function CellContent({ view, caption, size }: { view: CellView; caption: string | null; size: BlockSize }) {
  const text = view.text || view.placeholder || (size === 'main' ? '비어 있어요' : '');
  return (
    <>
      <span className={view.text ? 'mg-cell-text' : 'mg-cell-text mg-cell-placeholder'}>{text}</span>
      {caption && <span className="mg-cell-caption">{caption}</span>}
      {view.checked && size === 'main' && (
        <span className="mg-cell-check" style={{ background: brandColor, color: colors.white }} aria-hidden>
          ✓
        </span>
      )}
    </>
  );
}

export function Block({ board, block, size, checked, caption, onSelect, onSelectCell }: BlockProps) {
  const views = Array.from({ length: 9 }, (_, cell) => cellView(board, block, cell, checked));
  const className = `mg-block mg-block-${size}`;
  const label = block === CENTER ? '핵심 목표와 세부 목표' : `세부 목표 ${ringIndex(block) + 1}`;

  if (onSelect) {
    return (
      <button type="button" className={className} onClick={onSelect} aria-label={`${label} 열기`}>
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
        return onSelectCell ? (
          <button
            key={cell}
            type="button"
            className="mg-cell"
            style={cellStyle(view, size)}
            onClick={() => onSelectCell(cell, view)}
            aria-label={view.kind === 'action' && view.text ? `${name}, 오늘 ${view.checked ? '했어요' : '아직'}` : name}
            aria-pressed={view.kind === 'action' && view.text ? view.checked : undefined}
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
