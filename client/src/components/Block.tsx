import { colors } from '@toss/tds-colors';
import type { CSSProperties } from 'react';

import { cellView, type CellView } from '../lib/cells';
import { CENTER, ringIndex, type Board } from '../lib/mandalart';
import { brandColor, withAlpha } from '../theme';
import './grid.css';

function cellStyle(view: CellView): CSSProperties {
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
      return view.done
        ? { background: colors.green50, color: colors.green700, textDecoration: 'line-through' }
        : { background: colors.grey100, color: colors.grey800 };
  }
}

interface BlockProps {
  board: Board;
  block: number;
  size: 'small' | 'large';
  /** 블록 전체를 하나의 버튼으로 (홈 화면 격자) */
  onSelect?: () => void;
  /** 칸 하나씩 누를 수 있게 (블록 편집 화면 미리보기) */
  onSelectCell?: (cell: number) => void;
}

function CellText({ view }: { view: CellView }) {
  return (
    <span className={view.text ? 'mg-cell-text' : 'mg-cell-text mg-cell-placeholder'}>
      {view.text || view.placeholder}
    </span>
  );
}

export function Block({ board, block, size, onSelect, onSelectCell }: BlockProps) {
  const views = Array.from({ length: 9 }, (_, cell) => cellView(board, block, cell));
  const className = `mg-block mg-block-${size}`;
  const label =
    block === CENTER ? '핵심 목표와 세부 목표' : `세부 목표 ${ringIndex(block) + 1}`;

  if (onSelect) {
    return (
      <button type="button" className={className} onClick={onSelect} aria-label={`${label} 수정`}>
        {views.map((view, cell) => (
          <span key={cell} className="mg-cell" style={cellStyle(view)}>
            <CellText view={view} />
          </span>
        ))}
      </button>
    );
  }

  return (
    <div className={className} role="group" aria-label={label}>
      {views.map((view, cell) =>
        onSelectCell ? (
          <button
            key={cell}
            type="button"
            className="mg-cell"
            style={cellStyle(view)}
            onClick={() => onSelectCell(cell)}
            aria-label={view.text || view.placeholder || `실천 ${ringIndex(cell) + 1}`}
          >
            <CellText view={view} />
          </button>
        ) : (
          <span key={cell} className="mg-cell" style={cellStyle(view)}>
            <CellText view={view} />
          </span>
        ),
      )}
    </div>
  );
}
