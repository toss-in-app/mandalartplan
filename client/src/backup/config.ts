/**
 * Supabase 프로젝트 설정 (8단계에서 채워요).
 *
 * 키는 대시보드 API Keys → "Publishable and secret API keys" 탭의 **publishable key**(`sb_publishable_…`)를 써요.
 * 브라우저에 들어가도 되는 저권한 키로, 서버에서는 `anon` 역할로 취급돼요(테이블은 RLS 로 막혀 있고
 * `supabase/schema.sql` 의 RPC 세 개만 열림). 예전 `anon` JWT 키도 아직 되지만 2026년 말 폐지 예정.
 * **secret key(`sb_secret_…`)·service_role 키는 절대 넣지 않아요.**
 */
export const SUPABASE_URL = '';
export const SUPABASE_PUBLISHABLE_KEY = '';

export function isBackupConfigured(): boolean {
  return SUPABASE_URL.startsWith('https://') && SUPABASE_PUBLISHABLE_KEY.length > 20 && !SUPABASE_PUBLISHABLE_KEY.startsWith('sb_secret_');
}
