import { fetchAnonymousHash, sha256Hex } from '../backup/key';

/**
 * 서버가 하루 호출 수를 세는 키: 'k' + sha256('ai:' + 토스 익명 키). 백업 키와 다른 값이라 둘을 이어 붙일 수 없어요.
 * 저장하지 않고 앱이 켜져 있는 동안만 기억해요. 실패하면 다음에 다시 받아요.
 */
export async function deriveAiKey(anonymousHash: string): Promise<string> {
  return `k${await sha256Hex(`ai:${anonymousHash}`)}`;
}

let cached: Promise<string> | null = null;

/** 실패하면 BackupKeyError(unsupported·failed) 를 던져요 */
export function getAiKey(): Promise<string> {
  if (!cached) {
    cached = fetchAnonymousHash()
      .then(deriveAiKey)
      .catch((error: unknown) => {
        cached = null;
        throw error;
      });
  }
  return cached;
}
