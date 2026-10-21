// 콘솔 '사용 전 미리보기' 이미지 만들기 — 세로형 636×1048 PNG (2026-10-21, 3.0.0 화면)
//   01~12 화면 전반(홈·세부 목표·기록 판·공유·AI·편집), 13~23 기록 위젯 대시보드(사용자 2026-10-21 '위젯 상세들로 10개 더')
//
// 쓰는 법
//   1) 개발 서버: npm --prefix client run dev -- --host 127.0.0.1 --port 5174
//   2) node console/screenshots/make.mjs            # 캡처 + 합성 → 이 폴더의 01-home.png … 23-records-edit.png
//      node console/screenshots/make.mjs --compose  # .work/raw/ 의 캡처를 다시 쓰고 글·틀만 다시 합성
//
// 필요한 것
//   - playwright: client/node_modules 나 전역(npm i -g playwright)에서 찾고, 없으면 PLAYWRIGHT_MODULE=경로 로 알려 준다.
//     크로미움은 playwright 것을 쓰고, CHROMIUM=실행파일 로 바꿀 수 있다.
//   - 글꼴 Pretendard: 처음 한 번 .work/ 에 내려받는다(커밋 안 함). 폰 안 화면은 앱이 쓰는 시스템 글꼴 그대로.
//
// 예시 데이터는 저장소를 건드리지 않고 브라우저 localStorage 에만 넣는다(번들 템플릿 0번 '올해는 몸과 마음이 건강한 한 해' + 140일치 예시 기록).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const WORK = path.join(HERE, '.work');
const RAW = path.join(WORK, 'raw');
const HTML = path.join(WORK, 'html');
const BASE = process.env.BASE ?? 'http://127.0.0.1:5174/';
const COMPOSE_ONLY = process.argv.includes('--compose');
const FONT = path.join(WORK, 'PretendardVariable.ttf');
const FONT_URL = 'https://raw.githubusercontent.com/orioncactus/pretendard/main/packages/pretendard/dist/public/variable/PretendardVariable.ttf';

for (const d of [RAW, HTML]) fs.mkdirSync(d, { recursive: true });

// ───── playwright 찾기 ─────
async function loadChromium() {
  const req = createRequire(path.join(REPO, 'client', 'package.json'));
  const candidates = [process.env.PLAYWRIGHT_MODULE, 'playwright', '@playwright/test', '/opt/node22/lib/node_modules/playwright/index.mjs'].filter(Boolean);
  for (const c of candidates) {
    let resolved;
    try { resolved = path.isAbsolute(c) ? c : req.resolve(c); } catch { continue; }
    if (!fs.existsSync(resolved)) continue;
    const mod = await import(pathToFileURL(resolved).href);
    const chromium = mod.chromium ?? mod.default?.chromium;
    if (chromium) return chromium;
  }
  throw new Error('playwright 를 못 찾았어요. `npm --prefix client i -D playwright && npx --prefix client playwright install chromium` 뒤 다시 하거나, PLAYWRIGHT_MODULE=경로 로 알려 주세요');
}

async function ensureFont() {
  if (fs.existsSync(FONT) && fs.statSync(FONT).size > 1_000_000) return;
  console.log('Pretendard 글꼴을 내려받아요 (처음 한 번)…');
  try {
    execFileSync('curl', ['-fsSL', '-o', FONT, FONT_URL], { stdio: 'inherit' });
  } catch {
    const res = await fetch(FONT_URL);
    if (!res.ok) throw new Error(`글꼴 내려받기 실패: ${res.status}`);
    fs.writeFileSync(FONT, Buffer.from(await res.arrayBuffer()));
  }
}

// ───── 예시 데이터 ─────
const BOARD_ID = 'b1759000000000';
const tpl = JSON.parse(fs.readFileSync(path.join(REPO, 'client', 'src', 'content', 'bundled.json'), 'utf8')).templates[0];
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = new Date();
const days = {};
// 9월까지 한 번도 안 한 실천 3개 — 지난달 회고에 '한 번도 못 한 실천'이 보이게(10월엔 해요)
const RARE = [13, 27, 58];

// 140~35일 전(약 6월 초~9월 중순): 드문드문 하다가 한 번 21일 연속 — 최고 기록·배지·지난달 회고·1년 잔디·누적 선이 보이게.
// 실천마다 자주 하는 정도가 달라 9×9 가 고르지 않고, 토요일엔 덜 하고 월요일에 많이 해 요일별 평균이 보여요
let seed2 = 11;
const rnd2 = () => { seed2 = (seed2 * 9301 + 49297) % 233280; return seed2 / 233280; };
const weight = Array.from({ length: 64 }, (_, i) => 0.25 + (((i * 37) % 64) / 64) * 0.75);
const weekdayFactor = [0.8, 1.1, 1.0, 0.9, 1.0, 0.7, 0.5]; // 일 월 화 수 목 금 토
for (let back = 139; back >= 35; back--) {
  const d = new Date(today); d.setDate(today.getDate() - back);
  const inRun = back <= 80 && back >= 60; // 21일 연속
  if (!inRun && rnd2() < 0.28) continue; // 쉬는 날
  const base = (inRun ? 0.45 : 0.3) * weekdayFactor[d.getDay()];
  const list = [];
  for (let i = 0; i < 64; i++) { const r = rnd2(); if (r < base * weight[i] && !RARE.includes(i)) list.push(i); }
  if (list.length === 0) list.push(Math.floor(rnd2() * 64));
  days[key(d)] = list;
}

// 최근 35일: 최근 12일은 매일(연속), 그 전은 드문드문. 오늘은 세부 목표 1의 4칸을 포함해 21개
let seed = 7;
const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
for (let back = 34; back >= 0; back--) {
  const d = new Date(today); d.setDate(today.getDate() - back);
  const p = back < 12 ? 0.55 + rnd() * 0.3 : rnd() < 0.3 ? 0 : 0.3 + rnd() * 0.4;
  if (p === 0) continue;
  const list = [];
  for (let i = 0; i < 64; i++) { const r = rnd(); if (r < p && !(back >= 21 && RARE.includes(i))) list.push(i); }
  if (back === 0) { for (const a of [0, 1, 2, 4]) if (!list.includes(a)) list.push(a); list.splice(21); }
  if (list.length === 0) list.push(Math.floor(rnd() * 64));
  days[key(d)] = [...new Set(list)].sort((a, b) => a - b);
}
const board = { id: BOARD_ID, goal: tpl.goal, subs: tpl.subs.map((s) => ({ title: s.title, actions: s.actions.slice() })), templateId: null, aiDraft: null, createdAt: 1, updatedAt: 1 };
const boardAi = { ...board, aiDraft: { at: Date.now(), model: 'claude-haiku-5-5', promptVersion: 3, cells: Array.from({ length: 72 }, (_, i) => i + 1) } };
const first = new Date(today); first.setDate(today.getDate() - 139);
const settings = { version: 1, notification: 'agreed', unlocks: { extraBoard: false }, seenContentVersion: 99, firstCheckinAt: first.getTime(), backup: { enabled: false, key: null, lastBackupAt: null }, ads: { lastInterstitialDate: key(today) }, ai: { noticeAt: 1, runs: { date: null, count: 0 } }, trial: { cardDismissedAt: 1 }, records: { widgets: null } };
const checkins = { version: 1, byBoard: { [BOARD_ID]: { days, lastCompletedAt: Date.now() } } };

// ───── 캡처 (390×844 @2x) ─────
const chromium = await loadChromium();
const executablePath = process.env.CHROMIUM ?? (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });

async function capture(name, route, { board: b = board, act, wait = 900 } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await context.addInitScript(({ boards, checkins, settings }) => {
    localStorage.setItem('__ait_storage:mandalart.boards.v1', JSON.stringify(boards));
    localStorage.setItem('__ait_storage:mandalart.checkins.v1', JSON.stringify(checkins));
    localStorage.setItem('__ait_storage:mandalart.settings.v1', JSON.stringify(settings));
  }, { boards: { version: 1, active: 0, boards: [b] }, checkins, settings });
  const page = await context.newPage();
  try {
    await page.goto(BASE + route);
    await page.waitForSelector('#root *');
    await page.waitForTimeout(600);
    if (act) await act(page);
    await page.waitForTimeout(wait);
    // 개발용 AIT 버튼처럼 #root 밖에 있는 것과 개발용 광고 자리(배너 mock)는 숨기고,
    // TDS 아이콘(CDN)이 안 뜬 환경이면 기간 버튼 ‹ › 를 같은 모양으로 그려 넣는다(실기기에선 TDS 아이콘이 보여요)
    await page.evaluate(() => {
      for (const el of document.body.children) if (el.id !== 'root') el.style.display = 'none';
      for (const el of document.querySelectorAll('[data-testid="ad-banner"]')) {
        const wrap = el.parentElement;
        (wrap && /24px/.test(wrap.style.padding) ? wrap : el).style.display = 'none';
      }
      for (const el of document.querySelectorAll('.rc-nav-btn')) {
        const btn = el.tagName === 'BUTTON' ? el : el.querySelector('button') ?? el;
        if (btn.querySelector('svg.cap-chev')) continue;
        const shown = Array.from(btn.querySelectorAll('img, svg')).some((n) => n.getBoundingClientRect().width > 4 && !(n.tagName === 'IMG' && !n.complete));
        if (shown && !Array.from(btn.querySelectorAll('img')).some((img) => img.naturalWidth === 0)) continue;
        for (const c of btn.children) c.style.display = 'none';
        const left = /지난|작년|이전/.test(btn.getAttribute('aria-label') || '');
        const disabled = btn.disabled || btn.getAttribute('aria-disabled') === 'true';
        btn.insertAdjacentHTML('beforeend', `<svg class="cap-chev" width="16" height="16" viewBox="0 0 24 24" style="display:block;margin:auto"><path d="${left ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}" stroke="${disabled ? '#D1D6DB' : '#333D4B'}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
        btn.style.display = 'flex'; btn.style.alignItems = 'center'; btn.style.justifyContent = 'center';
      }
    });
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(RAW, `${name}.png`) });
    console.log('captured', name);
  } catch (e) {
    console.log('FAILED', name, String(e).slice(0, 160));
  }
  await context.close();
}
const clickText = async (page, text) => { await page.locator(`:text-is("${text}")`).first().click({ timeout: 3000 }); };
/** 기간 탭(주·월·년 / 4주·8주·전체) 누르기 — 없으면 그냥 지나가요 */
const tab = (text) => async (page) => { try { await clickText(page, text); } catch {} };
/** 키보드용 숨은 버튼(편집 모드 들어가기)을 눌러요 — 3×3 은 .mg-reveal-on-focus, 기록 판은 .rc-reveal */
const reveal = async (page, selector, label) => page.evaluate(([selector, label]) => { for (const b of document.querySelectorAll(selector)) if (!label || b.textContent.trim() === label) { b.click(); return true; } return false; }, [selector, label]);

if (!COMPOSE_ONLY) {
  try {
    await fetch(BASE);
  } catch {
    await browser.close();
    throw new Error(`개발 서버가 ${BASE} 에 없어요. 먼저 \`npm --prefix client run dev -- --host 127.0.0.1 --port 5174\``);
  }
  // 01~12
  await capture('home', '#/');
  await capture('home-ai', '#/', { board: boardAi });
  await capture('sub', '#/sub/0');
  await capture('edit', '#/sub/0', { act: async (p) => { await reveal(p, 'button.mg-reveal-on-focus', '편집'); }, wait: 450 });
  await capture('records', '#/today', { wait: 2800 });
  await capture('board-month', '#/record/board', { act: tab('월'), wait: 2800 });
  await capture('calendar', '#/record/calendar', { act: tab('월'), wait: 2800 });
  await capture('report', '#/record/report', { wait: 5200 });
  await capture('badges', '#/record/badges', { wait: 2800 });
  await capture('streak', '#/record/streak', { wait: 2800 });
  await capture('share', '#/share', { wait: 1800 });
  await capture('draft', '#/draft', { act: async (p) => { try { await p.locator('textarea, input').first().fill('올해 안에 책 한 권 쓰기', { timeout: 3000 }); } catch {} }, wait: 800 });
  // 13~23 위젯 대시보드
  await capture('stamps-week', '#/record/week', { wait: 2800 });
  await capture('stamps-year', '#/record/week', { act: tab('년'), wait: 2800 });
  await capture('board-week', '#/record/board', { act: tab('주'), wait: 2800 });
  await capture('board-year', '#/record/board', { act: tab('년'), wait: 2800 });
  await capture('year-grass', '#/record/year', { wait: 2800 });
  await capture('calendar-week', '#/record/calendar', { act: tab('주'), wait: 2800 });
  await capture('score', '#/record/score', { wait: 3200 });
  await capture('weekday', '#/record/weekday', { wait: 2800 });
  await capture('review', '#/record/review', { wait: 2800 });
  await capture('total', '#/record/total', { wait: 3200 });
  await capture('records-edit', '#/today', { act: async (p) => { await p.waitForTimeout(2600); await reveal(p, 'button.rc-reveal'); }, wait: 700 });
}

// ───── 636×1048 합성: 바탕색 + 제목 + 한 줄 설명 + 폰 틀 ─────
// 글은 해요체, 느낌표·이모지 없이(콘솔 규칙). 틀 색: purple = 브랜드 보라, dark = 리포트처럼 화면이 보라일 때, light = 흰 화면 위 보라 표시가 잘 보이게
const specs = [
  ['01-home', 'home', '핵심 목표 하나,\n세부 목표 여덟', '가운데 3×3에 적고 매일 실천을 체크해요', 'purple'],
  ['02-sub', 'sub', "오늘 한 실천엔\n'완료' 도장", '칸을 누르면 도장이 찍히고 세부 목표 칸이 차올라요', 'purple'],
  ['03-records', 'records', '기록은 위젯으로\n한눈에', '연속·이번 주 도장·달력·배지를 원하는 대로 배치해요', 'purple'],
  ['04-board-month', 'board-month', '한 달이 9×9에\n쌓여요', '실천한 만큼 칸이 진해지고, 누르면 한 날짜가 보여요', 'purple'],
  ['05-calendar', 'calendar', '도장 달력', '실천한 날이 달력에 남고 연속 일수가 이어져요', 'purple'],
  ['06-report', 'report', '일요일 밤,\n지난주 리포트', '월요일부터 도장이 하나씩 찍히고 글로 공유해요', 'dark'],
  ['07-badges', 'badges', '배지 12개', '첫 도장부터 30일 연속, 도장 500개까지 꾸준함에 붙는 표시예요', 'purple'],
  ['08-streak', 'streak', '연속 일수와\n다음 고비', '오늘까지 며칠째인지, 최고 기록은 얼마인지', 'purple'],
  ['09-share', 'share', '다 채운 9×9는\n이미지로', '저장하거나 글·링크로 바로 보내요', 'purple'],
  ['10-ai', fs.existsSync(path.join(RAW, 'draft.png')) ? 'draft' : 'home-ai', '핵심 목표만 적으면\nAI가 초안을 채워요', "광고 한 번에 세부 목표 8개와 실천 64개 초안, 'AI 초안' 표시로 구분해요", 'purple'],
  ['11-edit', 'edit', '길게 누르면 편집,\n꾹 눌러 끌면 옮겨요', '칸을 누르면 고치고, 빠르게 끌면 지울 칸을 골라요', 'purple'],
  ['12-home-ai', 'home-ai', "AI가 쓴 칸엔\n'AI 초안' 표시", '내 말로 고치면 표시가 사라져요', 'light'],
  // 위젯 대시보드
  ['13-stamps-week', 'stamps-week', '이번 주 도장은\n몇 개일까요', '요일 막대로 보고 지난주 이맘때와 비교해요', 'purple'],
  ['14-stamps-year', 'stamps-year', '한 해를\n달마다 막대로', '어느 달에 가장 많이 실천했는지 한눈에 보여요', 'purple'],
  ['15-board-week', 'board-week', '이번 주엔\n어느 가지가 차올랐나', '세부 목표 3×3이 도장을 찍은 날만큼 차올라요', 'purple'],
  ['16-board-year', 'board-year', '1년이 9×9에\n진하게 남아요', '자주 한 실천일수록 칸이 진해지고, 누르면 그 실천을 한 날짜가 보여요', 'purple'],
  ['17-year-grass', 'year-grass', '1년 잔디', '실천한 날이 하루 한 칸씩 자라고, 가장 잘한 달도 알려 줘요', 'purple'],
  ['18-calendar-week', 'calendar-week', '이번 주 요일 고리', '그날 손댄 세부 목표만큼 고리가 차고, 누르면 그날 한 실천이 보여요', 'purple'],
  ['19-score', 'score', '꾸준함 점수\n100점 만점', '가지마다 점수도 따로 보여 줘요', 'purple'],
  ['20-weekday', 'weekday', '요일마다\n하루 평균 도장', '가장 많이 하는 요일과 쉬어 가는 요일, 요일마다 많이 한 가지', 'purple'],
  ['21-review', 'review', '지난달 돌아보기', '잘한 실천 셋과 한 번도 못 한 실천을 짚어 줘요', 'purple'],
  ['22-total', 'total', '첫 도장부터\n지금까지', '다음 고비까지 남은 개수와 달마다 쌓인 선', 'purple'],
  ['23-records-edit', 'records-edit', '길게 눌러\n판을 내 맘대로', '위젯을 끌어 옮기고, 숨기고, 다시 넣어요', 'light'],
];
const THEMES = {
  purple: { bg: '#6B5CFF', fg: '#ffffff', sub: 'rgba(255,255,255,0.86)' },
  dark: { bg: '#191F28', fg: '#ffffff', sub: 'rgba(255,255,255,0.8)' },
  light: { bg: '#F1EFFF', fg: '#191F28', sub: '#4E5968' },
};

await ensureFont();
const page = await browser.newPage({ viewport: { width: 636, height: 1048 }, deviceScaleFactor: 1 });
for (const [out, raw, title, sub, theme] of specs) {
  const src = path.join(RAW, `${raw}.png`);
  if (!fs.existsSync(src)) { console.log('skip', out, '(캡처 없음)'); continue; }
  const t = THEMES[theme];
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
  @font-face { font-family: 'Pretendard'; src: url('${pathToFileURL(FONT).href}') format('truetype'); font-weight: 100 900; }
  html, body { margin: 0; width: 636px; height: 1048px; overflow: hidden; }
  body { background: ${t.bg}; font-family: Pretendard, 'Apple SD Gothic Neo', system-ui, sans-serif; position: relative; }
  .cap { position: absolute; left: 48px; right: 48px; top: 64px; color: ${t.fg}; }
  h1 { margin: 0; font-size: 46px; line-height: 1.22; font-weight: 800; letter-spacing: -0.6px; white-space: pre-line; word-break: keep-all; }
  p { margin: 16px 0 0; font-size: 21px; line-height: 1.45; font-weight: 500; color: ${t.sub}; word-break: keep-all; }
  .phone { position: absolute; left: 58px; top: 312px; width: 520px; border-radius: 48px; background: #ffffff; border: 10px solid #15161a; box-sizing: content-box; overflow: hidden; box-shadow: 0 34px 70px rgba(0,0,0,0.32); }
  .phone img { display: block; width: 100%; }
  </style></head><body>
  <div class="cap"><h1>${title}</h1><p>${sub}</p></div>
  <div class="phone"><img src="${pathToFileURL(src).href}" alt=""></div>
  </body></html>`;
  const htmlPath = path.join(HTML, `${out}.html`);
  fs.writeFileSync(htmlPath, html);
  await page.goto(pathToFileURL(htmlPath).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(HERE, `${out}.png`), clip: { x: 0, y: 0, width: 636, height: 1048 } });
  console.log('composed', out);
}
await browser.close();
