# mandalartplan — 만다라트 (앱인토스 미니앱)

핵심 목표 1개 · 세부 목표 8개 · 실천 64개를 9×9 만다라트에 적고, 매일 실천을 체크해 진행률을 쌓고, 완성한 9×9 를 이미지로 공유하는 미니앱이에요.
자체 서버·로그인 없음. 저장은 기기 로컬(`Storage`)이고, 사용자가 켜면 Supabase 에 백업(토스 익명 키 기반). 워크플로우 카드는 `~/Desktop/toss/apps/mandalartplan.md`, 설계는 `steps/3-design/wireframes/mandalartplan-flow.md`.

## 실행

```bash
npm install                 # 루트: 콘텐츠 검증(ajv)
npm run content             # content/content.source.json 검증 → static/content.json + client/src/content/bundled.json
cd client && npm install
npm run dev                 # http://localhost:5173 — AIT Devtools 가 브릿지를 모킹
npm run typecheck && npm test && npm run build   # tsc · vitest · vite build && ait build → client/mandalart.ait
```

## 구조

```
contract/                  # 계약 (3단계 승인본). 바뀌면 CHANGELOG.md 에 한 줄
├── content.schema.json    #   정적 콘텐츠(템플릿·공지·시즌·격려 문구) — 보여질 문자열만
├── state.schema.json      #   Storage 키 3개: boards · checkins · settings
├── events.md              #   분석 이벤트·광고 그룹·알림 템플릿·공유 형식 이름표
└── samples/               #   렌더러·테스트 입력
content/content.source.json  # 콘텐츠 원본(사람이 검수). scripts/build-content.mjs 의 입력
scripts/build-content.mjs    # 검증 통과한 것만 static/ 과 번들 동봉본으로
static/                      # GitHub Pages 에 올릴 것: content.json · index · terms · privacy · og.png(예정)
supabase/schema.sql          # 백업·복원용 Supabase 테이블·RLS·RPC (2026-10-04, 사용자가 SQL Editor 에서 실행)
client/                      # 미니앱 (React 18 + Vite + TDS + @apps-in-toss/web-framework 3.x)
├── apps-in-toss.config.ts   #   appName·브랜드 색·네비게이션 바·웹뷰 옵션 (콘솔 appName 과 같아야 함)
└── src/
    ├── main.tsx             #   TDSMobileAITProvider
    ├── App.tsx              #   라우트: home · sub/:s · block/:n · overview · today · share · settings
    ├── content/             #   bundled.json(생성) + 로더(원격 content.json 시도, 실패 시 번들)
    ├── backup/              #   Supabase 백업·복원: config(URL·publishable 키) · key(익명 키 sha256) · api(RPC fetch) · useBackup
    ├── ads/                 #   광고: config(그룹 ID, 비면 테스트 ID) · fullScreen(load/show 약속) · useInterstitial · useRewardedAd · banner(TossAds 초기화) · rules(하루 1회)
    ├── lib/
    │   ├── mandalart.ts     #   판 모델·검증·진행률·공유 텍스트
    │   ├── state.ts         #   boards · checkins · settings 정규화, 날짜 키, 연속 일수
    │   ├── storage.ts       #   Storage 브릿지 → localStorage 대체, 선행 프로토타입 키 이전
    │   ├── router.ts        #   pushState 라우터 + Environment.initialURL 딥링크
    │   ├── cells.ts         #   블록·칸 index → 보드의 어느 글인지
    │   ├── checkin.ts       #   오늘 체크 토글·세부 목표별 묶기
    │   ├── card.ts          #   공유 이미지 카드(1080×1350 캔버스): 레이아웃·줄바꿈·그리기
    │   └── bridge.ts        #   햅틱·공유·사진첩 저장(photos 권한)·공유 링크 브릿지 래퍼
    ├── hooks/useAppState.ts #   상태 하나 + 부분별 디바운스 저장
    ├── components/          #   9×9 격자(TDS 에 없는 영역이라 직접 그림) · AdBanner(토스 배너 1개)
    └── screens/             #   Home · Sub · Block · Overview · Today · Share · Settings
```

## 단계 현황
- 1~4단계 완료(콘솔 등록 2026-09-29, appName `mandalartplan`). 5단계 진행 중 — 카드 체크리스트(`apps/mandalartplan.md`) 순서대로.
- 끝난 기능: 체크인(홈 3×3·세부 3×3 탭 체크·전체 보기·오늘 기록), 설정·예시 템플릿·초기화, Supabase 백업·복원, 공유(이미지 저장·글·링크), 광고(전면·리워드·배너, 테스트 ID).
- 남은 기능: 알림 동의, 두 번째 판, 분석 이벤트, 홈 마무리.

## 앱인토스 규칙 대응
- 네비게이션 바: `navigationBar.withBackButton` + 브라우저 히스토리 → 뒤로가기·시스템 백버튼 동작, 첫 화면에서 뒤로가기 = 종료
- 라이트 모드만, TDS 컴포넌트, 다이얼로그 왼쪽 버튼 '닫기', 해요체, 느낌표·이모지 없음(콘텐츠 검증에서 차단)
- 진입 즉시 바텀시트·팝업 없음. 광고는 설계된 지점(홈→오늘 기록 전면 1, 하루 1회 · 고화질 저장·두 번째 판 리워드 2 · 오늘 기록 하단 배너 1)에만. 개발·QR 테스트는 공식 테스트 ID, 라이브 ID 는 `.env.production`
- 데이터는 기기 로컬에만. 개인정보 수집 없음(`static/privacy/`)
