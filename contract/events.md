# mandalartplan — 이름표 (분석 이벤트 · 광고 그룹 · 알림 템플릿 · 공유 링크) v2 (2026-09-29)

## 분석 이벤트 (`Analytics.log`, 파라미터는 문자열)
| 이벤트 | 언제 | 파라미터 |
|--------|------|----------|
| `home_view` | `home` 렌더 | `filled`(0~73), `boards`(1~2) |
| `board_edit` | `block` 에서 값이 바뀐 뒤 화면 이탈 | `block`(0~8) |
| `board_filled` | 73칸이 처음 다 찼을 때(판마다 1회) | `templateId` |
| `action_check` | 세부 목표 화면에서 실천 칸 탭 | `index`(0~63), `checked`(true/false), `todayCount`, `streak`, `first`(처음 체크한 순간이면 true) |
| `today_view` | '오늘 기록 보기' 진입 | `todayCount`, `streak` |
| `ad_interstitial` | 전면 결과 | `result`(shown/skipped/failed) |
| `reward_unlock` | `userEarnedReward` | `type`(hdImage/extraBoard) |
| `share_image_save` | 이미지 저장 성공 | `hd`(true/false) |
| `share_text` · `share_link` | 공유 시트 호출 | |
| `notification_agree` | 동의 요청 결과 | `result`(agreed/declined), `from`(home/today/settings) |
| `template_apply` | 예시 템플릿 적용 | `templateId` |
| `reset` | 처음부터 다시 만들기 확인 | |

핵심 지표(콘솔 9단계): 활성 `action_check` · 전환 `board_filled`, `share_image_save`, `notification_agree`.

## 광고 그룹 (콘솔에서 사업자 정보 뒤 생성 → ID 를 `client/src/ads.ts` 상수로. 테스트 ID 는 dev 빌드에서만)
| 이름 | 유형 | 지점 | 규칙 |
|------|------|------|------|
| `interstitial-today` | 전면 | 홈 '오늘 기록 보기' → today 전환 | 하루 1회 · 오늘 체크 1개 이상일 때만 · 사전 로딩 · 실패 시 건너뜀 |
| `rewarded-hd-image` | 리워드 | 공유 화면 '고화질로 저장' | 보상 = 고화질 저장 1회, `userEarnedReward` 에서만 |
| `rewarded-extra-board` | 리워드 | 설정 '두 번째 만다라트 판' | 보상 = `unlocks.extraBoard = true`(영구) |
| `banner-today` | 배너 | 오늘 기록 목록 하단 | 1개, refresh 없음, 버튼과 24px 이상 |

## 알림 템플릿 (콘솔 정기 발송, 기능성)
| id | 발송 | 문구(해요체, 느낌표·이모지 없음) | 링크 |
|----|------|----------------------------------|------|
| `daily-checkin` | 매일 21:00 | "오늘 실천을 체크할 시간이에요" / "만다라트에서 오늘 한 일을 눌러 보세요" | `intoss://mandalartplan` |

## 공유
- 링크: `Share.createLink({ path: 'intoss://mandalartplan', ogImageUrl: 'https://toss-in-app.github.io/mandalartplan/og.png' })`. 개인 데이터는 링크에 싣지 않는다.
- 텍스트: `[핵심 목표] …` + 세부 목표별 실천 목록(오늘 체크는 `- [오늘] …`).
- 이미지: 1080×1350 PNG(워터마크 "만다라트", 오늘 체크 표시) / 고화질 2160×2700(워터마크 없음, 리워드).

## Storage 키
`mandalart.boards.v1` · `mandalart.checkins.v1` · `mandalart.settings.v1` (스키마 `state.schema.json`). 선행 프로토타입의 `mandalart.board.v1` 은 읽어서 `boards.v1` 로 1회 이전 후 삭제. 예전 판의 `done` 필드는 읽을 때 버린다.
