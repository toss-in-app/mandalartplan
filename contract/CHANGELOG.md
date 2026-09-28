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
