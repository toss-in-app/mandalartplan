import { describe, expect, it } from 'vitest';

import { MAX_TEXT } from '../lib/mandalart';
import { CONTENT_CLIENT_VERSION, activeSeason, cheerFor, getBundledContent, normalizeContent } from './index';

describe('번들 콘텐츠', () => {
  const content = getBundledContent();

  it('계약대로예요: 템플릿 8×8, 40자 이하, 격려 문구 5개 이상', () => {
    expect(content.minClientVersion).toBeLessThanOrEqual(CONTENT_CLIENT_VERSION);
    expect(content.templates.length).toBeGreaterThanOrEqual(1);
    for (const t of content.templates) {
      expect(t.subs).toHaveLength(8);
      for (const sub of t.subs) {
        expect(sub.actions).toHaveLength(8);
        for (const a of sub.actions) expect(a.length).toBeLessThanOrEqual(MAX_TEXT);
      }
    }
    expect(content.cheers.length).toBeGreaterThanOrEqual(5);
  });

  it('시즌은 기간 안에서만, 격려 문구는 날짜마다 정해져요', () => {
    expect(activeSeason(content, '2026-09-28')).toBeNull();
    expect(activeSeason(content, '2027-01-01')?.id).toBe('newyear-2027');
    expect(cheerFor(content, '2026-09-28')).toBe(cheerFor(content, '2026-09-28'));
    expect(content.cheers).toContain(cheerFor(content, '2026-09-28'));
  });
});

describe('normalizeContent', () => {
  it('URL·느낌표·중복 id·8칸 아닌 템플릿은 거부해요', () => {
    const base = JSON.parse(JSON.stringify(getBundledContent()));
    expect(normalizeContent(base)).not.toBeNull();
    expect(normalizeContent({ ...base, notice: '자세히 https://x.y' })).toBeNull();
    expect(normalizeContent({ ...base, cheers: ['좋아요!', 'a', 'b', 'c', 'd'] })).toBeNull();
    expect(normalizeContent({ ...base, templates: [base.templates[0], base.templates[0]] })).toBeNull();
    const broken = JSON.parse(JSON.stringify(base));
    broken.templates[0].subs[0].actions.pop();
    expect(normalizeContent(broken)).toBeNull();
    expect(normalizeContent({ ...base, extraField: 1 })).not.toBeNull(); // 모르는 필드는 무시
  });
});
