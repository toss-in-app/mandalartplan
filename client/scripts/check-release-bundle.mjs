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
// src/ads/config.ts 가 읽는 VITE_AD_GROUP_* 는 .env.production 에 모두 값이 있어야 하고, 그 라이브 ID 가 전부 번들에 들어가야 해요.
// 두 기능이 한 지면을 같이 쓰면(예: 2.0.0~3.0.2 의 AI 초안이 '두 번째 판' 지면을) ID 가 겹쳐도 돼요.
const adConfig = readFileSync(fileURLToPath(new URL('../src/ads/config.ts', import.meta.url)), 'utf8');
const requiredKeys = [...new Set(adConfig.match(/VITE_AD_GROUP_[A-Z_]+/g) ?? [])];
const envProd = Object.fromEntries(
  readFileSync(fileURLToPath(new URL('../.env.production', import.meta.url)), 'utf8')
    .split('\n')
    .filter((line) => /^VITE_AD_GROUP_[A-Z_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()]),
);
const emptyKeys = requiredKeys.filter((key) => !envProd[key]);
const expectedIds = [...new Set(requiredKeys.map((key) => envProd[key]).filter(Boolean))];
const missingIds = expectedIds.filter((id) => !js.includes(id));
const EXPECTED_LIVE = expectedIds.length;

if (testIds.length > 0) {
  console.error(`출시 번들에 테스트 광고 ID 가 남아 있어요: ${testIds.join(', ')} — 콘솔 검토가 자동 반려돼요. src/ads/config.ts 확인`);
  process.exit(1);
}
if (emptyKeys.length > 0 || missingIds.length > 0) {
  console.error(`라이브 광고 그룹 ID 가 비었거나 번들에 없어요: ${[...emptyKeys, ...missingIds].join(', ')} — client/.env.production 확인`);
  process.exit(1);
}
if (liveIds.length < EXPECTED_LIVE) {
  console.error(`라이브 광고 그룹 ID 가 ${liveIds.length}개뿐이에요(기대 ${EXPECTED_LIVE}). client/.env.production 의 VITE_AD_GROUP_* 확인`);
  process.exit(1);
}
// 3.0.3 Microsoft Clarity: 화면 글자는 body 에서 전부 가리고(data-clarity-mask), CSS 는 페이지 안 <style> 로(녹화 재생 때 CSS 파일을 못 받아요 — vite.config.ts inlineCss)
const html = readFileSync(fileURLToPath(new URL('../dist/index.html', import.meta.url)), 'utf8');
const clarityId = readFileSync(fileURLToPath(new URL('../.env.production', import.meta.url)), 'utf8').match(/^VITE_CLARITY_PROJECT_ID=(\S+)/m)?.[1];
if (clarityId && !js.includes(clarityId)) {
  console.error(`Clarity 프로젝트 ID(${clarityId})가 번들에 없어요 — client/src/lib/clarity.ts·main.tsx 확인`);
  process.exit(1);
}
if (!html.includes('<body data-clarity-mask="True">') || /<link rel="stylesheet"/.test(html)) {
  console.error('dist/index.html 에 body 가림(data-clarity-mask)이 없거나 CSS 가 <link> 로 남아 있어요 — index.html·vite.config.ts inlineCss 확인');
  process.exit(1);
}
console.log(`출시 번들 검사 통과: 테스트 광고 ID 0개, 라이브 광고 그룹 ID ${liveIds.length}개(설정 ${requiredKeys.length}곳), Clarity ${clarityId ? `켬(${clarityId}, 글자 가림·CSS 페이지 안)` : '없음'}`);
