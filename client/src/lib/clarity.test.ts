import Clarity from '@microsoft/clarity';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { startClarity } from './clarity';

vi.mock('@microsoft/clarity', () => ({ default: { init: vi.fn(), setTag: vi.fn() } }));

beforeEach(() => {
  vi.mocked(Clarity.init).mockReset();
  vi.mocked(Clarity.setTag).mockReset();
});

describe('startClarity (3.0.3 Microsoft Clarity)', () => {
  it('출시 빌드에서 프로젝트 ID 가 있으면 켜고 앱 버전 태그를 달아요', () => {
    expect(startClarity({ mode: 'production', projectId: ' z58r4u0qo8 ', version: '3.0.3' })).toBe(true);
    expect(Clarity.init).toHaveBeenCalledWith('z58r4u0qo8');
    expect(Clarity.setTag).toHaveBeenCalledWith('app_version', '3.0.3');
  });

  it('개발 서버·테스트·QR 테스트 광고 번들이거나 ID 가 없으면 켜지 않아요', () => {
    for (const mode of ['development', 'test', 'test-ads']) expect(startClarity({ mode, projectId: 'z58r4u0qo8', version: '3.0.3' })).toBe(false);
    expect(startClarity({ mode: 'production', projectId: undefined, version: '3.0.3' })).toBe(false);
    expect(startClarity({ mode: 'production', projectId: '  ', version: '3.0.3' })).toBe(false);
    expect(Clarity.init).not.toHaveBeenCalled();
  });

  it('불러오다 실패해도 앱을 멈추지 않아요', () => {
    vi.mocked(Clarity.init).mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(startClarity({ mode: 'production', projectId: 'z58r4u0qo8', version: '3.0.3' })).toBe(false);
  });

  it('index.html 의 body 가 화면 글자를 전부 가려요(data-clarity-mask)', () => {
    // vitest 는 client/ 에서 돌아요(jsdom 이라 import.meta.url 이 파일 주소가 아님)
    const client = process.cwd().endsWith('client') ? process.cwd() : resolve(process.cwd(), 'client');
    expect(readFileSync(resolve(client, 'index.html'), 'utf8')).toContain('<body data-clarity-mask="True">');
  });
});
