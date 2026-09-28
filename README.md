# mandalart — 만다라트 미니앱 (앱인토스)

핵심 목표 1개 · 세부 목표 8개 · 실천 항목 64개를 9×9 판에 적고, 실천을 완료 표시하며 진행률을 보는 미니앱이에요.
"앱인토스 미니앱을 어떻게 만드나" 를 체험하려고 만든 **연습용 프로젝트**예요. 서버 없음, 로그인 없음, 저장은 기기 로컬(`Storage`).

## 실행

```bash
cd client
npm install
npm run dev        # http://localhost:5173 — 오른쪽 아래 AIT Devtools 로 브릿지 모킹
npm run typecheck  # tsc -b
npm test           # vitest (lib 단위 테스트)
npm run build      # vite build && ait build → client/mandalart.ait
```

## 구조

```
client/
├── apps-in-toss.config.ts   # appName·브랜드 색·네비게이션 바·웹뷰 옵션 (콘솔 appName 과 같아야 함)
├── vite.config.ts           # @apps-in-toss/devtools 플러그인 (dev 에서 브릿지 API 를 모킹)
└── src/
    ├── main.tsx             # TDSMobileAITProvider 로 감싸기
    ├── App.tsx              # 해시 라우터: home | block/:n
    ├── lib/
    │   ├── mandalart.ts     # 데이터 모델·검증·진행률·공유 텍스트 (순수 함수, 테스트 있음)
    │   ├── cells.ts         # 블록·칸 index → 보드의 어느 글인지
    │   ├── storage.ts       # Storage 브릿지 → localStorage 대체, 1.5초 타임아웃
    │   ├── router.ts        # pushState 기반 화면 전환 (뒤로가기·백버튼이 그대로 동작)
    │   └── bridge.ts        # Device.triggerHaptic · Share.sendMessage (실패 시 대체 수단)
    ├── hooks/useBoard.ts    # 보드 상태 하나 + 400ms 디바운스 자동 저장
    ├── components/          # 9×9 격자(Block · MandalartGrid) — TDS 에 없는 영역이라 직접 그림
    └── screens/
        ├── HomeScreen.tsx   # Top · 격자 · ProgressBar · 공유 · 초기화(useDialog · useToast)
        └── BlockScreen.tsx  # Top · 3×3 미리보기 · TextField 9개 · Checkbox · FixedBottomCTA
```

## 앱인토스 규칙 대응

- 네비게이션 바: `navigationBar.withBackButton` + 브라우저 히스토리 → 뒤로가기·시스템 백버튼 동작, 첫 화면에서 뒤로가기 = 종료
- 라이트 모드만, TDS 컴포넌트, 다이얼로그 왼쪽 버튼 '닫기', 해요체
- 진입 즉시 바텀시트·팝업 없음, 광고 없음(연습용). 광고를 넣으려면 `create-ait-app add-sample --sample iaa` 가 만들어 주는 `useInAppAds` 훅 패턴을 참고
- 데이터는 기기 로컬에만. 개인정보 수집 없음

## 다른 폴더가 없는 이유

워크플로우의 `contract/` · `content/` · `static/` 은 정적 JSON 콘텐츠를 갱신하는 앱을 위한 것이에요.
만다라트는 사용자가 직접 적는 데이터뿐이라 원격 콘텐츠가 없어서 `client/` 만 있어요.
