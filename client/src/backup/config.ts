/**
 * Supabase 프로젝트 설정 (8단계에서 채워요).
 * anon public key 는 공개용 키라 번들에 들어가도 돼요 — 테이블은 RLS 로 직접 접근이 막혀 있고
 * `supabase/schema.sql` 의 RPC 세 개만 열려 있어요. service_role 키는 절대 넣지 않아요.
 */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

export function isBackupConfigured(): boolean {
  return SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20;
}
