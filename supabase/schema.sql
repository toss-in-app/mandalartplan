-- 만다라트 백업 — Supabase (BaaS, 토스 익명 키 기반)  v1 2026-10-04
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. 리전은 서울(ap-northeast-2).
--
-- 접근 모델
--  · 클라는 publishable key(sb_publishable_…)를 apikey 헤더로 보내고 서버에서는 anon 역할로 취급돼요.
--  · 로그인이 없으므로 서버는 사용자를 검증하지 못해요. 대신 테이블에 직접 접근을 막고(RLS, 정책 없음)
--    아래 RPC 로만 읽고 써요. 키는 토스 익명 키를 sha256 으로 가공한 64자리 hex 라 추측이 불가능해요.
--  · 민감 정보 없음(목표 글·체크 날짜·잠금 해제). 이름·연락처·계정 정보는 저장하지 않아요.

create table if not exists public.mandalart_backups (
  backup_key      text primary key check (backup_key ~ '^k[0-9a-f]{64}$'),
  payload         jsonb not null,                 -- contract/backup.schema.json
  payload_version int  not null default 1,
  client_version  text not null,                  -- 앱 버전 (package.json)
  cells_filled    int  not null default 0,         -- 복원 전 안내용 "73칸 중 n칸"
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.mandalart_backups enable row level security;
revoke all on table public.mandalart_backups from anon, authenticated;
-- 정책을 하나도 만들지 않아요 → anon/authenticated 는 테이블을 직접 읽고 쓸 수 없어요.

-- 읽기: 키 하나의 백업 본
create or replace function public.backup_get(p_key text)
returns table (payload jsonb, payload_version int, client_version text, cells_filled int, updated_at timestamptz)
language sql security definer set search_path = public stable as $$
  select b.payload, b.payload_version, b.client_version, b.cells_filled, b.updated_at
  from public.mandalart_backups b
  where b.backup_key = p_key;
$$;

-- 쓰기: 있으면 덮어쓰기. 200KB 넘는 본은 거부(정상 본은 20KB 안팎).
create or replace function public.backup_upsert(
  p_key text, p_payload jsonb, p_payload_version int, p_client_version text, p_cells_filled int
) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := now();
begin
  if p_key !~ '^k[0-9a-f]{64}$' then
    raise exception 'invalid key' using errcode = '22023';
  end if;
  if pg_column_size(p_payload) > 200000 then
    raise exception 'payload too large' using errcode = '22023';
  end if;
  insert into public.mandalart_backups as b
    (backup_key, payload, payload_version, client_version, cells_filled, updated_at)
  values (p_key, p_payload, coalesce(p_payload_version, 1), coalesce(p_client_version, ''), coalesce(p_cells_filled, 0), v_now)
  on conflict (backup_key) do update
    set payload = excluded.payload,
        payload_version = excluded.payload_version,
        client_version = excluded.client_version,
        cells_filled = excluded.cells_filled,
        updated_at = v_now;
  return v_now;
end;
$$;

-- 삭제: 백업 끄기
create or replace function public.backup_delete(p_key text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  delete from public.mandalart_backups where backup_key = p_key;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.backup_get(text) from public;
revoke all on function public.backup_upsert(text, jsonb, int, text, int) from public;
revoke all on function public.backup_delete(text) from public;
grant execute on function public.backup_get(text) to anon;
grant execute on function public.backup_upsert(text, jsonb, int, text, int) to anon;
grant execute on function public.backup_delete(text) to anon;

-- 보관 기간: 마지막 백업 후 1년이 지난 본은 지워요 (pg_cron 확장이 켜져 있을 때만 동작).
-- select cron.schedule('mandalart-backup-retention', '17 4 * * *',
--   $$delete from public.mandalart_backups where updated_at < now() - interval '1 year'$$);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2.0 AI 초안 (2026-10-20) — Edge Function `mandalart-draft` 의 남용 방지·비용 기록
-- 실행: 위 백업 부분과 따로 이 부분만 SQL Editor 에서 실행해도 돼요(다시 실행해도 안전).
--
--  · 목표 글·칸 글·AI 결과는 어디에도 저장하지 않아요. 남기는 것은 키 해시별 날짜·호출 수(7일 보관)와 날짜별 토큰 합계뿐.
--  · 키는 'k' + sha256('ai:' + 토스 익명 키) — 백업 키와 다른 값이라 둘을 이어 붙일 수 없어요.
--  · 두 함수는 서버 키(Edge Function)만 실행해요. anon(publishable key)에 주면 누구나 상한을 다 써 버릴 수 있어서 주지 않아요.
--  · 상한(호출 = Claude 1번): 키당 하루 100, 전체 하루 30,000 — 서울 날짜 기준(contract/ai-draft.api.md '한도').

create table if not exists public.ai_draft_usage (
  key_hash text not null check (key_hash ~ '^k[0-9a-f]{64}$'),
  day      date not null,
  calls    int  not null default 0,
  primary key (key_hash, day)
);
create index if not exists ai_draft_usage_day on public.ai_draft_usage (day);

create table if not exists public.ai_draft_cost (
  day                date primary key,
  calls              int    not null default 0,
  input_tokens       bigint not null default 0,
  output_tokens      bigint not null default 0,
  cache_read_tokens  bigint not null default 0,
  cache_write_tokens bigint not null default 0
);

alter table public.ai_draft_usage enable row level security;
alter table public.ai_draft_cost enable row level security;
revoke all on table public.ai_draft_usage from anon, authenticated;
revoke all on table public.ai_draft_cost from anon, authenticated;
-- 정책 없음 → anon/authenticated 는 두 표를 읽지도 쓰지도 못해요.

-- 하루 상한 안이면 이 키의 오늘 호출 수를 1 늘리고 true. 넘으면 false(아무것도 바꾸지 않음).
create or replace function public.ai_draft_take(p_key text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_day   date := (now() at time zone 'Asia/Seoul')::date;
  v_total bigint;
  v_mine  int;
begin
  if p_key !~ '^k[0-9a-f]{64}$' then
    return false;
  end if;
  select coalesce(sum(calls), 0) into v_total from public.ai_draft_usage where day = v_day;
  if v_total >= 30000 then
    return false;
  end if;
  insert into public.ai_draft_usage as u (key_hash, day, calls)
  values (p_key, v_day, 1)
  on conflict (key_hash, day) do update set calls = u.calls + 1
    where u.calls < 100
  returning calls into v_mine;
  -- 7일 지난 기록은 가끔(약 1%) 지워요
  if random() < 0.01 then
    delete from public.ai_draft_usage where day < v_day - 7;
  end if;
  return v_mine is not null;
end;
$$;

-- 날짜별 Claude 호출·토큰 합계(매주 '광고 수익 − AI 비용' 확인용).
create or replace function public.ai_draft_cost_add(
  p_calls int, p_in bigint, p_out bigint, p_cache_read bigint, p_cache_write bigint
) returns void
language sql security definer set search_path = public as $$
  insert into public.ai_draft_cost as c (day, calls, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens)
  values ((now() at time zone 'Asia/Seoul')::date, greatest(p_calls, 0), greatest(p_in, 0), greatest(p_out, 0), greatest(p_cache_read, 0), greatest(p_cache_write, 0))
  on conflict (day) do update
    set calls = c.calls + excluded.calls,
        input_tokens = c.input_tokens + excluded.input_tokens,
        output_tokens = c.output_tokens + excluded.output_tokens,
        cache_read_tokens = c.cache_read_tokens + excluded.cache_read_tokens,
        cache_write_tokens = c.cache_write_tokens + excluded.cache_write_tokens;
$$;

-- Postgres 는 새 함수의 실행 권한을 public 에 주고, Supabase 는 anon·authenticated 에도 기본으로 줘요 → 모두 걷고 서버 키(service_role)만.
revoke all on function public.ai_draft_take(text) from public, anon, authenticated;
revoke all on function public.ai_draft_cost_add(int, bigint, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function public.ai_draft_take(text) to service_role;
grant execute on function public.ai_draft_cost_add(int, bigint, bigint, bigint, bigint) to service_role;
