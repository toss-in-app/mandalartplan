import { withTimeout } from '../lib/async';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';
import { normalizePayload, type BackupPayload } from './payload';

const RPC_TIMEOUT_MS = 8000;

export type BackupStage = 'get' | 'upsert' | 'delete';

export class BackupApiError extends Error {
  constructor(
    public readonly stage: BackupStage,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BackupApiError';
  }
}

export interface RemoteBackup {
  payload: BackupPayload;
  payloadVersion: number;
  clientVersion: string;
  cellsFilled: number;
  updatedAt: number;
}

/** Supabase PostgREST RPC 호출. `supabase/schema.sql` 의 함수만 열려 있어요. */
async function rpc<T>(stage: BackupStage, fn: string, args: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await withTimeout(
      fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        // publishable key 는 JWT 가 아니라 `apikey` 헤더로만 보내요(Authorization: Bearer 에 넣지 말 것 — Supabase 문서).
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
        // 화면이 닫히는 중에도 요청이 끝까지 가도록(본문 64KB 이하, 백업 본은 20KB 안팎)
        keepalive: true,
      }),
      RPC_TIMEOUT_MS,
    );
  } catch {
    throw new BackupApiError(stage, 'network', '서버에 연결하지 못했어요');
  }
  if (!response.ok) throw new BackupApiError(stage, `http_${response.status}`, '서버가 요청을 거절했어요');
  try {
    return (await response.json()) as T;
  } catch {
    throw new BackupApiError(stage, 'bad_json', '서버 응답을 읽지 못했어요');
  }
}

interface BackupRow {
  payload: unknown;
  payload_version: number;
  client_version: string;
  cells_filled: number;
  updated_at: string;
}

export async function backupGet(key: string): Promise<RemoteBackup | null> {
  const rows = await rpc<BackupRow[]>('get', 'backup_get', { p_key: key });
  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row) return null;
  const payload = normalizePayload(row.payload);
  if (!payload) throw new BackupApiError('get', 'bad_payload', '서버에 있는 백업 본의 형식을 모르겠어요');
  const updatedAt = Date.parse(row.updated_at);
  return {
    payload,
    payloadVersion: typeof row.payload_version === 'number' ? row.payload_version : 1,
    clientVersion: typeof row.client_version === 'string' ? row.client_version : '',
    cellsFilled: typeof row.cells_filled === 'number' ? row.cells_filled : 0,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : payload.exportedAt,
  };
}

/** 성공하면 서버가 기록한 시각(ms) */
export async function backupUpsert(key: string, payload: BackupPayload, clientVersion: string, cells: number): Promise<number> {
  const saved = await rpc<string>('upsert', 'backup_upsert', {
    p_key: key,
    p_payload: payload,
    p_payload_version: payload.version,
    p_client_version: clientVersion,
    p_cells_filled: cells,
  });
  const at = typeof saved === 'string' ? Date.parse(saved) : NaN;
  return Number.isFinite(at) ? at : Date.now();
}

export async function backupDelete(key: string): Promise<boolean> {
  const deleted = await rpc<boolean>('delete', 'backup_delete', { p_key: key });
  return deleted === true;
}
