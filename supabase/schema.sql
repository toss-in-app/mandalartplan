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
