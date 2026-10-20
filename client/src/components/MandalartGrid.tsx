import { CENTER, type Board } from '../lib/mandalart';
import { Block } from './Block';
import './grid.css';

interface MandalartGridProps {
  board: Board;
  checked?: ReadonlySet<number>;
  /** 둘레 블록(0~8, 가운데 4 제외)을 눌렀을 때. 없으면 보기만 해요(AI 초안 미리보기) */
  onSelectBlock?: (block: number) => void;
  /** AI 초안을 만드는 중: 빈 칸이 깜빡여요 */
  loading?: boolean;
}

/** 9×9 전체 보기. 둘레 블록(3×3)을 누르면 그 세부 목표 화면으로 가요. 가운데 블록은 눌러도 아무 일 없어요(편집은 홈 오른쪽 위). */
export function MandalartGrid({ board, checked, onSelectBlock, loading = false }: MandalartGridProps) {
  return (
    <div className="mg-board">
      {Array.from({ length: 9 }, (_, block) => (
        <Block
          key={block}
          board={board}
          block={block}
          size="small"
          checked={checked}
          loading={loading}
          onSelect={block === CENTER || !onSelectBlock ? undefined : () => onSelectBlock(block)}
        />
      ))}
    </div>
  );
}
