import { useCallback, useEffect, useRef, useState } from 'react';

import type { useAppState } from '../hooks/useAppState';
import { backupDelete, backupGet, backupUpsert, type RemoteBackup } from './api';
import { isBackupConfigured } from './config';
import { deriveBackupKey, fetchAnonymousHash } from './key';
import { buildPayload, cellsFilled, type BackupPayload } from './payload';

const AUTO_BACKUP_DELAY_MS = 5000;

type AppStateApi = ReturnType<typeof useAppState>;

/**
 * 백업·복원 (Supabase + 토스 익명 키). 켜져 있으면 판·체크 기록이 바뀐 5초 뒤 자동 백업해요.
 * 실패는 조용히 넘기고(다음 변경 때 다시), 수동 동작의 실패만 호출한 쪽에서 토스트로 알려요.
 */
export function useBackup(app: AppStateApi) {
  const configured = isBackupConfigured();
  const settings = app.state?.settings.backup;
  const enabled = configured && !!settings?.enabled && !!settings.key;
  const [busy, setBusy] = useState(false);
  const appRef = useRef(app);
  appRef.current = app;
  const timerRef = useRef<number | null>(null);
  const lastSyncedRef = useRef<{ boards: unknown; checkins: unknown } | null>(null);

  const runBackup = useCallback(async (): Promise<number> => {
    const current = appRef.current;
    const state = current.state;
    const key = state?.settings.backup.key;
    if (!state || !key) throw new Error('backup is off');
    const payload = buildPayload(state);
    const at = await backupUpsert(key, payload, __APP_VERSION__, cellsFilled(state.boards));
    lastSyncedRef.current = { boards: state.boards, checkins: state.checkins };
    current.updateSettings((s) => ({ ...s, backup: { ...s.backup, lastBackupAt: at } }));
    return at;
  }, []);

  // 자동 백업: 판·체크 기록이 바뀌면 5초 뒤 1회
  const boards = app.state?.boards;
  const checkins = app.state?.checkins;
  useEffect(() => {
    if (!enabled || !boards || !checkins) return;
    const last = lastSyncedRef.current;
    if (last && last.boards === boards && last.checkins === checkins) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      runBackup().catch(() => {
        /* 다음 변경 때 다시 시도 */
      });
    }, AUTO_BACKUP_DELAY_MS);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [enabled, boards, checkins, runBackup]);

  /** '백업 켜기': 익명 키 → 백업 키 저장. 서버에 이미 본이 있으면 돌려줘요(호출한 쪽이 복원 여부를 물어요). */
  const enable = useCallback(async (): Promise<RemoteBackup | null> => {
    setBusy(true);
    try {
      const hash = await fetchAnonymousHash();
      const key = await deriveBackupKey(hash);
      const remote = await backupGet(key);
      appRef.current.updateSettings((s) => ({ ...s, backup: { enabled: true, key, lastBackupAt: s.backup.lastBackupAt } }));
      return remote;
    } finally {
      setBusy(false);
    }
  }, []);

  const backupNow = useCallback(async (): Promise<number> => {
    setBusy(true);
    try {
      return await runBackup();
    } finally {
      setBusy(false);
    }
  }, [runBackup]);

  const fetchRemote = useCallback(async (): Promise<RemoteBackup | null> => {
    const key = appRef.current.state?.settings.backup.key;
    if (!key) return null;
    setBusy(true);
    try {
      return await backupGet(key);
    } finally {
      setBusy(false);
    }
  }, []);

  const restore = useCallback((payload: BackupPayload) => {
    appRef.current.importBackup(payload);
    lastSyncedRef.current = null;
  }, []);

  /** 백업 끄고 서버 본 삭제 */
  const disable = useCallback(async (): Promise<void> => {
    const key = appRef.current.state?.settings.backup.key;
    setBusy(true);
    try {
      if (key) await backupDelete(key);
      appRef.current.updateSettings((s) => ({ ...s, backup: { enabled: false, key: null, lastBackupAt: null } }));
      lastSyncedRef.current = null;
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    configured,
    enabled,
    lastBackupAt: settings?.lastBackupAt ?? null,
    busy,
    enable,
    backupNow,
    fetchRemote,
    restore,
    disable,
  };
}
