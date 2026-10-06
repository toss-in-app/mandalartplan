/**
 * 공유 이미지 카드 (계약 events.md '공유' 절).
 * 기본: 1080×1350 PNG, 9×9 만다라트 + 오늘 체크 표시 + 워터마크 "만다라트".
 * 고화질(기능 5 리워드): 같은 레이아웃을 2배로 그리고 워터마크를 빼요.
 *
 * 캔버스 없이도 검증할 수 있게 레이아웃 계산(layoutCard)·줄바꿈(wrapText)을 그리기(drawCard)와 분리했어요.
 * 글꼴은 기기 기본 고딕(시스템 글꼴)이라 기기마다 조금 다르게 보일 수 있어요.
 */
import { colors } from '@toss/tds-colors';

import { brandColor, withAlpha } from '../theme';
import { cellView, type CellView } from './cells';
import { getProgress, type Board } from './mandalart';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

export interface CardOptions {
  /** 1 = 1080×1350, 2 = 2160×2700 */
  scale: 1 | 2;
  watermark: boolean;
}

export const BASIC_CARD: CardOptions = { scale: 1, watermark: true };
export const HD_CARD: CardOptions = { scale: 2, watermark: false };

export interface CardInput {
  board: Board;
  /** 오늘 체크한 실천 번호(0~63) */
  checked: ReadonlySet<number>;
  /** 'YYYY-MM-DD' */
  today: string;
  /** 연속 일수 */
  streakDays: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CardCell extends Rect {
  block: number;
  cell: number;
  view: CellView;
}

export interface CardLayout {
  width: number;
  height: number;
  header: { x: number; width: number; caption: string; title: string; summary: string };
  grid: Rect;
  cellSize: number;
  cells: CardCell[];
  footer: { text: string; y: number } | null;
}

const PAD = 56;
const GRID_TOP = 300;
const CELL = 100;
const CELL_GAP = 4;
const BLOCK_GAP = 16;
const GRID_SIZE = CELL * 9 + CELL_GAP * 6 + BLOCK_GAP * 2; // 956
const FOOTER_Y = GRID_TOP + GRID_SIZE + 58;
export const WATERMARK = '만다라트 · 토스 앱에서 만다라트 검색';

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", Roboto, sans-serif';

/** '2026-10-06' → '2026년 10월 6일' */
export function formatCardDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

/** 저장 파일 이름. 확장자를 포함해야 해요(File.saveBase64 규칙). */
export function cardFileName(date: string, options: CardOptions = BASIC_CARD): string {
  return `mandalart-${date}${options.scale > 1 ? '-hd' : ''}.png`;
}

/** 블록·칸 위치와 머리글·바닥글 문구를 계산해요. 글꼴·캔버스와 무관한 순수 계산이에요. */
export function layoutCard(input: CardInput, options: CardOptions = BASIC_CARD): CardLayout {
  const { board, checked, today, streakDays } = input;
  const progress = getProgress(board);
  const gridX = PAD + (CARD_WIDTH - PAD * 2 - GRID_SIZE) / 2;
  const cells: CardCell[] = [];
  for (let block = 0; block < 9; block += 1) {
    const br = Math.floor(block / 3);
    const bc = block % 3;
    for (let cell = 0; cell < 9; cell += 1) {
      const cr = Math.floor(cell / 3);
      const cc = cell % 3;
      cells.push({
        block,
        cell,
        view: cellView(board, block, cell, checked),
        x: gridX + bc * (CELL * 3 + CELL_GAP * 2 + BLOCK_GAP) + cc * (CELL + CELL_GAP),
        y: GRID_TOP + br * (CELL * 3 + CELL_GAP * 2 + BLOCK_GAP) + cr * (CELL + CELL_GAP),
        w: CELL,
        h: CELL,
      });
    }
  }

  const parts = [`73칸 중 ${progress.filled}칸`];
  if (checked.size > 0) parts.push(`오늘 ${checked.size}개 실천`);
  if (streakDays > 0) parts.push(`${streakDays}일째`);

  return {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    header: {
      x: PAD,
      width: CARD_WIDTH - PAD * 2,
      caption: `만다라트 · ${formatCardDate(today)}`,
      title: board.goal.trim() || '핵심 목표를 정하는 중이에요',
      summary: parts.join(' · '),
    },
    grid: { x: gridX, y: GRID_TOP, w: GRID_SIZE, h: GRID_SIZE },
    cellSize: CELL,
    cells,
    footer: options.watermark ? { text: WATERMARK, y: FOOTER_Y } : null,
  };
}

/**
 * 글을 maxWidth 안에 들어가는 줄로 나눠요. 띄어쓰기가 있으면 거기서, 없으면 글자 단위로 끊어요.
 * maxLines 를 넘으면 마지막 줄 끝을 … 로 줄여요. measure 는 글 너비를 돌려주는 함수(캔버스 measureText).
 */
export function wrapText(measure: (text: string) => number, text: string, maxWidth: number, maxLines: number): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean || maxLines < 1) return [];
  const lines: string[] = [];
  let rest = clean;
  while (rest.length > 0) {
    if (lines.length === maxLines) {
      let last = lines[maxLines - 1];
      while (last.length > 0 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1).trimEnd();
      lines[maxLines - 1] = `${last}…`;
      return lines;
    }
    let n = rest.length;
    while (n > 1 && measure(rest.slice(0, n)) > maxWidth) n -= 1;
    if (n < rest.length) {
      const space = rest.lastIndexOf(' ', n);
      if (space > 0) n = space;
    }
    lines.push(rest.slice(0, n).trim());
    rest = rest.slice(n).trim();
  }
  return lines;
}

function font(ctx: CanvasRenderingContext2D, size: number, weight: 400 | 500 | 600 | 700): void {
  ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
}

function roundedRect(ctx: CanvasRenderingContext2D, r: Rect, radius: number): void {
  const { x, y, w, h } = r;
  const rad = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  return wrapText((t) => ctx.measureText(t).width, text, maxWidth, 1)[0] ?? '';
}

interface CellStyle {
  background: string;
  color: string;
  weight: 500 | 600 | 700;
  border: string | null;
}

function cellStyle(view: CellView): CellStyle {
  switch (view.kind) {
    case 'goal':
      return { background: brandColor, color: colors.white, weight: 700, border: null };
    case 'sub':
      return { background: withAlpha(brandColor, 0.14), color: view.text ? colors.grey900 : colors.grey500, weight: 600, border: null };
    default:
      if (view.checked) return { background: withAlpha(brandColor, 0.22), color: colors.grey900, weight: 600, border: brandColor };
      return { background: view.text ? colors.grey100 : colors.grey50, color: colors.grey800, weight: 500, border: null };
  }
}

function drawCheck(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, 11, 0, Math.PI * 2);
  ctx.fillStyle = brandColor;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy);
  ctx.lineTo(cx - 1.5, cy + 3.5);
  ctx.lineTo(cx + 5.5, cy - 4);
  ctx.strokeStyle = colors.white;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** 레이아웃을 캔버스에 그려요. ctx 는 (CARD_WIDTH × scale) × (CARD_HEIGHT × scale) 크기여야 해요. */
export function drawCard(ctx: CanvasRenderingContext2D, layout: CardLayout, options: CardOptions = BASIC_CARD): void {
  ctx.save();
  ctx.scale(options.scale, options.scale);
  ctx.fillStyle = colors.white;
  ctx.fillRect(0, 0, layout.width, layout.height);

  // 머리글: 날짜 · 핵심 목표 · 요약
  const { header } = layout;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  font(ctx, 26, 500);
  ctx.fillStyle = colors.grey600;
  ctx.fillText(header.caption, header.x, PAD + 30);
  font(ctx, 46, 700);
  ctx.fillStyle = colors.grey900;
  ctx.fillText(ellipsize(ctx, header.title, header.width), header.x, PAD + 100);
  font(ctx, 28, 500);
  ctx.fillStyle = colors.grey700;
  ctx.fillText(header.summary, header.x, PAD + 156);

  // 9×9 칸
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const inner = layout.cellSize - 14;
  for (const c of layout.cells) {
    const style = cellStyle(c.view);
    roundedRect(ctx, c, 8);
    ctx.fillStyle = style.background;
    ctx.fill();
    if (style.border) {
      roundedRect(ctx, { x: c.x + 1.5, y: c.y + 1.5, w: c.w - 3, h: c.h - 3 }, 7);
      ctx.strokeStyle = style.border;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    const text = c.view.text.trim();
    if (text) {
      const size = c.view.kind === 'action' ? 19 : 20;
      const lineHeight = size + 3;
      font(ctx, size, style.weight);
      const lines = wrapText((t) => ctx.measureText(t).width, text, inner, 4);
      const startY = c.y + c.h / 2 - ((lines.length - 1) * lineHeight) / 2;
      ctx.fillStyle = style.color;
      lines.forEach((line, i) => ctx.fillText(line, c.x + c.w / 2, startY + i * lineHeight));
    }
    if (c.view.checked) drawCheck(ctx, c.x + c.w - 15, c.y + 15);
  }

  // 바닥글(워터마크)
  if (layout.footer) {
    font(ctx, 24, 500);
    ctx.fillStyle = colors.grey500;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(layout.footer.text, layout.width / 2, layout.footer.y);
  }
  ctx.restore();
}

export interface RenderedCard {
  /** <img src> 에 바로 쓰는 data URL */
  dataUrl: string;
  /** File.saveBase64 에 넘기는 본문(접두어 없음) */
  base64: string;
  width: number;
  height: number;
}

/** 카드를 PNG 로 그려요. 캔버스를 쓸 수 없는 환경(일부 테스트·구형 웹뷰)이면 null. */
export function renderCard(input: CardInput, options: CardOptions = BASIC_CARD, doc: Document = document): RenderedCard | null {
  try {
    const canvas = doc.createElement('canvas');
    canvas.width = CARD_WIDTH * options.scale;
    canvas.height = CARD_HEIGHT * options.scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    drawCard(ctx, layoutCard(input, options), options);
    const dataUrl = canvas.toDataURL('image/png');
    const comma = dataUrl.indexOf(',');
    if (!dataUrl.startsWith('data:image/png') || comma < 0 || comma === dataUrl.length - 1) return null;
    return { dataUrl, base64: dataUrl.slice(comma + 1), width: canvas.width, height: canvas.height };
  } catch {
    return null;
  }
}
