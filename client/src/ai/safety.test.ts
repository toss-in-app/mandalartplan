import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { SELF_HARM_SOURCES, looksLikeSelfHarm } from './safety';

describe('자해·자살 표현', () => {
  it('띄어쓰기와 상관없이 찾아요', () => {
    expect(looksLikeSelfHarm('죽고 싶다')).toBe(true);
    expect(looksLikeSelfHarm('', '극단적 선택')).toBe(true);
    expect(looksLikeSelfHarm('손목 긋기')).toBe(true);
    expect(looksLikeSelfHarm('삶을 끝내기')).toBe(true);
  });

  it('다른 뜻으로 흔히 쓰는 말은 걸지 않아요', () => {
    expect(looksLikeSelfHarm('자살예방 상담 봉사 100시간')).toBe(false);
    expect(looksLikeSelfHarm('유서 깊은 사찰 순례')).toBe(false);
    expect(looksLikeSelfHarm('성적에 목매지 않기')).toBe(false);
    expect(looksLikeSelfHarm('8구단 드래프트 1순위', '', '배고파서 밥 먹기')).toBe(false);
  });

  it('서버(Edge Function)와 같은 목록이에요', () => {
    // vitest 는 client/ 에서 돌아요(jsdom 이라 import.meta.url 이 파일 주소가 아님)
    const project = process.cwd().endsWith('client') ? resolve(process.cwd(), '..') : process.cwd();
    const server = readFileSync(resolve(project, 'supabase/functions/mandalart-draft/safety.ts'), 'utf8');
    for (const source of SELF_HARM_SOURCES) expect(server).toContain(`'${source}'`);
  });
});
