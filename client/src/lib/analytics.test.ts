import { afterEach, describe, expect, it, vi } from 'vitest';

type Params = { log_name: string; log_type: string; params: Record<string, string> };
const log = vi.fn<(params: Params) => Promise<void>>(() => Promise.resolve());
vi.mock('@apps-in-toss/web-framework', () => ({ Analytics: { log: (p: Params) => log(p) } }));

import { logEvent } from './analytics';

describe('logEvent', () => {
  afterEach(() => {
    log.mockReset();
    log.mockImplementation(() => Promise.resolve());
  });

  it('이름표와 파라미터를 Analytics.log 로 보내요. 값은 문자열로, null·undefined 는 빼요', () => {
    logEvent('action_check', { index: 3, checked: true, todayCount: 0, streak: null, first: undefined, note: 'x' });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({ log_name: 'action_check', log_type: 'event', params: { index: '3', checked: 'true', todayCount: '0', note: 'x' } });
    logEvent('reset');
    expect(log).toHaveBeenLastCalledWith({ log_name: 'reset', log_type: 'event', params: {} });
    logEvent('home_view', { filled: 73, boards: 2 });
    expect(log).toHaveBeenLastCalledWith({ log_name: 'home_view', log_type: 'screen', params: { filled: '73', boards: '2' } });
  });

  it('브릿지가 거절하거나 던져도 조용히 넘어가요', async () => {
    log.mockImplementation(() => Promise.reject(new Error('no bridge')));
    expect(() => logEvent('home_view', { filled: 1, boards: 1 })).not.toThrow();
    await Promise.resolve();
    log.mockImplementation(() => {
      throw new Error('sync');
    });
    expect(() => logEvent('home_view', { filled: 1, boards: 1 })).not.toThrow();
  });
});
