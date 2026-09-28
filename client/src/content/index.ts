/**
 * 콘텐츠(계약: contract/content.schema.json).
 * 번들 동봉본(bundled.json)으로 즉시 그리고, 원격 content.json 은 앱을 열 때 한 번 시도해요.
 * 원격이 실패하거나 형식이 다르거나 minClientVersion 이 이 클라보다 크면 번들본을 써요.
 */
import { withTimeout } from '../lib/async';
import { MAX_TEXT, SUB_COUNT, ACTION_COUNT } from '../lib/mandalart';
import bundledJson from './bundled.json';

/** 이 클라가 이해하는 콘텐츠 형식 버전 */
export const CONTENT_CLIENT_VERSION = 1;
export const CONTENT_URL = 'https://toss-in-app.github.io/mandalartplan/content.json';
const FETCH_TIMEOUT_MS = 3000;

export interface ContentTemplateSub {
  title: string;
  actions: string[];
}

export interface ContentTemplate {
  id: string;
  title: string;
  goal: string;
  subs: ContentTemplateSub[];
}

export interface ContentSeason {
  id: string;
  title: string;
  from: string;
  to: string;
  message: string;
}

export interface Content {
  contentVersion: number;
  minClientVersion: number;
  updatedAt: string;
  notice: string | null;
  season: ContentSeason | null;
  templates: ContentTemplate[];
  cheers: string[];
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const FORBIDDEN_RE = /https?:\/\/|intoss:\/\/|!/;

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v.length === 0 || v.length > max || FORBIDDEN_RE.test(v)) return null;
  return v;
}

function template(value: unknown): ContentTemplate | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === 'string' && SLUG_RE.test(raw.id) ? raw.id : null;
  const title = text(raw.title, MAX_TEXT);
  const goal = text(raw.goal, MAX_TEXT);
  if (!id || !title || !goal || !Array.isArray(raw.subs) || raw.subs.length !== SUB_COUNT) return null;
  const subs: ContentTemplateSub[] = [];
  for (const s of raw.subs) {
    if (!s || typeof s !== 'object') return null;
    const sr = s as Record<string, unknown>;
    const st = text(sr.title, MAX_TEXT);
    if (!st || !Array.isArray(sr.actions) || sr.actions.length !== ACTION_COUNT) return null;
    const actions: string[] = [];
    for (const a of sr.actions) {
      const at = text(a, MAX_TEXT);
      if (!at) return null;
      actions.push(at);
    }
    subs.push({ title: st, actions });
  }
  return { id, title, goal, subs };
}

/** 계약대로인지 확인해서 Content 로 만들어요. 모르는 필드는 무시, 모양이 다르면 null. */
export function normalizeContent(input: unknown): Content | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const contentVersion = raw.contentVersion;
  const minClientVersion = raw.minClientVersion;
  if (!Number.isInteger(contentVersion) || (contentVersion as number) < 1) return null;
  if (!Number.isInteger(minClientVersion) || (minClientVersion as number) < 1) return null;
  if (typeof raw.updatedAt !== 'string' || !DATE_RE.test(raw.updatedAt)) return null;

  const notice = raw.notice === null || raw.notice === undefined ? null : text(raw.notice, 60);
  if (raw.notice && notice === null) return null;

  let season: ContentSeason | null = null;
  if (raw.season) {
    if (typeof raw.season !== 'object') return null;
    const s = raw.season as Record<string, unknown>;
    const id = typeof s.id === 'string' && SLUG_RE.test(s.id) ? s.id : null;
    const title = text(s.title, MAX_TEXT);
    const message = text(s.message, 60);
    const from = typeof s.from === 'string' && DATE_RE.test(s.from) ? s.from : null;
    const to = typeof s.to === 'string' && DATE_RE.test(s.to) ? s.to : null;
    if (!id || !title || !message || !from || !to || from > to) return null;
    season = { id, title, from, to, message };
  }

  if (!Array.isArray(raw.templates) || raw.templates.length < 1) return null;
  const templates: ContentTemplate[] = [];
  const ids = new Set<string>();
  for (const t of raw.templates) {
    const tpl = template(t);
    if (!tpl || ids.has(tpl.id)) return null;
    ids.add(tpl.id);
    templates.push(tpl);
  }

  if (!Array.isArray(raw.cheers) || raw.cheers.length < 5) return null;
  const cheers: string[] = [];
  for (const c of raw.cheers) {
    const ct = text(c, MAX_TEXT);
    if (!ct) return null;
    cheers.push(ct);
  }

  return {
    contentVersion: contentVersion as number,
    minClientVersion: minClientVersion as number,
    updatedAt: raw.updatedAt,
    notice,
    season,
    templates,
    cheers,
  };
}

const normalizedBundled = normalizeContent(bundledJson);
if (!normalizedBundled) {
  throw new Error('번들 콘텐츠(bundled.json)가 계약과 다릅니다. npm run content 로 다시 만드세요.');
}
const bundled: Content = normalizedBundled;

export function getBundledContent(): Content {
  return bundled;
}

/**
 * 원격 콘텐츠를 한 번 시도해요. 성공 조건: 계약대로 + minClientVersion ≤ 클라 + contentVersion ≥ 번들.
 * 아니면 null (호출한 쪽이 번들본을 그대로 씀).
 */
export async function fetchRemoteContent(url: string = CONTENT_URL): Promise<Content | null> {
  try {
    const response = await withTimeout(fetch(url, { cache: 'no-store' }), FETCH_TIMEOUT_MS);
    if (!response.ok) return null;
    const content = normalizeContent(await response.json());
    if (!content) return null;
    if (content.minClientVersion > CONTENT_CLIENT_VERSION) return null;
    if (content.contentVersion < bundled.contentVersion) return null;
    return content;
  } catch {
    return null;
  }
}

/** 오늘 날짜가 기간 안이면 시즌, 아니면 null */
export function activeSeason(content: Content, today: string): ContentSeason | null {
  const s = content.season;
  if (!s) return null;
  return s.from <= today && today <= s.to ? s : null;
}

/** 날짜 문자열로 격려 문구 하나를 골라요 (같은 날은 같은 문구). */
export function cheerFor(content: Content, dateKey: string): string {
  let hash = 0;
  for (const ch of dateKey) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return content.cheers[hash % content.cheers.length];
}
