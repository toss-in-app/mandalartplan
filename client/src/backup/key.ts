import { User } from '@apps-in-toss/web-framework';

import { withTimeout } from '../lib/async';

export const BACKUP_KEY_RE = /^k[0-9a-f]{64}$/;
const KEY_TIMEOUT_MS = 5000;

export type BackupKeyErrorCode = 'unsupported' | 'failed';

export class BackupKeyError extends Error {
  constructor(
    public readonly code: BackupKeyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BackupKeyError';
  }
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 토스 익명 키를 그대로 서버에 두지 않고 한 번 더 가공해요. 같은 토스 계정이면 폰이 바뀌어도 같은 값. */
export async function deriveBackupKey(anonymousHash: string): Promise<string> {
  return `k${await sha256Hex(`mandalartplan:${anonymousHash}`)}`;
}

/** 토스앱이 주는 익명 키. 낮은 버전·브라우저에서는 BackupKeyError. */
export async function fetchAnonymousHash(): Promise<string> {
  try {
    if (typeof User.getAnonymousKey.isSupported === 'function' && !User.getAnonymousKey.isSupported()) {
      throw new BackupKeyError('unsupported', '토스앱을 업데이트하면 백업을 쓸 수 있어요');
    }
  } catch (error) {
    if (error instanceof BackupKeyError) throw error;
    /* isSupported 자체가 없는 환경이면 호출해 봐요 */
  }
  try {
    const result = await withTimeout(User.getAnonymousKey(), KEY_TIMEOUT_MS);
    if (!result || typeof result.hash !== 'string' || result.hash.length === 0) {
      throw new BackupKeyError('failed', '사용자 키를 받지 못했어요');
    }
    return result.hash;
  } catch (error) {
    if (error instanceof BackupKeyError) throw error;
    throw new BackupKeyError('failed', '사용자 키를 받지 못했어요');
  }
}
