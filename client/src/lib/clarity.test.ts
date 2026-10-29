import Clarity from '@microsoft/clarity';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startClarity, stopClarity } from './clarity';

vi.mock('@microsoft/clarity', () => ({ default: { init: vi.fn(), setTag: vi.fn(), consent: vi.fn() } }));

beforeEach(() => {
  vi.mocked(Clarity.init).mockReset();
  vi.mocked(Clarity.setTag).mockReset();
  vi.mocked(Clarity.consent).mockReset();
});

afterEach(() => {
  delete window.clarity;
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
});

describe('stopClarity (설정 사용 기록 분석 끄기)', () => {
  it('불러온 적이 있으면 쿠키를 지워요(consent false)', () => {
    window.clarity = vi.fn();
    stopClarity();
    expect(Clarity.consent).toHaveBeenCalledWith(false);
  });

  it('불러온 적이 없으면 아무것도 하지 않고, 실패해도 앱을 멈추지 않아요', () => {
    stopClarity();
    expect(Clarity.consent).not.toHaveBeenCalled();
    window.clarity = vi.fn();
    vi.mocked(Clarity.consent).mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => stopClarity()).not.toThrow();
  });
});
