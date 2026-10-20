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

## 2026-10-08 [client] 기능 9 홈 마무리
- 계약 변경 없음. `settings.seenContentVersion`(v1 부터 있던 '본 콘텐츠 버전')을 이제 씀: 홈이 그리는 콘텐츠(번들 또는 원격)의 `contentVersion` 을 상태를 읽은 뒤 1회 저장(더 큰 값일 때만).
- 홈 안내 한 줄 규칙 확정: 빈 판 "가운데 칸을 눌러 핵심 목표부터 정해 보세요" / 목표는 있는데 실천이 0개 "세부 목표 칸을 눌러 실천을 적어 보세요"(추가) / 실천은 있는데 체크 기록 없음 "n월 n일 · 세부 목표를 눌러 실천을 체크해요" / 연속 중 "n일째 이어가는 중 · 오늘은 아직" / 오늘 체크 "n일째 · 오늘 n개 했어요".
- 공지(`content.notice`, 60자)와 시즌 문구(`content.season.message`, 기간 안)는 Top 아래 한 줄, 공지가 우선. 원본은 `content/content.source.json` → `npm run content`(프로젝트 루트) → `static/content.json` + 번들. 문구 점검: 느낌표·이모지·습니다체 없음(콘텐츠는 검증 스크립트가 막음).

## 2026-10-08 [contract] 6단계 계약 검증
- `scripts/check-contract.mjs`(`npm run contract`): 콘텐츠 3벌(원본·번들·static)과 샘플을 `content.schema.json` 으로, `samples/state.sample.json` 을 `state.schema.json` 으로, 샘플로 조립한 백업 페이로드를 `backup.schema.json` 으로 검증. `npm run check` 는 계약 → 타입 → 린트 → 테스트 → 빌드.
- `samples/state.sample.json` 에 v3 에서 빠졌던 `settings.backup` 추가(검증이 잡아냄). 스키마 변경 없음.

## 2026-10-16 v3 [client] 기록 통계 (주간·월간 탭)
- 상태·콘텐츠·백업 스키마 변경 없음. 기존 `checkins.v1` 날짜별 기록으로 계산(`client/src/lib/stats.ts`).
- `events.md`: `stats_view`(period·offset·activeDays·checks) 추가.
- 홈 버튼 라벨 '오늘 기록 보기' → '기록 보기', 화면 제목 '오늘 기록' → '기록' (2026-10-16 사용자 지적). 이벤트 이름 `today_view`·광고 그룹 이름은 그대로.

## 2026-10-19 [client] 홈 가운데 탭·편집 위치·세부 목표 완료 표시 (사용자 피드백)
- 계약 변경 없음(`state`·`content`·`events` 그대로). 해시 경로만 `#/block/:b/:cell`(선택, 커서 칸) 추가 — 딥링크 계약(`intoss://mandalartplan/...`)은 영향 없음.
- 홈: 편집은 오른쪽 위 `편집` 버튼. 가운데(핵심 목표) 칸은 목표가 있으면 전체 보기, 비어 있을 때만 편집. 공유 버튼은 전체 보기 화면 오른쪽 위로 이동.
- 세부 목표 화면: 가운데 칸은 누를 수 없는 이름표, 빈 실천 칸은 그 칸부터 편집. 전체 보기: 가운데 블록은 누를 수 없음.
- 글이 있는 실천을 오늘 전부 체크한 세부 목표 칸은 홈·전체 보기·세부 화면 가운데에서 진해지고(브랜드 36% 틴트 + 테두리, grey900 대비 10:1) ✓ 표시. 홈·세부 안내 문구에 "오늘 실천을 다 했어요".

## 2026-10-19 [client] 1.0.1 홈 전면 광고 사전 안내
- 계약 변경 없음(`state`·`content`·`events` 그대로). 앱 버전 `client/package.json` 1.0.0 → 1.0.1(설정 화면 표시).
- 홈 '기록 보기': 다음 탭에 전면 광고가 나올 차례면(오늘 체크 1개 이상·오늘 아직 안 봄·광고 지원·불러오기 실패 아님) 버튼에 흰 AD 표시 + 접근성 이름 '광고 보고 기록 보기', 버튼 줄 아래 안내 "기록 보기를 누르면 광고가 한 번 나와요. 오늘은 그 뒤로 광고 없이 볼 수 있어요." 광고를 본 뒤·불러오기 실패 뒤에는 둘 다 사라짐. 근거: 10/22 노출 정책 추천 미니앱 UX 원칙 2(전면광고 전 문구·광고 아이콘으로 미리 알림, 반복 금지).

## 2026-10-20 [client] 1.1.0 편집 방식 — 칸을 눌러 바텀시트에서 적기 (사용자 피드백)
- 계약 변경 없음. 앱 버전 1.0.1 → 1.1.0.
- 편집 화면(`block/:n`): 아래의 입력칸 9개를 없애고, 3×3(main 크기) 칸을 누르면 TDS `BottomSheet`(hasTextField)에 그 칸의 `TextField` 를 띄움. 제목 = 칸 이름(핵심 목표·세부 목표 n·실천 n), 부제 = 위 칸의 글. '완료'·Enter 로 반영(앞뒤 공백 제거), 시트를 닫으면 버림. 한글 조합 중 Enter 무시. 칸을 누른 그 순간 `flushSync` 로 시트를 그리고 입력칸에 포커스(iOS 웹뷰 키보드), 시트가 열릴 때도 다시 포커스.
- 세부 목표 화면의 빈 실천 칸 → `#/block/:b/:cell` → 그 칸의 입력창이 바로 열림.
- 칸 접근성 이름: 오늘 체크를 넘긴 화면(홈·세부 목표)만 실천 칸을 '오늘 했어요/아직' 토글로 읽고, 편집 화면은 칸 글만.
- 같은 날 시트 디자인 다듬기(사용자 "팝업이 안 예쁘다"): 질문형 제목, 3×3 위치 아이콘 + 위 칸의 글 알약(브랜드 10% 틴트), 직접 그린 칸 이름 라벨, TDS `TextArea` big(자동 높이, 줄바꿈은 공백으로, Enter = 완료), 글자 수 n/40, 커서는 글 끝. 밑줄·커서는 TDS 기본 파랑 대신 브랜드 색(`index.css` `.mg-cell-editor`).
- 같은 날 질문에 위 칸 이름 넣기(사용자 "이 칸 대신 해당 이름"): 세부 목표 칸 "{핵심 목표} 칸의 세부 목표는 무엇인가요?"(핵심 목표가 비면 "목표를 이루려면 무엇이 필요할까요?"), 실천 칸 "{세부 목표 또는 '세부 목표 n'} 칸의 실천은 무엇인가요?". 이름은 16자 넘으면 줄임. 위 칸 이름이 제목으로 가서 알약·별도 라벨은 빼고 위치 아이콘 옆 칸 이름 한 줄만.
- 같은 날 빈 칸 정리(사용자 "초기화·처음에 목표 1, 목표 2 가 써 있음 → 비워 두고, 누르면 목표를 정하게"): 세부 목표 칸 자리 표시 `목표 n` 제거(`lib/cells.ts`, 읽는 이름은 '세부 목표 n'), '비어 있어요' 는 실천 칸만. 홈의 빈 핵심 목표·세부 목표 칸과 세부 목표 화면의 빈 실천 칸은 누르면 그 자리에서 칸 편집 시트(화면 이동 없음). 시트는 `lib/cellEdit.ts`(질문·반영) + `components/CellEditorSheet.tsx` + `hooks/useCellEditor.tsx` 로 나눠 편집 화면·홈·세부 목표 화면이 같이 씀.
- 같은 날 빈 칸 초대 표시(사용자 "비면 너무 휑함 → 효과나 텍스트로"): 누를 수 있는 빈 세부 목표·실천 칸 = 점선 브랜드 테두리 + 옅은 틴트 + '+' 아이콘(`Block` invite), 다음에 채울 칸(`lib/cells.ts` `nextEmptyCell`: 가운데 → 둘레 첫 빈 칸)만 '눌러서 적기' + 바깥으로 퍼지는 테두리 애니메이션(`grid.css` `.mg-cell-next`, prefers-reduced-motion 이면 멈춤). 홈 안내: 핵심 목표만 있으면 '둘레 칸을 눌러 세부 목표를 정해 보세요'.

## 2026-10-20 v5 [contract] 2.0 AI 초안 (설계 승인)
- `state.schema.json`(필드 추가만): `boards[].aiDraft`(`{ at, model, promptVersion }` 또는 null — AI 결과를 넣은 판, 'AI 초안' 표시 근거) · `settings.ai`(`noticeAt` = 생성형 AI 고지 확인 시각, `runs` = 기기 날짜별 AI 실행 수, 하루 10회). 없으면 기본값. 백업 페이로드는 boards 를 그대로 싣으니 `aiDraft` 도 백업·복원된다.
- `ai-draft.api.md` 신설(`plans/` 에서 옮김): Edge Function `POST /functions/v1/mandalart-draft`, `mode` subs/actions, 오류 코드 6개. 구현하며 정함: 실천은 요청 하나에 세부 목표 하나(`only` 필수, 판 전체는 클라가 8개 동시 요청 → 진행 n/8), 한도는 호출 기준 키당 하루 100·전체 30,000.
- `events.md`: AI 이벤트 5개(`ai_notice_agree`·`ai_draft_start`·`ai_draft_reward`·`ai_draft_result`·`ai_draft_apply`), 자해 표현 감지는 기록하지 않음. `board_filled` 에 `ai` 파라미터(AI 가 핵심 전환에 주는 효과를 보려고). 광고 그룹 `rewarded-ai-draft`. 알림 템플릿 제목 "실천 체크 시간"(8자) → "실천 체크"(7자 규칙). 발송은 매일 20:00(사용자 결정 — 21~08시는 다음 날 08시로 밀릴 수 있어서), 앱 문구·동의문 "저녁 8시".
- 클라 구현(2026-10-20): `client/src/ai/`(rules·safety·api·key·config·messages·useAiDraft), 화면 `#/draft`(DraftScreen), 고지 시트(AiNoticeSheet), 'AI 초안' 배지(홈·전체 보기·미리보기), 공유 이미지 머리글·공유 글 끝 'AI 초안 포함'. 예시 템플릿을 넣으면 `aiDraft` 를 지움.
- 2026-10-20 사용자 결정 'AI 칸을 다 고치면 표시 없애기': `aiDraft.cells`(AI 가 쓰고 아직 안 고친 칸 번호) 추가 — 사용자가 칸을 고치면 빠지고, 다 빠지면 `aiDraft = null`. 한 칸만 고쳐도 없애는 안은 나머지 AI 글이 표시 없이 남아 정책 2-4 위반 소지라 채택하지 않음.

## 2026-10-20 [client] 2.0.0 출시 번들 — AI 리워드 지면 임시 공유 (공지 54047)
- 계약 변경 없음(`state`·`content` 그대로). 콘솔 MCP `iaa_placement_group_create` 가 리워드 지면 신규 생성을 거부(앱인토스 공지 54047 '전면·리워드 광고 지면 신규 생성 오류', 2026-10-19 16:48 KST~, 복구 미정) → 사용자 결정으로 `rewarded-ai-draft` 는 `rewarded-extra-board` 지면(`ait.v2.live.4f0aaab3a62749d1`)을 함께 씀. 콘솔에서 그 지면의 보상 이름을 '두 번째 만다라트 판' → '기회'(1)로, 표시 이름에 'AI 초안(임시)'을 더함(사용자 확인).
- 앱: 두 키가 같은 그룹이면 리워드 훅 하나로 한 번만 불러옴(`App.tsx` `aiSharesExtraBoard`). 출시 검사(`check-release-bundle.mjs`)는 `config.ts` 의 `VITE_AD_GROUP_*` 키가 `.env.production` 에 모두 있고 그 고유 라이브 ID 가 번들에 전부 있는지 확인(같은 ID 공유 허용) — 2.0.0 번들: 테스트 ID 0개, 라이브 4개(설정 5곳).
- 복구 공지 뒤: AI 전용 지면 생성 → `.env.production` 교체 → 2.0.1. 두 번째 판 지면의 보상·표시 이름 원복 검토.

## 2026-10-20 [server] 출시 뒤 취약점 점검 — 서버 상한 (앱 업데이트 없음)
- 계약 변경 없음(요청·응답·오류 코드 그대로). `supabase/schema.sql` 두 함수만 바꿔 서울 운영 DB 에 반영(롤백 트랜잭션 시험 6가지 통과 → 반영 → 권한·실제 AI 요청·백업 왕복 확인).
- `ai_draft_take`: 전체 하루 상한 30,000 → **3,000** 호출. 키(익명 키 sha256)는 앱이 만들어 보내는 값이라 서버가 진짜인지 모르고, 공개 키·Origin 은 브라우저 밖에서 흉내 낼 수 있어 키당 100 은 가짜 키로 우회된다 → 전체 상한이 비용·남용의 실제 상한. 상한에 걸리면 앱은 `limited` → "오늘은 AI 초안을 더 만들 수 없어요"(광고를 본 뒤일 수 있으니 실제 사용이 가까워지면 올린다).
- `backup_upsert`: **새 키는 `mandalart_backups` 표 전체(인덱스·TOAST 포함)가 300MB 를 넘으면 거부**(SQLSTATE 53100 → HTTP 503, 앱은 "백업하지 못했어요. 잠시 뒤에 다시 해 주세요"). 이미 있는 백업 덮어쓰기는 그대로. 키당 200KB 제한만 있어 가짜 키로 무료 DB(500MB)를 채울 수 있었던 것을 막음.
- 같은 날 의존성: `client/package-lock.json` source-map-js 1.2.1 → 1.2.2(CVE-2026-93749, Dependabot PR #1 을 사용자가 병합). 그 PR 이 바꾼 루트 의존성 표기(`latest` → `*`)는 package.json 에 맞춰 되돌림.
