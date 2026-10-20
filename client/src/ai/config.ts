import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isBackupConfigured } from '../backup/config';

/**
 * AI 초안 서버 = 백업과 같은 Supabase 프로젝트의 Edge Function `mandalart-draft` (계약 contract/ai-draft.api.md).
 * publishable key 만 `apikey` 헤더로 보내요. Anthropic 키는 Supabase secrets 에만 있고 앱에는 절대 없어요.
 */
export const AI_DRAFT_URL = `${SUPABASE_URL}/functions/v1/mandalart-draft`;
export const AI_PUBLISHABLE_KEY = SUPABASE_PUBLISHABLE_KEY;

/** Supabase 주소·키가 없으면(설정 전 개발 환경) AI 버튼을 숨겨요 */
export function isAiConfigured(): boolean {
  return isBackupConfigured();
}
