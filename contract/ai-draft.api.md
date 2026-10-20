# AI 초안 API 계약 (2.0) — `POST /functions/v1/mandalart-draft`

> 2026-10-20 설계 승인과 함께 `plans/` 에서 옮김. 바뀌면 `contract/CHANGELOG.md` 에 한 줄. 서버 구현 `supabase/functions/mandalart-draft/`, 클라 `client/src/ai/`.

## 공통
- 호출: 클라(토스 미니앱 WebView) → Supabase Edge Function. HTTPS 만.
- 헤더: `Content-Type: application/json`, `apikey: <Supabase publishable key>`(JWT 아님, Authorization 에 넣지 않음).
- 허용 Origin: `https://mandalartplan.apps.tossmini.com`, `https://mandalartplan.private-apps.tossmini.com`, 개발 `http://localhost:5180`.
- 글자 수는 JavaScript 문자열 길이 기준. 모든 칸은 `""`(빈 칸) 또는 1~40자.
- `key`: `k` + 64자리 소문자 hex. 클라가 `sha256("ai:" + 익명 키 해시)` 로 만든다.

## 요청
### 세부 목표 채우기 `mode: "subs"`
```json
{ "mode": "subs", "key": "k…", "goal": "8구단 드래프트 1순위", "subs": ["", "제구", "", "", "", "", "", ""] }
```
- `goal` 1~40자(필수). `subs` 길이 8. 빈 칸만 채운다. 8칸이 다 차 있으면 400 `invalid`(호출하지 않음).

### 실천 채우기 `mode: "actions"`
```json
{ "mode": "actions", "key": "k…", "goal": "…", "subs": ["…×8"], "only": 3, "actions": ["…×8"] }
```
- 한 요청 = 세부 목표 하나(`only`, 0~7)의 실천 8칸. `subs[only]` 는 1자 이상이어야 하고, 다른 세부 목표는 겹치지 않게 하려는 참고용이라 빈 칸(`""`)이어도 된다.
- `actions` 길이 8 = 그 세부 목표의 실천 칸. 빈 칸만 채운다. 8칸이 다 차 있으면 400 `invalid`.
- 판 전체 초안은 클라가 세부 목표마다 이 요청을 동시에 보낸다(화면의 '실천 채우는 중 n/8' 이 실제 진행). (2026-10-20 구현 때 정함 — 처음 설계는 한 요청에 8×8)

## 응답 (HTTP 200)
```json
{ "ok": true, "mode": "subs", "subs": ["…×8"], "model": "claude-haiku-5-5", "promptVersion": 1 }
{ "ok": true, "mode": "actions", "only": 3, "actions": ["…×8"], "filled": 5, "model": "claude-haiku-5-5", "promptVersion": 1 }
{ "ok": false, "error": "refused" | "self_harm" | "limited" | "invalid_output" | "busy" }
```
- 사용자가 적은 칸은 응답에서도 원래 글 그대로(서버가 보장). 검사에 걸린 칸은 `""`.
- `filled`: 이번에 새로 채운 칸 수.

| error | 뜻 | 클라 안내 |
|---|---|---|
| `refused` | 모델 거절(`stop_reason: refusal` 또는 `refused: true`) | 이 목표로는 초안을 만들 수 없어요 |
| `self_harm` | 자해·자살 표현(모델 호출 안 함) | 109 안내 |
| `limited` | 키당 하루 100 호출 또는 전체 하루 30,000 호출 초과 | 오늘은 더 만들 수 없어요 |
| `invalid_output` | 형식 검사 1회 재요청 뒤에도 실패 | 잠시 뒤에 다시 해 주세요 |
| `busy` | Claude 429·5xx·시간 초과 | 잠시 뒤에 다시 해 주세요 |

## 오류 (HTTP 4xx, 요청 자체가 잘못됨)
- 400 `{ "ok": false, "error": "invalid" }` — 형식·길이·키 형식 위반, 채울 칸 없음
- 403 — 허용되지 않은 Origin
- 405 — POST 아님

## 한도
- 호출 = Claude 호출 1번 = 요청 1개. 키당 하루(서울 날짜) 100 호출, 전체 하루 30,000 호출 — 서버 `ai_draft_take`. 앱은 별도로 사람당 하루 AI 10회(광고 기준). 판 전체 초안 1회 = 최대 9 호출(세부 목표 1 + 실천 8)이라 10회면 90 호출.
- 클라 자동 재시도 금지. 사용자가 다시 누를 때만.
