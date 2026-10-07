import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Params = { options: { templateCode: string }; onEvent: (r: { type: string }) => void; onError: (e: unknown) => void };
const calls: Params[] = [];
let supported = true;
let returnValue: unknown = () => {};

vi.mock('@apps-in-toss/web-framework', () => ({
  Notification: {
    requestAgreement: Object.assign(
      (params: Params) => {
        calls.push(params);
        return returnValue;
      },
      { isSupported: () => supported },
    ),
  },
}));

import { notificationAvailable, requestNotificationAgreement } from './agreement';

describe('requestNotificationAgreement', () => {
  beforeEach(() => {
    calls.length = 0;
    supported = true;
    returnValue = () => {};
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('동의·이미 동의·거부를 구분하고, 템플릿 코드를 그대로 넘겨요', async () => {
    const a = requestNotificationAgreement('mandalartplan-daily-checkin');
    expect(calls[0].options.templateCode).toBe('mandalartplan-daily-checkin');
    calls[0].onEvent({ type: 'newAgreement' });
    await expect(a).resolves.toBe('agreed');

    const b = requestNotificationAgreement('t');
    calls[1].onEvent({ type: 'alreadyAgreed' });
    await expect(b).resolves.toBe('alreadyAgreed');

    const c = requestNotificationAgreement('t');
    calls[2].onEvent({ type: 'agreementRejected' });
    await expect(c).resolves.toBe('declined');
  });

  it('미지원·에러·시간 초과·빈 코드는 던지지 않고 결과로 돌려줘요', async () => {
    supported = false;
    await expect(requestNotificationAgreement('t')).resolves.toBe('unsupported');
    expect(notificationAvailable()).toBe(false);
    supported = true;

    const errored = requestNotificationAgreement('t');
    calls[0].onError({ code: 'UNSUPPORTED_APP_VERSION', message: '업데이트' });
    await expect(errored).resolves.toBe('unsupported');

    const failed = requestNotificationAgreement('t');
    calls[1].onError(new Error('bridge'));
    await expect(failed).resolves.toBe('failed');

    const silent = requestNotificationAgreement('t');
    await vi.advanceTimersByTimeAsync(120_001);
    await expect(silent).resolves.toBe('failed');

    await expect(requestNotificationAgreement('')).resolves.toBe('unsupported');
  });

  it('반환값이 함수가 아니어도(실기기 관측) 정상 동작해요', async () => {
    returnValue = {};
    const r = requestNotificationAgreement('t');
    calls[0].onEvent({ type: 'newAgreement' });
    await expect(r).resolves.toBe('agreed');
  });
});
