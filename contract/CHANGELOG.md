# mandalart 계약 변경 이력

## v1 — 2026-09-28 (3단계 초안, 승인 대기)
- `content.schema.json`: contentVersion·minClientVersion·updatedAt·notice·season·templates(예시 2개)·cheers(20). 문자열만, URL·느낌표·이모지 금지(pattern).
- `state.schema.json`: Storage 키 3개 — boards(판 1~2)·checkins(판별 날짜→실천 index)·settings(알림 상태·잠금·본 콘텐츠 버전·첫 체크인).
- `events.md`: 분석 이벤트 11개, 광고 그룹 4개, 알림 템플릿 1개, 공유 형식.
- 규칙: 같은 minClientVersion 안에서는 필드 추가만. 클라는 모르는 필드 무시. 바뀌면 여기에 한 줄.

## 2026-09-29 [client] 기능 1 체크인 화면
- 계약 변경 없음. `checkins.v1` 기록·`cheers` 사용 시작. 400일 초과분은 완료 때 오래된 날부터 제거.

## 2026-09-29 v2 [client] 화면 구조 개정 (사용자 피드백)
- `state.schema.json` sub 에서 `done`(영구 달성) 제거. 판에는 영구 상태 없음, 오늘 체크만 `checkins.v1`. 예전 값은 읽을 때 버림.
- 체크가 0개가 된 날은 `days` 에서 삭제 → 연속 일수 = 하나라도 체크한 날.
- `events.md`: `checkin_complete` → `action_check`, `today_view` 추가. 광고 그룹 `interstitial-checkin-done`·`banner-checkin` → `interstitial-today`·`banner-today`. 알림 링크는 홈.
- 화면: `checkin` 삭제, `sub/:s`·`overview`·`today` 추가 (`wireframes/mandalartplan-flow.md` v2).

## 2026-10-04 [client] 기능 2 설정·예시 템플릿
- 계약 변경 없음. `content.templates` 적용 시 그 판의 `checkins.byBoard[판]` 삭제(실천이 바뀌므로). 약관·개인정보 주소는 `STATIC_BASE_URL` 상수.

## 2026-10-04 v3 백업·복원 (Supabase + 익명 키)
- `state.schema.json` settings 에 `backup { enabled, key, lastBackupAt }` 추가(필드 추가만, 없으면 기본값).
- `backup.schema.json` 신설: 서버 페이로드 = boards + checkins + unlocks + exportedAt.
- `supabase/schema.sql`: 테이블 `mandalart_backups`(RLS, 정책 없음) + RPC get/upsert/delete(security definer, anon 실행 허용).
- `events.md` 백업 이벤트 5개.

## 2026-10-06 [client] 기능 4 공유 화면
- 계약 변경 없음. `events.md` 공유 절대로: 이미지 1080×1350 PNG(워터마크 "만다라트 · 토스 앱에서 만다라트 검색", 오늘 체크 표시), 텍스트는 `boardToText`, 링크는 `Share.createLink({ path: 'intoss://mandalartplan', ogImageUrl })`.
- `apps-in-toss.config.ts` `permissions` 에 `{ name: 'photos', access: 'write' }` 선언(이미지 저장). 누를 때 `requestPermission` 으로 묻고 거부하면 글·링크 공유만.
- 고화질(2160×2700, 워터마크 없음)은 같은 렌더러의 옵션(`HD_CARD`)으로 준비만 — 리워드 광고(기능 5)에서 연결.

## 2026-10-06 v4 [client] 기능 5 광고
- `state.schema.json` settings 에 `ads { lastInterstitialDate }` 추가(필드 추가만, 없으면 null) — 전면 광고 하루 1회 상한.
- 광고 그룹 ID 는 `client/src/ads/config.ts`: 비어 있으면 공식 테스트 ID(`ait-ad-test-interstitial-id`·`ait-ad-test-rewarded-id`·`ait-ad-test-banner-id`), 라이브 ID 는 `.env.production` 의 `VITE_AD_GROUP_INTERSTITIAL_TODAY`·`VITE_AD_GROUP_REWARDED_HD_IMAGE`·`VITE_AD_GROUP_REWARDED_EXTRA_BOARD`·`VITE_AD_GROUP_BANNER_TODAY`.
- 지점: 전면 = 홈 '오늘 기록 보기'(오늘 체크 1개 이상·하루 1회·사전 로딩·실패 시 건너뜀) · 리워드 = 공유 '고화질로 저장'(`userEarnedReward` 에서만, 보상은 2160×2700 워터마크 없는 저장 1회) · 배너 = 오늘 기록 목록 하단 1개(카드형, 실패 시 숨김). 설정 '두 번째 판' 리워드는 기능 7 에서 같은 훅으로.

