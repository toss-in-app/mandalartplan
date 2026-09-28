// content/content.source.json → (검증) → static/content.json + client/src/content/bundled.json
// 검증 통과한 것만 올린다. 스키마: contract/content.schema.json (JSON Schema 2020-12)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));

const schema = read('contract/content.schema.json');
const source = read('content/content.source.json');

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const problems = [];
if (!validate(source)) {
  for (const e of validate.errors) problems.push(`${e.instancePath || '/'} ${e.message}`);
}

// 스키마에 못 넣은 규칙: 이모지 금지, 템플릿 id 중복, 시즌 기간, 같은 템플릿 안 중복 문구
const EMOJI = /\p{Extended_Pictographic}/u;
const walk = (v, path) => {
  if (typeof v === 'string') {
    if (EMOJI.test(v)) problems.push(`${path}: 이모지 금지 — "${v}"`);
  } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}/${i}`));
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, `${path}/${k}`));
};
walk(source, '');
const ids = new Set();
for (const t of source.templates ?? []) {
  if (ids.has(t.id)) problems.push(`templates: id 중복 ${t.id}`);
  ids.add(t.id);
  const seen = new Set();
  for (const sub of t.subs ?? []) for (const a of sub.actions ?? []) {
    if (seen.has(a)) problems.push(`templates/${t.id}: 실천 문구 중복 "${a}"`);
    seen.add(a);
  }
}
if (source.season && source.season.from > source.season.to) problems.push('season: from 이 to 보다 늦음');

if (problems.length) {
  console.error(`콘텐츠 검증 실패 (${problems.length})`);
  for (const p of problems) console.error(' -', p);
  process.exit(1);
}

const json = JSON.stringify(source, null, 2) + '\n';
mkdirSync(resolve(root, 'static'), { recursive: true });
mkdirSync(resolve(root, 'client/src/content'), { recursive: true });
writeFileSync(resolve(root, 'static/content.json'), json);
writeFileSync(resolve(root, 'client/src/content/bundled.json'), json);
console.log(`ok: contentVersion ${source.contentVersion}, minClientVersion ${source.minClientVersion}, templates ${source.templates.length}, cheers ${source.cheers.length} → static/content.json, client/src/content/bundled.json`);
