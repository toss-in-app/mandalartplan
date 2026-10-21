# mandalartplan — 만다라트 (앱인토스 미니앱)

핵심 목표 1개 · 세부 목표 8개 · 실천 64개를 9×9 만다라트에 적고, 매일 실천을 체크해 진행률을 쌓고, 완성한 9×9 를 이미지로 공유하는 미니앱이에요.
자체 서버·로그인 없음. 저장은 기기 로컬(`Storage`)이고, 사용자가 켜면 Supabase(서울 리전)에 백업(토스 익명 키 기반). 2.0.0 부터 AI 초안은 Supabase Edge Function(`supabase/functions/mandalart-draft/`)이 Anthropic Claude 를 불러요 — Anthropic 키는 Supabase secrets 에만 있고 저장소·앱에는 없어요. 워크플로우 카드는 `~/Desktop/toss/apps/mandalartplan.md`, 설계는 `steps/3-design/wireframes/mandalartplan-flow.md`.

## 실행

```bash
npm install                 # 루트: 콘텐츠 검증(ajv)
npm run content             # content/content.source.json 검증 → static/content.json + client/src/content/bundled.json
cd client && npm install
npm run dev                 # http://localhost:5173 — AIT Devtools 가 브릿지를 모킹
npm run typecheck && npm test && npm run build   # tsc · vitest · vite build && ait build → client/mandalart.ait
```

## 정적 배포 (8단계)
> **저장소를 비공개로 바꾸지 마세요.** 조직이 무료 플랜이라 비공개 저장소는 GitHub Pages 가 꺼지고 설정도 지워져 약관·개인정보처리방침·콘텐츠·공유 이미지가 전부 404 가 돼요(2026-10-19 저녁~10-20 아침 실제 장애). 되돌린 뒤에는 `gh api -X POST repos/toss-in-app/mandalartplan/pages -f build_type=workflow` 로 Pages 를 다시 켜고 `gh workflow run pages.yml` 로 다시 배포해야 해요.

- `static/` → GitHub Pages(`.github/workflows/pages.yml`, main 에 push 하면 계약 검증 뒤 배포, 1~2분). 주소 https://toss-in-app.github.io/mandalartplan/ — `content.json`·`og.png`·`terms/`·`privacy/`. 절차·롤백·동결 규칙은 `steps/8-server-deploy/runbooks/mandalartplan-deploy.md`.

## 검사
- `npm run contract` — 계약 검증(콘텐츠 3벌·상태 샘플·백업 페이로드 ↔ `contract/*.schema.json`). `npm run content` 로 콘텐츠를 바꾼 뒤 꼭 돌린다.
- `npm run check` — 계약 → 타입 → 린트 → 테스트 → 출시 번들 빌드. 출시 빌드(`npm --prefix client run build`)는 `client/scripts/check-release-bundle.mjs` 로 dist 에 테스트 광고 ID 문자열이 없고 `.env.production` 에 설정된 라이브 광고 그룹 ID(2.0.0: 고유 4개·설정 5곳 — AI 초안이 두 번째 판 지면을 임시로 같이 씀)가 모두 있는지 검사해요(콘솔이 번들을 정적 검사해 자동 반려, 2026-10-19). 테스트 광고 ID 로 QR 번들을 만들 때는 `npm --prefix client run build:test-ads`. 워크플로우 6단계의 `steps/6-test/scripts/check-mandalartplan.sh` 가 이걸 돌리고 번들 크기까지 로그로 남긴다.

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
console/                     # 콘솔 앱 정보 자료(9·11단계 입력값): logo.png · app-info.md · features.md · policies/ · release-notes.md — 앱 자료는 steps/ 가 아니라 여기
releases/                    # 출시 기록(12단계): 버전별 태그·라이브 번들·검토·광고·알려진 제한. 1.0.0.md = 첫 출시
supabase/schema.sql          # 백업·복원용 Supabase 테이블·RLS·RPC (2026-10-04) + AI 초안 사용량·비용 표·RPC (2.0.0, 서버 키만 실행)
supabase/functions/mandalart-draft/  # AI 초안 Edge Function(2.0.0): 형식·자해 검사·하루 한도·Claude 호출 — README.md 에 배포 절차
client/                      # 미니앱 (React 18 + Vite + TDS + @apps-in-toss/web-framework 3.x)
├── apps-in-toss.config.ts   #   appName·브랜드 색·네비게이션 바·웹뷰 옵션 (콘솔 appName 과 같아야 함)
└── src/
    ├── main.tsx             #   TDSMobileAITProvider
    ├── App.tsx              #   라우트: home · sub/:s · block/:n · overview · today(기록 위젯 판) · record/:위젯 · share · settings
    ├── content/             #   bundled.json(생성) + 로더(원격 content.json 시도, 실패 시 번들)
    ├── backup/              #   Supabase 백업·복원: config(URL·publishable 키) · key(익명 키 sha256) · api(RPC fetch) · useBackup
    ├── ads/                 #   광고: config(그룹 ID, 비면 테스트 ID) · fullScreen(load/show 약속) · useInterstitial · useRewardedAd · banner(TossAds 초기화) · rules(하루 1회)
    ├── notification/        #   알림 동의: Notification.requestAgreement 약속 래퍼, 템플릿 코드(.env)
    ├── ai/                  #   AI 초안(2.0.0): rules(빈 칸만·하루 20회, 2.0 은 10회) · safety(자해 표현) · api · key · useAiDraft(고지 → 리워드 → 요청)
    ├── lib/
    │   ├── mandalart.ts     #   판 모델·검증·진행률·공유 텍스트
    │   ├── state.ts         #   boards · checkins · settings 정규화, 날짜 키, 연속 일수
    │   ├── storage.ts       #   Storage 브릿지 → localStorage 대체, 선행 프로토타입 키 이전
    │   ├── router.ts        #   pushState 라우터 + Environment.initialURL 딥링크
    │   ├── cells.ts         #   블록·칸 index → 보드의 어느 글인지
    │   ├── checkin.ts       #   오늘 체크 토글·세부 목표별 묶기
    │   ├── stats.ts · records.ts · badges.ts  #   기록 숫자(기간 주·월·년, 연속·꾸준함 점수·요일별·누적·1년 잔디, 배지 12개) — 체크 기록에서 계산
    │   ├── widgets.ts       #   기록 위젯 판 목록·기본 배치·숨기기/넣기/옮기기
    │   ├── card.ts          #   공유 이미지 카드(1080×1350 캔버스): 레이아웃·줄바꿈·그리기
    │   └── bridge.ts        #   햅틱·공유·사진첩 저장(photos 권한)·공유 링크 브릿지 래퍼
    ├── hooks/useAppState.ts #   상태 하나 + 부분별 디바운스 저장
    ├── lib/analytics.ts     #   분석 이벤트(Analytics.log, 이름표는 contract/events.md)
    ├── components/          #   9×9 격자(TDS 에 없는 영역이라 직접 그림) · AdBanner(토스 배너 1개) · records/(위젯·대시보드 그림)
    └── screens/             #   Home · Sub · Overview · Records(위젯 판) · Record(대시보드) · Share · Settings · Draft · Trial
```

## 단계 현황
- **3.0.0 검토 승인 2026-10-21 20:38 · 출시 대기** — 태그 `v3.0.0`(커밋 `7e22e91`), 콘솔 번들 `20261021-18`. 기록 위젯 판(위젯을 누르면 그 대시보드, 길게 누르면 판 편집)·차오르는 움직임·편집 모드 자리 바꾸기·1분 체험판 4단계·세부 목표 화면 ‹ 홈. 출시하지 않은 2.1.0(제자리 편집·완료 도장·1분 체험판·AI 빈 칸 채우기, 태그 `v2.1.0`)을 합쳤다. 설계 `plans/3.0-records-widgets-design.md`, 기록 `releases/3.0.0.md`, GitHub 릴리즈 v3.0.0(최신).
- **다음 버전 후보** — `plans/next-version.md`: AI 초안 리워드 전용 지면으로 교체(공지 54047 복구 뒤, 2.0.1 크기) · 토스 사용자 인증으로 AI·백업 키 묶기(2.1.0 크기).
- **2.0.0 출시 2026-10-20 13:53** — 태그 `v2.0.0`(커밋 `90b6451`), 콘솔 번들 `20261020-15`, 검토 승인 13:48. AI 초안(리워드 광고 1회 = AI 1회, 하루 10회)·생성형 AI 고지와 'AI 초안' 표시·저녁 8시 알림·서울 백업. 기록은 `releases/2.0.0.md`, GitHub 릴리즈 v2.0.0.
- **1.1.0 출시 2026-10-20 10:01** — 태그 `v1.1.0`(커밋 `ee8654e`), 콘솔 번들 `20261020-11`, 검토 승인 10:01. 칸을 눌러 바텀시트에서 적기·빈 칸 초대 표시. 기록은 `releases/1.1.0.md`, GitHub 릴리즈 v1.1.0.
- **1.0.1 출시 2026-10-19 20:05** — 태그 `v1.0.1`(커밋 `339cc2e`), 콘솔 번들 `20261019-6`, 홈 '기록 보기' 전면 광고 사전 안내. 기록은 `releases/1.0.1.md`, GitHub 릴리즈 v1.0.1.
- **1.0.0 출시 2026-10-19 18:00** — 태그 `v1.0.0`(커밋 `5588715`), 콘솔 라이브 번들 `20261019-5`, 검토 승인 17:31. 기록은 `releases/1.0.0.md`, GitHub 릴리즈 v1.0.0.
- 1~6단계 완료(콘솔 등록 2026-09-29, appName `mandalartplan`, 기능 9개·테스트 104개 2026-10-08). 8단계: `static/` 이 GitHub Pages(Actions)로 https://toss-in-app.github.io/mandalartplan/ 에 배포됨(2026-10-08). 다음은 9단계 앱 정보(콘솔 입력)·7단계 광고 그룹·10단계 QR.
- 끝난 기능: 체크인(홈 3×3·세부 3×3 탭 체크·전체 보기·기록(3.0 위젯 판: 위젯 11개·대시보드 10개, 전에는 오늘·주간·월간 탭)), 설정·초기화(예시 템플릿은 2.1 에서 없앰 — 예시는 1분 체험판에서만), Supabase 백업·복원, 공유(이미지 저장·글·링크), 광고(전면·리워드·배너, 테스트 ID), 알림 동의(템플릿 코드는 `.env`), 두 번째 판(리워드 잠금 해제·판 바꾸기 시트·판별 체크 기록), 분석 이벤트(`Analytics.log`, `contract/events.md` 20개).
- 홈 마무리(안내 한 줄·공지·시즌 문구·문구 점검)까지 끝. 남은 기능 없음.

## 앱인토스 규칙 대응
- 네비게이션 바: `navigationBar.withBackButton` + 브라우저 히스토리 → 뒤로가기·시스템 백버튼 동작, 첫 화면에서 뒤로가기 = 종료
- 라이트 모드만, TDS 컴포넌트, 다이얼로그 왼쪽 버튼 '닫기', 해요체, 느낌표·이모지 없음(콘텐츠 검증에서 차단)
- 진입 즉시 바텀시트·팝업 없음. 광고는 설계된 지점(홈→기록 전면 1, 하루 1회 · 고화질 저장·두 번째 판 리워드 2 · 기록 위젯 판·대시보드 하단 배너 화면마다 1)에만. 개발·QR 테스트는 공식 테스트 ID, 라이브 ID 는 `.env.production`
- 데이터는 기기 로컬에만. 개인정보 수집 없음(`static/privacy/`)
