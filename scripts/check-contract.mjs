// 계약 검증 (6단계): 콘텐츠 3벌(원본·번들·static)과 상태 샘플·백업 페이로드가 contract/*.schema.json 을 통과하는지.
// 실패하면 종료 코드 1. 사용: npm run contract (프로젝트 루트)
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const problems = [];
const ok = (label) => console.log(`  ok  ${label}`);
const fail = (label, errors) => {
  problems.push(label);
  console.error(`  FAIL ${label}`);
  for (const e of errors ?? []) console.error(`       ${e.instancePath || '/'} ${e.message}`);
};

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const contentSchema = read('contract/content.schema.json');
const stateSchema = read('contract/state.schema.json');
const backupSchema = read('contract/backup.schema.json');
ajv.addSchema(stateSchema); // backup.schema 의 $ref state.schema.json#/$defs/… 해석용
const validateContent = ajv.compile(contentSchema);
const validateState = ajv.compile(stateSchema);
const validateBackup = ajv.compile(backupSchema);

console.log('콘텐츠 계약');
const copies = {
  'content/content.source.json': read('content/content.source.json'),
  'client/src/content/bundled.json': read('client/src/content/bundled.json'),
  'static/content.json': read('static/content.json'),
};
for (const [label, json] of Object.entries(copies)) {
  validateContent(json) ? ok(`${label} (contentVersion ${json.contentVersion}, templates ${json.templates.length}, cheers ${json.cheers.length})`) : fail(label, validateContent.errors);
}
const [source, bundled, served] = Object.values(copies).map((j) => JSON.stringify(j));
if (source === bundled && source === served) ok('원본·번들·static 세 벌이 같음');
else fail('원본·번들·static 이 다름 — npm run content 로 다시 만들기');
const CLIENT_CONTENT_VERSION = 1; // client/src/content/index.ts CONTENT_CLIENT_VERSION
if (copies['client/src/content/bundled.json'].minClientVersion <= CLIENT_CONTENT_VERSION) ok(`minClientVersion ≤ 클라(${CLIENT_CONTENT_VERSION})`);
else fail('번들 minClientVersion 이 클라보다 큼');
const sampleContent = read('contract/samples/content.sample.json');
validateContent(sampleContent) ? ok('contract/samples/content.sample.json') : fail('contract/samples/content.sample.json', validateContent.errors);

console.log('상태 계약');
const sampleState = read('contract/samples/state.sample.json');
validateState(sampleState) ? ok('contract/samples/state.sample.json') : fail('contract/samples/state.sample.json', validateState.errors);
const payload = {
  version: 1,
  exportedAt: 1759000000000,
  boards: sampleState['mandalart.boards.v1'],
  checkins: sampleState['mandalart.checkins.v1'],
  unlocks: sampleState['mandalart.settings.v1'].unlocks,
};
validateBackup(payload) ? ok('백업 페이로드(상태 샘플로 조립) → backup.schema.json') : fail('백업 페이로드', validateBackup.errors);

if (problems.length) {
  console.error(`\n계약 검증 실패 ${problems.length}건`);
  process.exit(1);
}
console.log('\n계약 검증 통과');
