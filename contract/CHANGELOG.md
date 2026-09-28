# mandalart 계약 변경 이력

## v1 — 2026-09-28 (3단계 초안, 승인 대기)
- `content.schema.json`: contentVersion·minClientVersion·updatedAt·notice·season·templates(예시 2개)·cheers(20). 문자열만, URL·느낌표·이모지 금지(pattern).
- `state.schema.json`: Storage 키 3개 — boards(판 1~2)·checkins(판별 날짜→실천 index)·settings(알림 상태·잠금·본 콘텐츠 버전·첫 체크인).
- `events.md`: 분석 이벤트 11개, 광고 그룹 4개, 알림 템플릿 1개, 공유 형식.
- 규칙: 같은 minClientVersion 안에서는 필드 추가만. 클라는 모르는 필드 무시. 바뀌면 여기에 한 줄.
