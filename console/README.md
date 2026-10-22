# console/ — 콘솔 앱 정보 자료 (9·11단계 입력값)

앱 관련 자료는 워크플로우 `steps/` 가 아니라 이 프로젝트 폴더 안에 둔다(2026-10-19). 콘솔 입력은 사용자가 콘솔 웹에서 한다.

| 파일 | 쓰는 곳 |
|------|--------|
| `app-info.md` | 앱 정보: 영문명·부제·상세 설명·카테고리·키워드·고객문의·입력표(맨 아래) |
| `logo.png` | 앱 로고 600×600 RGB (3×3 안, 2026-10-19 확정). 원본 `logo-3x3.svg`, 미채택 초안 `logo-draft-9x9.png` |
| `features.md` | 주요 기능 3개(국문/영문/intoss 링크) |
| `release-notes.md` | 검토 요청 모달 출시 노트(번들 20261019-3 에 MCP 로 등록해 둠) + 확약 5개 문구 |
| `policies/terms.md`·`privacy.md` | 이용약관·개인정보처리방침 md 사본 — 서빙본은 `static/terms/`·`static/privacy/`(GitHub Pages) |
| `screenshots/` | 사용 전 미리보기(스크린샷) 세로 636×1048 PNG 23장(2026-10-21 Claude 제작, 3.0.0 화면·예시 판 '올해는 몸과 마음이 건강한 한 해' + 140일치 예시 기록). 01~12 화면 전반, 13~23 기록 위젯 대시보드. 콘솔엔 3장 이상 고르면 됨. 다시 만들기: 개발 서버 켜고 `node console/screenshots/make.mjs`(캡처 원본·글꼴은 `.work/`, 커밋 안 함) |
| OG 이미지 | `static/og.png` 하나만 둔다(listing 사본은 동일 파일이라 삭제) |
