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

## 2026-10-07 [client] 기능 6 알림 동의
- 계약 변경 없음(`settings.notification` 은 v1 부터). `events.md` 알림 템플릿의 발송 코드를 공식 규칙(`{appName}-` 접두)에 맞춰 `mandalartplan-daily-checkin` 으로, 제목·내용을 콘솔 글자 수 규칙(7자·25자)에 맞춰 고침. 템플릿 코드는 `.env` 의 `VITE_NOTIFICATION_TEMPLATE_CODE`.
- 흐름: 홈 "매일 저녁 알림 받기" 행은 설정으로 보내지 않고 바로 동의 화면을 띄움(설계는 홈→설정이었음, 한 번 덜 누르게). 오늘 기록 위 버튼·설정 행도 같은 호출. 거부하면 홈·오늘 기록에서는 숨기고 설정에서만 다시 켬. 동의한 뒤 끄는 건 토스 앱 알림 설정(철회 경로).

## 2026-10-07 [client] 기능 7 두 번째 판
- 계약 변경 없음(`boards.boards` 1~2개·`active`·`settings.unlocks.extraBoard` 는 v1 부터). `events.md` 에 `board_add`·`board_switch` 이벤트 2개 추가(기능 8 에서 로깅).
- 흐름: 설정 '두 번째 만다라트 판'(잠김, 오른쪽 '광고 보기') → 안내 다이얼로그(왼쪽 '닫기') → 리워드 광고(`rewarded-extra-board`) → `userEarnedReward` 일 때만 `unlocks.extraBoard = true`(영구) + 빈 판 추가(`active` 는 새 판) → 홈. 끝까지 안 봤거나 못 불러오면 잠금 그대로 + 토스트.
- 잠금이 풀렸는데 판이 하나면(처음부터 다시 만든 뒤 등) 광고 없이 '빈 판을 하나 더 만들어요' 로 추가. 판이 2개면 홈 제목이 `Top.TitleSelector` 가 되어 '판 바꾸기' 바텀시트(버튼으로만)로 전환. 체크 기록은 `checkins.byBoard[판 id]` 그대로 판별.
- 백업 복원 등으로 판이 이미 2개면 잠금이 풀린 것으로 봄. '처음부터 다시 만들기' 는 두 판을 모두 지우고 빈 판 하나로(잠금 해제는 남음).

## 2026-10-08 [client] 기능 8 분석 이벤트
- `events.md` 의 이벤트 20개를 `Analytics.log` 로 보냄(`client/src/lib/analytics.ts` `logEvent`). `log_type` 은 화면 진입(`home_view`·`today_view`)만 `screen`, 나머지 `event`. 값은 문자열로, null·undefined 는 뺌. 실패·미지원은 무시.
- 세부 규칙(계약 보충): `board_filled` 는 보고 있는 판의 채운 칸이 73이 되는 순간(이전 값이 73 미만일 때만 — 예시 템플릿이 73칸을 채우면 그때 1회), `templateId` 가 없으면 `none`. `board_edit` 는 block 화면에 들어올 때와 나갈 때 `updatedAt` 이 다르면 1회. `ad_interstitial` 은 전면 광고 조건(오늘 체크 있음·하루 1회)이 맞아 시도했을 때만 shown/skipped(미로딩)/failed(띄우기 실패). `backup_run.auto` 는 자동 백업 true, '지금 백업하기' false. `backup_error.stage` 는 key/get/upsert/delete(그 외 unknown).
- 핵심 지표 후보(9단계 콘솔 입력): 활성 `action_check` · 전환 `board_filled`(대표)·`share_image_save`·`notification_agree`. 콘솔 '알림 받기 동의한 유저' 템플릿도 있으니 둘 중 하나.

