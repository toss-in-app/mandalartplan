# mandalart-draft — AI 초안 Edge Function (2.0)

계약 `contract/ai-draft.api.md` · 설계 `plans/2.0-ai-draft-design.md` · 프롬프트 `prompt.ts`(원본 `plans/2.0-ai-draft-prompt.md` v1)

| 파일 | 하는 일 |
|---|---|
| `index.ts` | Deno 진입점: CORS(토스 미니앱 Origin 만)·publishable key 거름망 → `handleDraft` → JSON. Claude 는 공식 SDK `npm:@anthropic-ai/sdk`, DB 는 PostgREST RPC |
| `handler.ts` | 요청 하나: 형식 → 자해 표현 → 하루 상한 → Claude(1~2회) → 칸 정리. Claude·DB 는 주입해서 Deno 없이 시험 |
| `validate.ts` | 요청 검사, 모델 출력 칸 정리(따옴표·!?·끝 마침표 제거, URL·이메일·전화번호·이모지면 비움), 사용자 칸 복원·중복 제거 |
| `prompt.ts` | 모델 `claude-haiku-5-5`, effort `low`, 시스템 프롬프트(캐시), 사용자 메시지, 구조화 출력 스키마 |
| `safety.ts` | 자해·자살 표현 목록(앱 `client/src/ai/safety.ts` 와 같음) |

시험: 앱 쪽 vitest 가 `handler.ts`·`validate.ts` 를 가짜 Claude·DB 로 돌려요(`client/src/ai/server.test.ts`). Deno 를 깔 필요 없어요.

## 배포 (처음 한 번)

사용자가 할 일(키는 Claude 가 다루지 않아요):
1. Supabase CLI 설치·로그인: `brew install supabase/tap/supabase` → `supabase login`
2. 프로젝트 연결: 프로젝트 폴더에서 `supabase link --project-ref <ref>` (`client/.env` 의 `VITE_SUPABASE_URL` 에 있는 `https://<ref>.supabase.co` 의 ref)
   - 2026-10-20 부터 서울 프로젝트 `elpwdczwgcjbkqqjxpuh`(ap-northeast-2). 처음 쓰던 시드니 프로젝트(`jwkwxkoveeslbdiyxmmr`)는 사용자가 삭제 — 1.x 앱의 백업은 서울 주소로 다시 빌드한 판부터 동작
3. Anthropic 키 넣기: `supabase secrets set ANTHROPIC_API_KEY=<키>` — Anthropic 콘솔에서 만든 키, 워크스페이스 월 사용 한도(예: $10)를 먼저 걸어 두기

그다음(사용자 또는 Claude):
4. DB: Supabase 대시보드 SQL Editor 에서 `supabase/schema.sql` 의 '2.0 AI 초안' 부분을 실행(표 2개 + 함수 2개, 서버 키만 실행)
5. 배포: `supabase functions deploy mandalart-draft --no-verify-jwt`
   - `--no-verify-jwt`: 앱은 로그인이 없어 사용자 JWT 가 없고 publishable key(JWT 아님)만 보내요. 함수 안에서 Origin 과 publishable key 를 확인해요.
6. 확인: 아래 요청이 `{"ok":true,"mode":"subs",…}` 를 돌려주면 끝
   ```bash
   curl -s https://<ref>.supabase.co/functions/v1/mandalart-draft \
     -H 'Origin: http://localhost:5180' -H "apikey: <publishable key>" -H 'Content-Type: application/json' \
     -d '{"mode":"subs","key":"k0000000000000000000000000000000000000000000000000000000000000000","goal":"토익 900점","subs":["","","","","","","",""]}'
   ```

## 지켜야 할 것
- 목표·칸 글·결과는 저장하지 않고 로그에도 남기지 않아요. 남기는 것: 키 해시별 날짜·호출 수(7일), 날짜별 토큰 합계, 결과 코드.
- 재시도 상한(정책 2-5 무제한 재시도 금지): 클라는 연결·서버 일시 오류만 요청마다 1회, 서버는 SDK 재시도 1회 + 형식 실패 재요청 1회까지.
- 모델·프롬프트를 바꾸면 `PROMPT_VERSION` 을 올리고 앱 업데이트 출시 노트에 적어요.
