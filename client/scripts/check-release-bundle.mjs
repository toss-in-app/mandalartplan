// 출시 빌드 검사 (npm run build 의 vite build 뒤, ait build 전).
// 콘솔은 번들을 정적으로 검사해 테스트 광고 ID('ait-ad-test-…')가 있으면 검토를 자동 반려해요(2026-10-19 반려).
// 그래서 dist 에 테스트 ID 가 한 글자라도 남아 있거나, 라이브 광고 그룹 ID 가 광고 그룹 수보다 적으면 실패시켜요.
// 테스트 ID 로 QR 번들을 만들 때는 이 검사를 거치지 않는 `npm run build:test-ads` 를 써요.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const assets = fileURLToPath(new URL('../dist/assets/', import.meta.url));
const js = readdirSync(assets)
  .filter((f) => f.endsWith('.js'))
  .map((f) => readFileSync(join(assets, f), 'utf8'))
  .join('\n');

const testIds = [...new Set(js.match(/ait-ad-test-[a-z-]*/g) ?? [])];
const liveIds = [...new Set(js.match(/ait\.v2\.live\.[0-9a-f]+/g) ?? [])];
// 광고 그룹 수 = src/ads/config.ts 의 VITE_AD_GROUP_* 항목 수(전면 1 · 리워드 3 · 배너 1, contract/events.md '광고 그룹'). 하나라도 비면 실패
const adConfig = readFileSync(fileURLToPath(new URL('../src/ads/config.ts', import.meta.url)), 'utf8');
const EXPECTED_LIVE = (adConfig.match(/pick\(import\.meta\.env\.VITE_AD_GROUP_/g) ?? []).length;

if (testIds.length > 0) {
  console.error(`출시 번들에 테스트 광고 ID 가 남아 있어요: ${testIds.join(', ')} — 콘솔 검토가 자동 반려돼요. src/ads/config.ts 확인`);
  process.exit(1);
}
if (liveIds.length < EXPECTED_LIVE) {
  console.error(`라이브 광고 그룹 ID 가 ${liveIds.length}개뿐이에요(기대 ${EXPECTED_LIVE}). client/.env.production 의 VITE_AD_GROUP_* 확인`);
  process.exit(1);
}
console.log(`출시 번들 검사 통과: 테스트 광고 ID 0개, 라이브 광고 그룹 ID ${liveIds.length}개`);
