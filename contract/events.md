# mandalartplan — 이름표 (분석 이벤트 · 광고 그룹 · 알림 템플릿 · 공유 링크) v2 (2026-09-29)

## 분석 이벤트 (`Analytics.log`, 파라미터는 문자열)
| 이벤트 | 언제 | 파라미터 |
|--------|------|----------|
| `home_view` | `home` 렌더 | `filled`(0~73), `boards`(1~2) |
| `board_edit` | 편집 모드(2.1 제자리 편집, 홈·세부 목표 화면)에서 값이 바뀐 뒤 '완료'·화면 이탈 | `block`(0~8: 4 = 홈, 둘레 = 그 세부 목표 화면) |
| `board_filled` | 73칸이 처음 다 찼을 때(판마다 1회) | `templateId`, `ai`(true/false — AI 결과를 넣은 판인지, 2.0) |
| `action_check` | 세부 목표 화면에서 실천 칸 탭 | `index`(0~63), `checked`(true/false), `todayCount`, `streak`, `first`(처음 체크한 순간이면 true) |
| `today_view` | 홈 '기록 보기' 진입(기록 화면, 오늘 탭) | `todayCount`, `streak` |
| `stats_view` | 기록 화면 주간·월간 탭을 열거나 기간을 옮겼을 때 (v3, 2026-10-16) | `period`(week/month), `offset`(0 = 이번, -1 = 지난…), `activeDays`, `checks` |
| `ad_interstitial` | 전면 결과 | `result`(shown/skipped/failed) |
| `reward_unlock` | `userEarnedReward` | `type`(hdImage/extraBoard) |
| `board_add` | 두 번째 판 추가(리워드 직후 또는 설정 '빈 판 추가') | `boards`(2) |
| `board_switch` | 홈 제목 셀렉터 → 판 바꾸기 시트에서 다른 판 선택 | `to`(0~1) |
| `share_image_save` | 이미지 저장 성공 | `hd`(true/false) |
| `share_text` · `share_link` | 공유 시트 호출 | |
| `notification_agree` | 동의 요청 결과 | `result`(agreed/declined), `from`(home/today/settings) |
| `template_apply` | 예시 템플릿 적용 | `templateId` |
| `reset` | 처음부터 다시 만들기 확인 | |

핵심 지표(콘솔 9단계): 활성 `action_check` · 전환 `board_filled`(대표), `share_image_save`, `notification_agree`.

- 구현(2026-10-08, `client/src/lib/analytics.ts`): `Analytics.log({ log_name, log_type, params })`. `log_type` 은 `home_view`·`today_view` 만 `screen`, 나머지 `event`(`stats_view` 포함). 값은 문자열, null·undefined 제외, 개인정보 없음(`anonymous_key` 는 SDK 가 붙임). 토스앱 5.208.0 미만·브라우저는 조용히 무시.
- 보충: `board_filled` 는 채운 칸이 73 미만 → 73 이 되는 순간(`templateId` 없으면 `none`). `board_edit` 는 편집 모드에 들어갈 때와 나올 때(완료·화면 이탈) `updatedAt` 이 다르면 1회(2.0 까지는 편집 화면 `block` 에 들어올 때와 나갈 때). `ad_interstitial` 은 전면 조건이 맞아 시도했을 때만(shown / skipped = 미로딩 / failed = 띄우기 실패).

### 제자리 편집 모드 (2.1 — 편집 버튼·편집 화면 대신, `client/src/hooks/useGridEdit.tsx`)

| 이름 | 언제 | 파라미터 |
|------|------|----------|
| `edit_mode_enter` | 홈·세부 목표 화면(1분 체험판 포함)이 편집 모드로 바뀔 때 | `screen`(home/sub/trial), `via`(longpress = 칸 길게 누르기 / button = 키보드·스크린리더 입구 '편집' / link = 예전 편집 화면 링크 `block/:n`. 평소 옆으로 쓸기로 들어가던 swipe 는 출시 전에 없앰) |
| `cells_delete` | 편집 모드에서 고른 칸을 '삭제' 확인 뒤 지웠을 때 | `count`(지운 칸 수 — 상위 목표를 따라 함께 지운 하위 칸 포함: 세부 목표 → 그 실천, 핵심 목표 → 전부), `area`(goals = 홈: 핵심 목표·세부 목표 / actions = 세부 목표 화면: 세부 목표 이름·실천) |
| `cells_delete_undo` | 토스트의 '되돌리기' | `count`(`cells_delete` 와 같은 수) |

### 1분 체험판 (2.1 — 홈 맨 위 안내 카드·설정 '1분 체험해 보기', `client/src/screens/TrialScreen.tsx`)

| 이름 | 언제 | 파라미터 |
|------|------|----------|
| `trial_start` | 홈 맨 위 안내 카드나 설정의 '1분 체험해 보기'를 눌렀을 때(`#/trial` 로 바로 들어오면 보내지 않음) | `from`(home = 홈 안내 카드 / settings) |
| `trial_finish` | 마지막 버튼('내 만다라트 시작하기'·'내 만다라트로 돌아가기')을 눌렀을 때. 홈 안내 카드도 이때 거둬요 | `steps`(2 = 도장·편집 / 3 = AI 미리보기까지, AI 를 쓸 수 있는 기기만 3) |
| `trial_card_close` | 홈 맨 위 안내 카드의 ✕ | |

- 체험판의 판·체크는 저장하지 않는 예시라 `action_check`·`board_edit`·`cells_delete`·`cells_delete_undo` 를 보내지 않는다. 편집 모드에 들어가면 `edit_mode_enter`(`screen` = trial)만 보낸다.

## 광고 그룹 (콘솔에서 사업자 정보 뒤 생성 → ID 를 `.env.production` 의 `VITE_AD_GROUP_*` 로, 코드는 `client/src/ads/config.ts`. 비어 있으면 공식 테스트 ID `ait-ad-test-interstitial-id`·`ait-ad-test-rewarded-id`·`ait-ad-test-banner-id` — 개발·QR 테스트는 테스트 ID 로만)
| 이름 | 유형 | 지점 | 규칙 |
|------|------|------|------|
| `interstitial-today` | 전면 | 홈 '기록 보기' → today 전환 | 하루 1회 · 오늘 체크 1개 이상일 때만 · 사전 로딩 · 실패 시 건너뜀 |
| `rewarded-hd-image` | 리워드 | 공유 화면 '고화질로 저장' | 보상 = 고화질 저장 1회, `userEarnedReward` 에서만 |
| `rewarded-extra-board` | 리워드 | 설정 '두 번째 만다라트 판' | 보상 = `unlocks.extraBoard = true`(영구). 2026-10-20~ 공지 54047 동안 `rewarded-ai-draft` 가 이 지면을 함께 씀(콘솔 보상 이름 '기회' 1) |
| `banner-today` | 배너 | 기록 화면 맨 아래(모든 탭) | 1개, refresh 없음, 버튼과 24px 이상 |

## 알림 템플릿 (콘솔 정기 발송, 기능성)
| 발송 코드(templateCode) | 발송 | 제목(7자, 명사형) / 내용(25자, ~요.) | 링크 |
|----|------|----------------------------------|------|
| `mandalartplan-daily-checkin` | 매일 20:00 (정기 발송, 2026-10-20 사용자 결정 — MCP 설명상 21~08시 발송은 다음 날 08시로 밀려서 21시 대신) | "실천 체크" / "오늘 한 실천을 만다라트에 체크해요." | `intoss://mandalartplan` |

- 2026-10-20: 제목을 공식 규칙(7자 이내)에 맞춰 "실천 체크 시간"(8자) → "실천 체크". 2.0.0 에 알림을 같이 켠다(사용자 결정).
- 2026-10-20 콘솔 MCP 로 생성(사용자 확인): 알림 동의문 termsId `131417`(정기·매일 20:00, 알림 유형 "실천 체크" → 동의 화면 "매일 실천 체크 알림을 보내드릴까요?", 발송 시점 "매일 저녁 8시에 오늘 실천을 체크하라고 알려요") · 정기 템플릿 templateSetGroupNo `202053`(REGULAR·기능성, AI 자동 검수 통과 → APPROVED, 10/21 20:00 부터). 실제 푸시 본문은 뒤에 "(만다라트 알림)" 이 붙어요. 코드는 `client/.env` 의 `VITE_NOTIFICATION_TEMPLATE_CODE`.

- 발송 코드는 공식 규칙대로 `{appName}-` 로 시작. 콘솔에서 만든 뒤 `client/.env` 의 `VITE_NOTIFICATION_TEMPLATE_CODE` 에 넣는다(비어 있으면 출시 번들에서 알림 기능 숨김, 개발 빌드는 이 코드로 대신). 알림 동의문(발송 시점 "매일 저녁 8시", 철회 경로 "토스 앱 알림 설정")이 연결돼 있어야 저장된다.
- 클라 호출: `Notification.requestAgreement({ options: { templateCode } })` — 홈 행·기록 화면(오늘 탭) 버튼·설정 행에서 사용자가 누른 뒤에만. 결과 `newAgreement`/`alreadyAgreed` → `settings.notification = agreed`, `agreementRejected` → `declined`.

## 공유
- 링크: `Share.createLink({ path: 'intoss://mandalartplan', ogImageUrl: 'https://toss-in-app.github.io/mandalartplan/og.png' })`. 개인 데이터는 링크에 싣지 않는다.
- 텍스트: `[핵심 목표] …` + 세부 목표별 실천 목록(오늘 체크는 `- [오늘] …`).
- 이미지: 1080×1350 PNG(워터마크 "만다라트", 오늘 체크 표시) / 고화질 2160×2700(워터마크 없음, 리워드).

## Storage 키
`mandalart.boards.v1` · `mandalart.checkins.v1` · `mandalart.settings.v1` (스키마 `state.schema.json`). 선행 프로토타입의 `mandalart.board.v1` 은 읽어서 `boards.v1` 로 1회 이전 후 삭제. 예전 판의 `done` 필드는 읽을 때 버린다.

## 백업·복원 (2026-10-04 추가, Supabase)
| 이벤트 | 언제 | 파라미터 |
|--------|------|----------|
| `backup_enable` | 설정 '백업 켜기' 성공 | |
| `backup_run` | 백업 성공(자동·수동) | `auto`(true/false), `cells` |
| `backup_restore` | 서버 본으로 복원 확인 | `cells` |
| `backup_disable` | '백업 끄고 서버 데이터 지우기' | |
| `backup_error` | 키 발급·네트워크 실패 | `stage`(key/get/upsert/delete), `code` |

Supabase RPC: `backup_get(p_key)` · `backup_upsert(p_key, p_payload, p_payload_version, p_client_version, p_cells_filled)` · `backup_delete(p_key)` — `supabase/schema.sql`. 테이블 직접 접근 없음(RLS). 페이로드 `contract/backup.schema.json`.

## AI 초안 (2.0, 2026-10-20 추가 — 설계 `plans/2.0-ai-draft-design.md`, API `ai-draft.api.md`)
| 이벤트 | 언제 | 파라미터 |
|--------|------|----------|
| `ai_notice_agree` | 생성형 AI 사전 고지 시트에서 '확인' | |
| `ai_draft_start` | AD 버튼을 누르고 사전 검사(고지·하루 10회·입력)를 통과해 광고를 띄우기 직전 | `mode`(draft/actions, 2.0 은 subs 도), `from`(2.1: draft 는 new = 빈 판·핵심 목표만 / partial = 칸을 일부 채운 판, actions 는 sub = 세부 목표 화면) |
| `ai_draft_reward` | 리워드 광고 결과 | `mode`, `result`(rewarded/dismissed/unavailable) |
| `ai_draft_result` | 서버 응답(보상을 받은 뒤에만 부름) | `mode`, `result`(ok/refused/limited/invalid_output/busy/network/invalid), `ms` |
| `ai_draft_apply` | 결과를 판에 넣음(미리보기 '이대로 시작하기' 또는 세부 목표 화면 채우기) | `mode`, `filled`(새로 채운 칸 수) |

- `mode`: `draft` = 목표 입력 화면에서 판 전체(세부 목표 → 실천 순서로 서버 2번), `actions` = 한 세부 목표의 빈 실천만(2.1 세부 목표 화면, 2.0 은 편집 화면). `subs` = 2.0 편집 화면의 빈 세부 목표만 — 2.1 에서 편집 화면과 함께 없어짐(빈 세부 목표는 홈 'AI로 빈 칸 채우기' = `draft`). 서버 API 의 `subs` 모드는 `draft` 가 안에서 그대로 씀.
- 자해·자살 표현 감지(앱 사전 검사·서버 `self_harm`)는 **이벤트를 남기지 않는다** — 민감한 정보라서. 목표 문구·칸 글도 어떤 이벤트에도 싣지 않는다.

| 광고 그룹 | 유형 | 지점 | 규칙 |
|------|------|------|------|
| `rewarded-ai-draft` | 리워드 | 목표 입력 '광고 보고 만들기' · 미리보기 '다시 만들기' · 세부 목표 화면 '빈 실천 AI로 채우기'(2.1 — 2.0 은 편집 화면 '빈 칸 AI로 채우기'·'실천 AI로 추천') | 보상 = AI 1회(이름 "AI 초안", 수량 1), `userEarnedReward` 에서만. 광고를 못 불러오면 AI 를 쓰지 않음(2026-10-20 결정). 사람당 하루 10회(`settings.ai.runs`). 라이브 ID `VITE_AD_GROUP_REWARDED_AI_DRAFT`. **임시(2026-10-20~)**: 전면·리워드 지면 신규 생성 오류(앱인토스 공지 54047) 동안 `rewarded-extra-board` 지면 ID 를 같이 씀 — 콘솔 보상 이름 '기회' 1, 앱은 같은 그룹을 한 번만 불러옴. 복구되면 전용 지면 생성 → 2.0.1 |

서버: Supabase Edge Function `mandalart-draft`(`supabase/functions/mandalart-draft/`), 남용 방지 테이블 `ai_draft_usage`·`ai_draft_cost` 와 RPC `ai_draft_take`·`ai_draft_cost_add`(서버 키만 실행) — `supabase/schema.sql`.
