import { BackupApiError } from './api';
import { BackupKeyError } from './key';

/** 분석 이벤트 `backup_error` 의 stage·code (events.md: key/get/upsert/delete). 개인정보 없음. */
export function describeBackupError(error: unknown): { stage: string; code: string } {
  if (error instanceof BackupKeyError) return { stage: 'key', code: error.code };
  if (error instanceof BackupApiError) return { stage: error.stage, code: error.code };
  return { stage: 'unknown', code: error instanceof Error ? error.name : 'unknown' };
}
