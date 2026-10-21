import { useState } from 'react';
import { flushSync } from 'react-dom';

import { CellEditorSheet } from '../components/CellEditorSheet';
import { applyEdit, focusEditor, type CellEditHandlers, type CellEditTarget } from '../lib/cellEdit';

/**
 * 칸 편집 시트. `sheet` 를 화면에 그려 두고, 칸을 누를 때 `openFromTap(editTarget(...))` 를 불러요.
 * - openFromTap: 누른 그 순간 시트를 그리고 입력칸에 포커스해요 — iOS 웹뷰도 키보드를 올려요
 * - open: 손가락 없이 여는 경우(딥링크로 들어와 바로 열기). 시트가 열린 뒤 포커스해요
 * '완료'·Enter 로 반영(앞뒤 공백 제거), 시트를 닫으면 버려요. 글이 없으면 반영하지 않아요('완료'가 꺼져요 — 지우기는 편집 모드의 삭제로).
 */
export function useCellEditor(handlers: CellEditHandlers) {
  const [target, setTarget] = useState<CellEditTarget | null>(null);
  const [draft, setDraft] = useState('');

  const openFromTap = (next: CellEditTarget) => {
    flushSync(() => {
      setDraft(next.value);
      setTarget(next);
    });
    focusEditor();
  };
  const open = (next: CellEditTarget) => {
    setDraft(next.value);
    setTarget(next);
  };
  const commit = () => {
    const text = draft.trim();
    if (!target || !text) return;
    applyEdit(target.field, text, handlers);
    setTarget(null);
  };

  const sheet = <CellEditorSheet target={target} draft={draft} onDraft={setDraft} onClose={() => setTarget(null)} onCommit={commit} />;
  return { openFromTap, open, sheet };
}
