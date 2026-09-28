import type { Board } from '../lib/mandalart';
import { Block } from './Block';
import './grid.css';

interface MandalartGridProps {
  board: Board;
  checked?: ReadonlySet<number>;
  onSelectBlock: (block: number) => void;
}

/** 9×9 전체 보기. 블록(3×3)을 누르면 그 세부 목표 화면(가운데는 편집)으로 가요. */
export function MandalartGrid({ board, checked, onSelectBlock }: MandalartGridProps) {
  return (
    <div className="mg-board">
      {Array.from({ length: 9 }, (_, block) => (
        <Block key={block} board={board} block={block} size="small" checked={checked} onSelect={() => onSelectBlock(block)} />
      ))}
    </div>
  );
}
