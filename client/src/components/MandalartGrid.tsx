import { CENTER, type Board } from '../lib/mandalart';
import { Block } from './Block';
import './grid.css';

interface MandalartGridProps {
  board: Board;
  checked?: ReadonlySet<number>;
  /** 둘레 블록(0~8, 가운데 4 제외)을 눌렀을 때 */
  onSelectBlock: (block: number) => void;
}

/** 9×9 전체 보기. 둘레 블록(3×3)을 누르면 그 세부 목표 화면으로 가요. 가운데 블록은 눌러도 아무 일 없어요(편집은 홈 오른쪽 위). */
export function MandalartGrid({ board, checked, onSelectBlock }: MandalartGridProps) {
  return (
    <div className="mg-board">
      {Array.from({ length: 9 }, (_, block) => (
        <Block key={block} board={board} block={block} size="small" checked={checked} onSelect={block === CENTER ? undefined : () => onSelectBlock(block)} />
      ))}
    </div>
  );
}
