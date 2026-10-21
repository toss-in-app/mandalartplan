import { colors } from '@toss/tds-colors';
import type { CSSProperties } from 'react';

import { cellView, type CellView } from '../lib/cells';
import { CENTER, ringIndex, type Board } from '../lib/mandalart';
import { brandColor, stampInk, withAlpha } from '../theme';
import './grid.css';

export type BlockSize = 'small' | 'large' | 'main';

/**
 * 칸 색. 빈 자리 글까지 글자 대비 4.5:1 이상으로 맞춰요.
 * 오늘 한 표시와 편집 모드의 '고른 칸'은 모양을 나눠요(2.1, 사용자 결정 — 둘 다 ✓ 라 헷갈렸어요):
 *  - 오늘 한 실천: 옅어진 칸 위에 '완료' 도장이 쿵 찍히고 아래 글씨는 흐려져요(.mg-cell-done, grid.css .mg-cell-stamp).
 *    사용자 결정(2026-10-21): 하나하나 지우는 재미 + 블라인드처럼 덮는 느낌 → 시안 넷(롤 블라인드·회색 가림막·완료 도장·뒤집기) 중 도장.
 *    끝낸 일을 그 자리에서 덮되 글씨는 남겨 무엇을 했는지 보이고, 9×9·공유 이미지에서도 읽혀요
 *  - 실천을 오늘 다 한 세부 목표: 더 진한 틴트 + 칸 아래 '오늘 다 했어요'(화면이 caption 으로 넣어요) + 이름을 가리지 않게
 *    칸 모서리에 작은 '완료' 도장(.mg-cell-complete, grid.css .mg-cell-seal). 세부 목표는 끝나는 일이 아니라 큰 도장 대신 오늘 몫을 다 했다는 표시
 *  - 테두리 강조와 ✓ 는 편집 모드에서 지울 칸으로 고른 것만(selectedStyle). 편집 모드에선 오늘 한 표시를 빼서 둘이 같이 보이지 않아요
 */
function cellStyle(view: CellView): CSSProperties {
  switch (view.kind) {
    case 'goal':
      return { background: brandColor, color: colors.white, fontWeight: view.text ? 700 : 600 };
    case 'sub':
      if (view.checked) {
        // 글이 있는 실천을 오늘 전부 체크한 세부 목표: 진한 틴트 (grey900 글자 대비 10:1)
        return { background: withAlpha(brandColor, 0.36), color: colors.grey900, fontWeight: 700 };
      }
      return {
        background: withAlpha(brandColor, 0.14),
        color: view.text ? colors.grey900 : colors.grey700,
        fontWeight: view.text ? 600 : 500,
      };
    default:
      if (view.checked) {
        // 오늘 한 실천: 한 단계 옅어진 칸. 도장과 흐려지는 글씨는 grid.css(굵기는 그대로라 줄바꿈이 바뀌지 않아요)
        return { background: colors.grey50, color: colors.grey800 };
      }
      if (!view.text) {
        // 빈 실천 칸은 흰 바탕에 옅은 테두리로 '비어 있음'을 보여줘요
        return { background: colors.white, color: colors.grey600, boxShadow: `inset 0 0 0 1px ${colors.grey200}` };
      }
      return { background: colors.grey100, color: colors.grey800 };
  }
}

/** 편집 모드에서 지울 칸으로 고른 칸: 진한 틴트 + 브랜드 테두리 + ✓. 가운데 핵심 목표는 브랜드 바탕 위에 흰 안쪽 테두리 */
function selectedStyle(view: CellView, size: BlockSize): CSSProperties {
  if (view.kind === 'goal') {
    return { background: brandColor, color: colors.white, fontWeight: 700, boxShadow: `inset 0 0 0 ${size === 'main' ? 3 : 2}px ${colors.white}` };
  }
  return {
    background: withAlpha(brandColor, view.kind === 'sub' ? 0.36 : 0.22),
    color: colors.grey900,
    fontWeight: view.kind === 'sub' ? 700 : 600,
    boxShadow: `inset 0 0 0 ${size === 'main' ? 2 : 1.5}px ${brandColor}`,
  };
}

/** 오늘 한 실천(.mg-cell-done)·실천을 다 한 세부 목표(.mg-cell-complete) 표시 — 칸 색은 cellStyle, 도장과 흐려지는 글씨는 grid.css */
function cellClass(view: CellView, extra = ''): string {
  const state = view.checked ? (view.kind === 'action' ? ' mg-cell-done' : view.kind === 'sub' ? ' mg-cell-complete' : '') : '';
  return `mg-cell${state}${extra}`;
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
  /** 칸 하나씩 누를 수 있게 (홈·세부 목표 화면) */
  onSelectCell?: (cell: number, view: CellView) => void;
  /** onSelectCell 격자에서 누를 수 없는 칸을 정해요 (예: 세부 목표 화면의 가운데 이름표). 없으면 모두 눌러요 */
  interactive?: (cell: number, view: CellView) => boolean;
  /** 다음에 채울 칸(0~8): 은은하게 퍼지는 테두리와 '눌러서 적기' 를 보여줘요. `nextEmptyCell` */
  nextCell?: number | null;
  /** AI 초안을 만드는 중: 아직 빈 칸이 은은하게 깜빡여요(동작 줄이기면 멈춤) */
  loading?: boolean;
  /**
   * 여러 칸 지우기의 선택 모드(제자리 편집 모드, 2.1 `useGridEdit`). 있으면 고른 칸을 진한 틴트·테두리·✓ 로 그리고(오늘 한 실천의 취소선과 다른 모양),
   * 누를 수 있는 칸을 '선택됨/안 됨' 토글로 읽어요. 칸마다 `data-cell` 이 있어 끌어서 고르기가 손가락 아래 칸을 찾고,
   * 글이 있는 칸 버튼의 `data-filled` 로 편집 모드에서 그 칸만 흔들어요.
   */
  selected?: ReadonlySet<number>;
}

interface CellContentProps {
  view: CellView;
  caption: string | null;
  size: BlockSize;
  /** 누를 수 있는 빈 칸(세부 목표·실천): '+' 아이콘 */
  invite?: boolean;
  /** 다음에 채울 칸: '눌러서 적기' */
  next?: boolean;
  /** 편집 모드에서 지울 칸으로 고름: ✓ */
  selected?: boolean;
}

function CellContent({ view, caption, size, invite = false, next = false, selected = false }: CellContentProps) {
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
      {/* 오늘 한 실천의 '완료' 도장. 체크하는 순간 찍히는 움직임이 나오게 늘 그려 두고 .mg-cell-done 일 때만 보여요(글자는 CSS 가 data-label 로) */}
      {view.kind === 'action' && view.text && <span className="mg-cell-stamp" data-label="완료" aria-hidden />}
      {/* 실천을 오늘 다 한 세부 목표: 이름을 가리지 않게 모서리에 작은 '완료' 도장(.mg-cell-complete 일 때만 보여요) */}
      {view.kind === 'sub' && view.text && <span className="mg-cell-seal" data-label="완료" aria-hidden />}
      {selected && size === 'main' && (
        <span
          className="mg-cell-check"
          style={view.kind === 'goal' ? { background: colors.white, color: brandColor } : { background: brandColor, color: colors.white }}
          aria-hidden
        >
          ✓
        </span>
      )}
    </>
  );
}

/** 만드는 중인 빈 칸: 회색 자리 + 깜빡임(grid.css .mg-cell-loading) */
const LOADING_STYLE: CSSProperties = { background: colors.grey100 };

export function Block({ board, block, size, checked, caption, onSelect, onSelectCell, interactive, nextCell = null, loading = false, selected }: BlockProps) {
  const views = Array.from({ length: 9 }, (_, cell) => cellView(board, block, cell, checked));
  const selectMode = selected !== undefined;
  const styleOf = (view: CellView, cell: number) => (selected?.has(cell) ? selectedStyle(view, size) : cellStyle(view));
  const className = `mg-block mg-block-${size}`;
  // 오늘 한 실천에 찍는 도장 잉크 색(grid.css .mg-cell-stamp)
  const stampVar = { ['--mg-stamp' as string]: stampInk } as CSSProperties;
  const label = block === CENTER ? '핵심 목표와 세부 목표' : `세부 목표 ${ringIndex(block) + 1}`;
  // 오늘 체크를 넘긴 화면(홈·세부 목표)만 실천 칸을 '오늘 했어요/아직' 토글로 읽어요. 편집 모드는 칸 글만
  const checkMode = checked !== undefined;

  if (onSelect) {
    return (
      <button type="button" className={className} style={stampVar} onClick={onSelect} aria-label={blockButtonLabel(views, label)}>
        {views.map((view, cell) => (
          <span key={cell} className={cellClass(view)} style={styleOf(view, cell)}>
            <CellContent view={view} caption={caption?.(view, cell) ?? null} size={size} />
          </span>
        ))}
      </button>
    );
  }

  return (
    <div className={className} style={stampVar} role="group" aria-label={label}>
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
            data-cell={cell}
            data-filled={view.text.trim() ? '' : undefined}
            className={cellClass(view, next ? ' mg-cell-next' : '')}
            style={{ ...(invite ? inviteStyle(view) : styleOf(view, cell)), ['--mg-invite' as string]: withAlpha(brandColor, 0.4) }}
            onClick={() => onSelectCell(cell, view)}
            aria-label={
              selectMode
                ? name
                : checkMode && view.kind === 'action' && view.text
                  ? `${name}, 오늘 ${view.checked ? '했어요' : '아직'}`
                  : `${name}${cap ? `, ${spokenCaption(cap)}` : ''}`
            }
            aria-pressed={selectMode ? selected.has(cell) : checkMode && view.kind === 'action' && view.text ? view.checked : undefined}
          >
            <CellContent view={view} caption={cap} size={size} invite={invite} next={next} selected={selected?.has(cell)} />
          </button>
        ) : loading && !view.text.trim() ? (
          <span key={cell} className="mg-cell mg-cell-loading" style={LOADING_STYLE} />
        ) : (
          <span key={cell} data-cell={cell} className={cellClass(view)} style={styleOf(view, cell)}>
            <CellContent view={view} caption={cap} size={size} />
          </span>
        );
      })}
    </div>
  );
}
