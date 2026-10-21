# mandalartplan — 콘솔 '주요 기능' 초안 (2026-10-08, 9단계 3번)

규칙: 최대 3개, 한글 10자 이내(`:` `.` 만 허용), 영문 15자 이내(첫 글자만 대문자), "~하기"·명사형, 서비스가 드러나게. 주소는 `intoss://mandalartplan/<path>`. **검색에는 1번만 잡힌다** → 이름에 '만다라트' 포함. 접속 안 되면 반려.

| # | 한글 (≤10자) | 영문 (≤15자) | 주소 | screenId | 클라 라우터 매핑 |
|---|------|------|------|------|------|
| 1 | 만다라트 체크인 (8자) | Daily Checkin (13자) | `intoss://mandalartplan` | `home` | 홈(가운데 3×3, 세부 목표 탭 → 체크). `routeFromSchemeUrl` → home |
| 2 | 만다라트 작성 (7자) | Write Mandalart (15자) | `intoss://mandalartplan/block/4` | `block/4` | 홈(핵심 목표·세부 목표 3×3)을 편집 모드로 엶 — 2.1 부터 편집 화면 대신 그 자리 편집(칸 흔들림, '완료'). `parseRoute('#/block/4')` |
| 3 | 만다라트 공유 (7자) | Share Mandalart (15자) | `intoss://mandalartplan/share` | `share` | 9×9 이미지 저장·글·링크 공유. `parseRoute('#/share')` |

- 2026-10-17 콘솔 MCP 규칙 확인: 영문은 각 단어가 대문자·숫자로 시작(Daily Checkin 가능, Daily checkin 불가), 한글은 앱 이름과 같을 수 없음, 주소는 `intoss://mandalartplan` 으로 시작하는 전체 딥링크. 주요 기능은 비필수라 없어도 검토 요청은 된다.
- 영문 대안: 1 "Check today" (11), 2 "Fill the board" (14), 3 "Share the board" (15).
- 라우터 테스트(`client/src/lib/router.test.ts`)가 세 path 의 매핑을 확인한다. 딥링크로 들어온 화면은 히스토리 바닥이라 뒤로가기 = 종료(설계 v2 "뒤로가기" 절).
- 2·3번은 로그인 없이 바로 열린다(토스 로그인 없음). 빈 판에서 3번을 열면 Result "아직 적은 목표가 없어요" + 홈으로.
