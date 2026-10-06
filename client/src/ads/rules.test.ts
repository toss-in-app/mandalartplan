import { describe, expect, it } from 'vitest';

import { createDefaultSettings, normalizeSettings } from '../lib/state';
import { interstitialEligible } from './rules';

describe('interstitialEligible', () => {
  it('오늘 체크가 있고 오늘 아직 안 보여줬을 때만 true', () => {
    const settings = createDefaultSettings();
    expect(interstitialEligible(settings, '2026-10-06', 0)).toBe(false);
    expect(interstitialEligible(settings, '2026-10-06', 1)).toBe(true);
    const shown = { ...settings, ads: { lastInterstitialDate: '2026-10-06' } };
    expect(interstitialEligible(shown, '2026-10-06', 3)).toBe(false);
    expect(interstitialEligible(shown, '2026-10-07', 3)).toBe(true);
  });

  it('settings.ads 는 없거나 이상해도 기본값(null)으로 읽혀요', () => {
    const base = { version: 1, notification: 'unknown', unlocks: { extraBoard: false }, seenContentVersion: 0, firstCheckinAt: null, backup: { enabled: false, key: null, lastBackupAt: null } };
    expect(normalizeSettings(base)?.ads).toEqual({ lastInterstitialDate: null });
    expect(normalizeSettings({ ...base, ads: { lastInterstitialDate: 'nope' } })?.ads).toEqual({ lastInterstitialDate: null });
    expect(normalizeSettings({ ...base, ads: { lastInterstitialDate: '2026-10-06' } })?.ads).toEqual({ lastInterstitialDate: '2026-10-06' });
  });
});
