import type { Board } from '../lib/mandalart';
import { Block } from './Block';
import './grid.css';

interface MandalartGridProps {
  board: Board;
  onSelectBlock: (block: number) => void;
}

/** 9×9 전체 보기. 블록(3×3)을 누르면 그 블록을 편집하는 화면으로 가요. */
export function MandalartGrid({ board, onSelectBlock }: MandalartGridProps) {
  return (
    <div className="mg-board">
      {Array.from({ length: 9 }, (_, block) => (
        <Block key={block} board={board} block={block} size="small" onSelect={() => onSelectBlock(block)} />
      ))}
    </div>
  );
}
