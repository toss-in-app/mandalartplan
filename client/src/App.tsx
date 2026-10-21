import { useDialog, useToast } from '@toss/tds-mobile';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AD_GROUPS } from './ads/config';
import { isAiConfigured } from './ai/config';
import { AI_MESSAGES, CARE_PHONE_URL } from './ai/messages';
import { canFillActions, canFillBoard, emptyActionCount, emptyCellCount } from './ai/rules';
import { useAiDraft, type AiResult } from './ai/useAiDraft';
import { interstitialEligible } from './ads/rules';
import { useInterstitial } from './ads/useInterstitial';
import { useRewardedAd } from './ads/useRewardedAd';
import { OG_IMAGE_URL, fetchRemoteContent, getBundledContent, type Content } from './content';
import { BackupApiError } from './backup/api';
import { describeBackupError } from './backup/errors';
import { BackupKeyError } from './backup/key';
import { cellsFilled } from './backup/payload';
import { useBackup } from './backup/useBackup';
import { useAppState } from './hooks/useAppState';
import { useBoardPicker } from './hooks/useBoardPicker';
import { logEvent } from './lib/analytics';
import { canSaveImage, createShareLink, haptic, openUrl, saveImageToPhotos, shareText } from './lib/bridge';
import { HD_CARD, cardFileName, renderCard, type RenderedCard } from './lib/card';
import { notificationAvailable, requestNotificationAgreement } from './notification/agreement';
import { clearBlockCells } from './lib/cellEdit';
import { applyCheckin, todayChecked, todaySet, toggleCheck } from './lib/checkin';
import { subCompleted } from './lib/cells';
import { CENTER, TOTAL_CELLS, boardToText, cellOfRing, getProgress, hasAiText, ringIndex, splitActionIndex } from './lib/mandalart';
import { formatDateTime } from './lib/format';
import { atHistoryBottom, goBack, navigate, useRoute } from './lib/router';
import { MAX_BOARDS, dateKey, streak, type BoardsState } from './lib/state';
import { DraftScreen } from './screens/DraftScreen';
import { HomeScreen } from './screens/HomeScreen';
import { OverviewScreen } from './screens/OverviewScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ShareScreen } from './screens/ShareScreen';
import { SubScreen } from './screens/SubScreen';
import { TrialScreen } from './screens/TrialScreen';
import { TodayScreen } from './screens/TodayScreen';
import './App.css';

/** 상태를 읽기 전(첫 렌더)의 자리 — 판 바꾸기 시트는 판이 2개일 때만 열리니 비어 있어도 돼요 */
const NO_BOARDS: BoardsState = { version: 1, active: 0, boards: [] };

function App() {
  const route = useRoute();
  const app = useAppState();
  const [content, setContent] = useState<Content>(getBundledContent);
  /** 공유 화면에서 저장·링크·광고 브릿지가 진행 중인지 (버튼 중복 탭 방지) */
  const [shareBusy, setShareBusy] = useState(false);
  /** 전면 광고가 뜨는 동안 홈 '기록 보기' 잠금 */
  const [todayBusy, setTodayBusy] = useState(false);
  /** 두 번째 판 리워드 광고가 뜨는 동안 설정 행 잠금 */
  const [extraBoardBusy, setExtraBoardBusy] = useState(false);
  /** 리워드 광고를 끝까지 봤지만 아직 저장하지 못한 고화질 1회분 (권한 거부 등으로 실패하면 광고를 다시 보지 않게) */
  const hdCredit = useRef(false);
  const { openConfirm } = useDialog();
  const toast = useToast();

  const backup = useBackup(app);

  // 광고: 전면은 오늘 체크가 생기면 미리 불러오고(하루 1회), 리워드는 공유 화면에 있는 동안만 미리 불러와요(동시 로딩 금지).
  const today = dateKey();
  const activeBoard = app.board;
  const todayChecks = app.state && activeBoard ? todaySet(app.state.checkins.byBoard[activeBoard.id], today).size : 0;
  const interstitialReady = app.state ? interstitialEligible(app.state.settings, today, todayChecks) : false;
  const interstitial = useInterstitial(AD_GROUPS.interstitialToday, interstitialReady);
  const hdReward = useRewardedAd(AD_GROUPS.rewardedHdImage, route.name === 'share');
  // 두 번째 판: 리워드로 한 번 열면 영구. (백업 복원 등으로) 판이 이미 2개면 열린 것으로 봐요.
  const extraBoardOpen = app.state ? app.state.settings.unlocks.extraBoard || app.state.boards.boards.length >= MAX_BOARDS : false;
  // AI 초안(2.0): 광고 1회 = AI 1회. 서버 설정이 없거나 광고를 못 쓰는 토스앱 버전이면 AI 버튼을 숨겨요
  const aiConfigured = isAiConfigured();
  // 리워드 광고는 AI 버튼이 있는 화면에서만 미리 불러와요: 초안 화면, 빈 칸을 채울 수 있는 홈(2.1 바로 광고), 빈 실천을 채울 수 있는 세부 목표 화면(예전 편집 링크 block/:n 포함)
  const aiSubIndex = route.name === 'sub' ? route.sub : route.name === 'block' && route.block !== CENTER ? ringIndex(route.block) : null;
  const onHome = route.name === 'home' || (route.name === 'block' && route.block === CENTER);
  const aiAdActive =
    aiConfigured &&
    (route.name === 'draft' ||
      (onHome && activeBoard ? canFillBoard(activeBoard) : false) ||
      (aiSubIndex !== null && activeBoard ? canFillActions(activeBoard, aiSubIndex) : false));
  const extraBoardAdActive = route.name === 'settings' && !extraBoardOpen;
  // AI 전용 지면을 만들 수 없는 동안(앱인토스 공지 54047) AI 는 '두 번째 판' 지면을 같이 써요 → 같은 그룹을 두 훅이 따로 불러오지 않게 하나로 묶어요
  const aiSharesExtraBoard = AD_GROUPS.rewardedAiDraft === AD_GROUPS.rewardedExtraBoard;
  const extraBoardReward = useRewardedAd(AD_GROUPS.rewardedExtraBoard, extraBoardAdActive || (aiSharesExtraBoard && aiAdActive));
  const aiOwnReward = useRewardedAd(AD_GROUPS.rewardedAiDraft, !aiSharesExtraBoard && aiAdActive);
  const aiReward = aiSharesExtraBoard ? extraBoardReward : aiOwnReward;
  const aiEnabled = aiConfigured && aiReward.supported;
  const ai = useAiDraft(app, aiReward);
  const switchBoard = useCallback(
    (index: number) => {
      app.setActiveBoard(index);
      logEvent('board_switch', { to: index });
      void haptic('tap');
    },
    [app],
  );
  const openBoardPicker = useBoardPicker(app.state?.boards ?? NO_BOARDS, switchBoard);
  const backupErrorToast = useCallback(
    (error: unknown) => {
      logEvent('backup_error', describeBackupError(error));
      if (error instanceof BackupKeyError) toast.openToast(error.message);
      else if (error instanceof BackupApiError) toast.openToast('서버에 연결하지 못했어요. 잠시 뒤에 다시 해 주세요');
      else toast.openToast('백업하지 못했어요. 잠시 뒤에 다시 해 주세요');
    },
    [toast],
  );

  const enableBackup = useCallback(async () => {
    const ok = await openConfirm({
      title: '서버 백업을 켤까요?',
      description: '토스 익명 식별값으로 만든 키와 적은 내용·체크 기록이 서버에 저장돼요. 이름·연락처는 저장하지 않아요. 설정에서 언제든 끄고 지울 수 있어요.',
      confirmButton: '켜기',
      cancelButton: '닫기',
    });
    if (!ok) return;
    try {
      const remote = await backup.enable();
      logEvent('backup_enable');
      const localFilled = app.board ? cellsFilled({ version: 1, active: 0, boards: [app.board] }) : 0;
      if (remote && remote.cellsFilled > 0) {
        const restore =
          localFilled === 0 ||
          (await openConfirm({
            title: '서버에 백업이 있어요',
            description: `${formatDateTime(remote.updatedAt)} 백업(73칸 중 ${remote.cellsFilled}칸)으로 바꿀까요? 닫기를 누르면 지금 기기 내용을 서버에 올려요.`,
            confirmButton: '복원',
            cancelButton: '닫기',
          }));
        if (restore) {
          backup.restore(remote.payload);
          logEvent('backup_restore', { cells: remote.cellsFilled });
          toast.openToast('서버 백업으로 복원했어요');
          navigate({ name: 'home' });
          return;
        }
      }
      await backup.backupNow();
      toast.openToast('서버 백업을 켰어요');
    } catch (error) {
      backupErrorToast(error);
    }
  }, [app.board, backup, backupErrorToast, openConfirm, toast]);

  const backupNow = useCallback(async () => {
    try {
      await backup.backupNow();
      toast.openToast('백업했어요');
    } catch (error) {
      backupErrorToast(error);
    }
  }, [backup, backupErrorToast, toast]);

  const restoreBackup = useCallback(async () => {
    try {
      const remote = await backup.fetchRemote();
      if (!remote) {
        toast.openToast('서버에 백업이 아직 없어요. 지금 백업하기를 누르면 올려요');
        return;
      }
      const ok = await openConfirm({
        title: '서버 백업으로 바꿀까요?',
        description: `${formatDateTime(remote.updatedAt)} 백업(73칸 중 ${remote.cellsFilled}칸)이에요. 지금 기기의 내용은 사라져요.`,
        confirmButton: '복원',
        cancelButton: '닫기',
      });
      if (!ok) return;
      backup.restore(remote.payload);
      logEvent('backup_restore', { cells: remote.cellsFilled });
      toast.openToast('서버 백업으로 복원했어요');
      navigate({ name: 'home' });
    } catch (error) {
      backupErrorToast(error);
    }
  }, [backup, backupErrorToast, openConfirm, toast]);

  const disableBackup = useCallback(async () => {
    const ok = await openConfirm({
      title: '백업을 끄고 서버 데이터를 지울까요?',
      description: '서버에 있는 백업 본이 바로 지워져요. 이 기기의 내용은 그대로예요.',
      confirmButton: '지우기',
      cancelButton: '닫기',
    });
    if (!ok) return;
    try {
      await backup.disable();
      logEvent('backup_disable');
      toast.openToast('서버 백업을 끄고 지웠어요');
    } catch (error) {
      backupErrorToast(error);
    }
  }, [backup, backupErrorToast, openConfirm, toast]);

  const resetAll = useCallback(async () => {
    const twoBoards = (app.state?.boards.boards.length ?? 1) > 1;
    const ok = await openConfirm({
      title: '처음부터 다시 만들까요?',
      description: twoBoards
        ? '두 판에 적은 목표·실천과 체크 기록이 모두 지워져요. 되돌릴 수 없어요.'
        : '적은 목표·실천과 체크 기록이 모두 지워져요. 되돌릴 수 없어요.',
      confirmButton: '지우기',
      cancelButton: '닫기',
    });
    if (!ok) return;
    logEvent('reset');
    await app.reset();
    toast.openToast('새 만다라트를 시작해요');
    navigate({ name: 'home' });
  }, [app, openConfirm, toast]);

  // 첫 화면은 번들 콘텐츠로 즉시 그리고, 원격은 뒤에서 한 번만 시도해요.
  useEffect(() => {
    let alive = true;
    void fetchRemoteContent().then((remote) => {
      if (alive && remote) setContent(remote);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  // 본 콘텐츠 버전(계약 settings.seenContentVersion): 지금 그리는 콘텐츠(번들 또는 원격)의 버전을 남겨요. 콘텐츠가 갱신됐을 때만 저장.
  const contentVersion = content.contentVersion;
  const stateLoaded = app.state !== null;
  const { updateSettings } = app;
  useEffect(() => {
    if (!stateLoaded) return;
    updateSettings((settings) => (settings.seenContentVersion >= contentVersion ? settings : { ...settings, seenContentVersion: contentVersion }));
  }, [stateLoaded, contentVersion, updateSettings]);

  // 분석(contract/events.md): 화면 진입은 라우트가 바뀔 때 1회(home_view·today_view), board_filled 는 보고 있는 판이 73칸이 되는 순간(판마다 사실상 1회).
  // 값은 ref 로 읽어 상태가 바뀔 때마다 다시 보내지 않아요. 편집(board_edit·edit_mode_enter)은 화면의 제자리 편집 모드가 보내요(hooks/useGridEdit).
  const latest = useRef({ filled: 0, boards: 0, todayCount: 0, streak: 0 });
  latest.current = {
    filled: activeBoard ? getProgress(activeBoard).filled : 0,
    boards: app.state?.boards.boards.length ?? 0,
    todayCount: todayChecks,
    streak: app.state && activeBoard ? streak(app.state.checkins.byBoard[activeBoard.id], today) : 0,
  };
  const loaded = app.state !== null;
  const screen = route.name;
  useEffect(() => {
    if (!loaded) return;
    if (screen === 'home') logEvent('home_view', { filled: latest.current.filled, boards: latest.current.boards });
    else if (screen === 'today') logEvent('today_view', { todayCount: latest.current.todayCount, streak: latest.current.streak });
  }, [loaded, screen]);

  const filledRef = useRef<{ id: string; filled: number } | null>(null);
  useEffect(() => {
    if (!activeBoard) return;
    const filled = getProgress(activeBoard).filled;
    const prev = filledRef.current;
    if (prev && prev.id === activeBoard.id && prev.filled < TOTAL_CELLS && filled === TOTAL_CELLS) {
      logEvent('board_filled', { templateId: activeBoard.templateId ?? 'none', ai: hasAiText(activeBoard) });
    }
    filledRef.current = { id: activeBoard.id, filled };
  }, [activeBoard]);

  const { state, board } = app;
  // 저장된 상태를 읽는 동안(수십 ms)은 빈 화면. 번들 안에서 끝나는 일이라 로더는 두지 않아요.
  if (!state || !board) return null;

  const record = state.checkins.byBoard[board.id];
  const openSub = (subIndex: number) => navigate({ name: 'sub', sub: subIndex });
  /** 1분 체험판(2.1). 홈 맨 위 안내 카드·설정의 '1분 체험해 보기'로만 열려요 */
  const openTrial = (from: 'home' | 'settings') => {
    logEvent('trial_start', { from });
    navigate({ name: 'trial' });
  };
  /** 홈 맨 위 안내 카드는 처음 온 사람에게만: 실천을 적기 전, ✕로 닫거나 체험판을 끝까지 하기 전까지 */
  const showTrialCard = getProgress(board).actionsFilled === 0 && state.settings.trial.cardDismissedAt === null;
  const dismissTrialCard = () =>
    app.updateSettings((settings) => (settings.trial.cardDismissedAt !== null ? settings : { ...settings, trial: { ...settings.trial, cardDismissedAt: Date.now() } }));

  /**
   * 실천 칸 탭 = 오늘 했어요 체크/해제. 처음 체크한 순간을 settings 에 남겨요(알림 안내용).
   * 진동(2.1, '완료' 도장): 도장을 찍을 때는 톡, 뗄 때는 더 약하게, 그 세부 목표의 실천에 오늘 도장을 다 찍은 순간은 '성공'.
   */
  const toggleToday = (actionIndex: number) => {
    const now = Date.now();
    const date = dateKey();
    const current = app.getState();
    if (!current) return;
    const first = current.settings.firstCheckinAt === null;
    const next = toggleCheck(current.checkins, board.id, date, actionIndex, now);
    app.updateCheckins(() => next);
    if (first) app.updateSettings((settings) => ({ ...settings, firstCheckinAt: now }));
    const nextRecord = next.byBoard[board.id];
    const checkedNow = todaySet(nextRecord, date);
    const crossed = checkedNow.has(actionIndex);
    void haptic(!crossed ? 'tickWeak' : subCompleted(board, splitActionIndex(actionIndex).subIndex, checkedNow) ? 'success' : 'tap');
    logEvent('action_check', {
      index: actionIndex,
      checked: crossed,
      todayCount: checkedNow.size,
      streak: streak(nextRecord, date),
      first,
    });
  };

  /** 공유 화면: 9×9 PNG 를 사진첩에 저장. 누른 뒤에만 photos 권한을 묻고, 거부해도 글·링크 공유는 그대로예요. */
  const saveShareImage = async (card: RenderedCard) => {
    setShareBusy(true);
    try {
      const result = await saveImageToPhotos(card.base64, cardFileName(dateKey()));
      if (result === 'saved') {
        logEvent('share_image_save', { hd: false });
        void haptic('success');
        toast.openToast('사진에 저장했어요');
      } else if (result === 'denied') {
        toast.openToast('사진 접근을 허용하면 저장할 수 있어요');
      } else {
        toast.openToast('이미지를 저장하지 못했어요. 잠시 뒤에 다시 해 주세요');
      }
    } finally {
      setShareBusy(false);
    }
  };

  const shareBoardText = async () => {
    logEvent('share_text');
    const result = await shareText(boardToText(board, todaySet(record, dateKey())));
    if (result === 'copied') toast.openToast('글을 복사했어요');
    else if (result === 'failed') toast.openToast('공유하지 못했어요. 잠시 뒤에 다시 해 주세요');
  };

  const shareBoardLink = async () => {
    setShareBusy(true);
    try {
      const link = await createShareLink(OG_IMAGE_URL);
      if (!link) {
        toast.openToast('링크를 만들지 못했어요. 잠시 뒤에 다시 해 주세요');
        return;
      }
      logEvent('share_link');
      const goal = board.goal.trim() || '만다라트';
      const result = await shareText(`[만다라트] ${goal}\n토스 앱에서 만다라트로 목표를 함께 실천해요\n${link}`);
      if (result === 'copied') toast.openToast('링크를 복사했어요');
      else if (result === 'failed') toast.openToast('공유하지 못했어요. 잠시 뒤에 다시 해 주세요');
    } finally {
      setShareBusy(false);
    }
  };

  /**
   * 알림 동의 (홈 행 · 기록 화면(오늘 탭) 버튼 · 설정 행에서 사용자가 누른 뒤에만). 결과를 settings.notification 에 남겨요.
   * 이미 동의한 상태에서 설정 행을 누르면 끄는 길(토스 앱 알림 설정)을 안내해요.
   */
  const askNotification = async (from: 'home' | 'today' | 'settings') => {
    if (state.settings.notification === 'agreed') {
      toast.openToast('알림은 토스 앱의 알림 설정에서 끌 수 있어요');
      return;
    }
    const result = await requestNotificationAgreement();
    if (result === 'agreed' || result === 'alreadyAgreed') {
      app.updateSettings((settings) => ({ ...settings, notification: 'agreed' }));
      logEvent('notification_agree', { result: 'agreed', from });
      toast.openToast(result === 'agreed' ? '매일 저녁 8시에 알림을 보내요' : '이미 알림을 받고 있어요');
    } else if (result === 'declined') {
      app.updateSettings((settings) => ({ ...settings, notification: 'declined' }));
      logEvent('notification_agree', { result: 'declined', from });
      toast.openToast('알림을 받지 않아요. 설정에서 다시 켤 수 있어요');
    } else if (result === 'unsupported') {
      toast.openToast('알림은 토스앱을 업데이트하면 설정할 수 있어요');
    } else {
      toast.openToast('알림을 설정하지 못했어요. 잠시 뒤에 다시 해 주세요');
    }
  };
  const notificationReady = notificationAvailable();
  /** 홈 행·기록 화면(오늘 탭) 버튼은 첫 체크 뒤, 아직 묻지 않았을 때만. 거부했으면 설정에서만 */
  const notificationPrompt = notificationReady && state.settings.firstCheckinAt !== null && state.settings.notification === 'unknown';

  /**
   * 설정 '두 번째 만다라트 판'(잠김): 안내 → 리워드 광고 → userEarnedReward 일 때만 잠금 해제(영구) + 빈 판 추가 → 홈.
   * 광고를 끝까지 안 봤거나 못 불러오면 잠금 그대로.
   */
  const unlockExtraBoard = async () => {
    if (!extraBoardReward.supported) {
      toast.openToast('광고는 토스앱을 업데이트하면 볼 수 있어요');
      return;
    }
    const ok = await openConfirm({
      title: '광고를 보고 두 번째 판을 열까요?',
      description: '광고를 끝까지 보면 만다라트 판을 하나 더 만들 수 있어요. 한 번 열면 계속 쓸 수 있어요.',
      confirmButton: '광고 보기',
      cancelButton: '닫기',
    });
    if (!ok) return;
    setExtraBoardBusy(true);
    try {
      const outcome = await extraBoardReward.watch();
      if (outcome === 'unavailable') {
        toast.openToast('광고를 불러오지 못했어요. 잠시 뒤에 다시 해 주세요');
        return;
      }
      if (outcome === 'dismissed') {
        toast.openToast('광고를 끝까지 보면 두 번째 판을 열 수 있어요');
        return;
      }
      app.updateSettings((settings) => ({ ...settings, unlocks: { ...settings.unlocks, extraBoard: true } }));
      logEvent('reward_unlock', { type: 'extraBoard' });
      if (app.addBoard()) logEvent('board_add', { boards: MAX_BOARDS });
      void haptic('success');
      toast.openToast('두 번째 판을 열었어요');
      navigate({ name: 'home' });
    } finally {
      setExtraBoardBusy(false);
    }
  };

  /** 설정 '두 번째 만다라트 판'(열렸는데 판이 하나): 빈 판을 추가하고 그 판을 보여줘요. */
  const addExtraBoard = () => {
    if (!app.addBoard()) return;
    logEvent('board_add', { boards: MAX_BOARDS });
    toast.openToast('두 번째 판을 만들었어요');
    navigate({ name: 'home' });
  };

  /** 홈 '기록 보기': 오늘 체크가 있고 오늘 아직 안 봤으면 전면 광고(미리 불러온 것만) → 닫히면 today. 광고가 없으면 바로 today. */
  const openToday = async () => {
    if (interstitialReady) {
      setTodayBusy(true);
      try {
        const result = await interstitial.show();
        logEvent('ad_interstitial', { result });
        if (result === 'shown') {
          app.updateSettings((settings) => ({ ...settings, ads: { ...settings.ads, lastInterstitialDate: today } }));
        }
      } finally {
        setTodayBusy(false);
      }
    }
    navigate({ name: 'today' });
  };

  /** 공유 '고화질로 저장': 안내 → 리워드 광고 → userEarnedReward 일 때만 2160×2700(워터마크 없음) 저장. 저장이 실패하면 보상은 남겨 둬요. */
  const saveHdImage = async () => {
    setShareBusy(true);
    try {
      if (!hdCredit.current) {
        const ok = await openConfirm({
          title: '광고를 보고 고화질로 저장할까요?',
          description: '광고를 끝까지 보면 워터마크 없는 2배 크기(2160×2700) 이미지를 사진에 저장해요.',
          confirmButton: '광고 보기',
          cancelButton: '닫기',
        });
        if (!ok) return;
        const outcome = await hdReward.watch();
        if (outcome === 'unavailable') {
          toast.openToast('광고를 불러오지 못했어요. 잠시 뒤에 다시 해 주세요');
          return;
        }
        if (outcome === 'dismissed') {
          toast.openToast('광고를 끝까지 보면 고화질로 저장할 수 있어요');
          return;
        }
        hdCredit.current = true;
        logEvent('reward_unlock', { type: 'hdImage' });
      }
      const card = renderCard({ board, checked: todaySet(record, today), today, streakDays: streak(record, today) }, HD_CARD);
      if (!card) {
        toast.openToast('이미지를 만들지 못했어요. 다시 누르면 광고 없이 저장해요');
        return;
      }
      const result = await saveImageToPhotos(card.base64, cardFileName(today, HD_CARD));
      if (result === 'saved') {
        hdCredit.current = false;
        logEvent('share_image_save', { hd: true });
        void haptic('success');
        toast.openToast('고화질 이미지를 저장했어요');
      } else if (result === 'denied') {
        toast.openToast('사진 접근을 허용한 뒤 다시 누르면 광고 없이 저장해요');
      } else {
        toast.openToast('이미지를 저장하지 못했어요. 다시 누르면 광고 없이 저장해요');
      }
    } finally {
      setShareBusy(false);
    }
  };

  /** 자해·자살 표현: AI 를 부르지 않고 상담전화 안내만(광고도 없음) */
  const showCare = async () => {
    const call = await openConfirm({ title: AI_MESSAGES.careTitle, description: AI_MESSAGES.careBody, confirmButton: AI_MESSAGES.careCall, cancelButton: '닫기' });
    if (call) void openUrl(CARE_PHONE_URL);
  };

  /**
   * 제자리 편집 모드의 여러 칸 지우기(2.1, 홈·세부 목표 화면): 고른 칸의 글을 지우고(상위 목표면 그 아래도 전부), 지운 실천은 오늘 체크에서도 빼요.
   * 돌려주는 함수 = 되돌리기(토스트 버튼). 그 사이 다른 칸을 고치지 않았으면 판을 지우기 전으로, 고쳤으면 지운 칸 글만 되살려요.
   */
  const deleteCells = (block: number, cells: number[]): (() => void) => {
    const state = app.getState();
    if (!state) return () => {};
    const before = state.boards.boards[state.boards.active];
    const result = clearBlockCells(before, block, cells);
    if (result.cleared === 0) return () => {};
    app.clearCells(block, cells);
    const date = dateKey();
    const checksBefore = todayChecked(state.checkins.byBoard[before.id], date);
    const checksAfter = checksBefore.filter((index) => !result.actions.includes(index));
    if (checksAfter.length !== checksBefore.length) app.updateCheckins((checkins) => applyCheckin(checkins, before.id, date, checksAfter, Date.now()));
    logEvent('cells_delete', { count: result.cleared, area: block === CENTER ? 'goals' : 'actions' });
    void haptic('success');
    const sameContent = (a: typeof before, b: typeof before) => JSON.stringify([a.goal, a.subs, a.aiDraft]) === JSON.stringify([b.goal, b.subs, b.aiDraft]);
    return () => {
      app.updateBoard((current) => {
        if (current.id !== before.id) return current;
        if (sameContent(current, result.board)) return before;
        // 그사이 다른 칸을 고쳤으면 지운 칸만(함께 지운 하위 칸 포함), 아직 비어 있을 때 되살려요('AI 초안' 표시는 되살리지 않아요)
        let next = current;
        for (const field of result.fields) {
          if (field.kind === 'goal') {
            if (!next.goal) next = { ...next, goal: before.goal };
          } else if (field.kind === 'sub') {
            const s = field.subIndex;
            if (!next.subs[s].title) next = { ...next, subs: next.subs.map((sub, i) => (i === s ? { ...sub, title: before.subs[s].title } : sub)) };
          } else {
            const { subIndex: s, actionIndex: a } = field;
            if (!next.subs[s].actions[a])
              next = { ...next, subs: next.subs.map((sub, i) => (i === s ? { ...sub, actions: sub.actions.map((t, j) => (j === a ? before.subs[s].actions[a] : t)) } : sub)) };
          }
        }
        return next;
      });
      if (checksAfter.length !== checksBefore.length) app.updateCheckins((checkins) => applyCheckin(checkins, before.id, date, checksBefore, Date.now()));
      logEvent('cells_delete_undo', { count: result.cleared });
    };
  };

  /** 세부 목표 화면 '빈 실천 AI로 채우기'·홈 'AI로 빈 칸 채우기' 결과 안내 */
  const afterFill = async (result: AiResult<number>) => {
    if (result.kind === 'ok') {
      if (result.value > 0) {
        void haptic('success');
        toast.openToast(`빈 칸 ${result.value}개를 AI로 채웠어요`);
      } else {
        toast.openToast('AI가 채운 칸이 없어요. 잠시 뒤에 다시 해 주세요');
      }
      return;
    }
    if (result.kind === 'stopped') {
      if (result.reason === 'self_harm') await showCare();
      else if (result.reason === 'limit') toast.openToast(AI_MESSAGES.limit);
      else if (result.reason === 'dismissed') toast.openToast('광고를 끝까지 보면 AI가 빈 칸을 채워요');
      else if (result.reason === 'no_ad') toast.openToast(`${AI_MESSAGES.noAdTitle}. ${AI_MESSAGES.retryLater}`);
      else if (result.reason === 'key') toast.openToast(AI_MESSAGES.retryLater);
      return;
    }
    if (result.code === 'self_harm') await showCare();
    else if (result.code === 'refused') toast.openToast('이 내용으로는 AI가 채울 수 없어요. 방금 본 광고는 오늘 횟수에서 빼지 않았어요');
    else if (result.code === 'limited') toast.openToast(AI_MESSAGES.serverLimited);
    else toast.openToast(AI_MESSAGES.failBody);
  };

  /**
   * 세부 목표 화면의 '빈 실천 AI로 채우기'(2.1): 핵심 목표·그 세부 목표가 있고 빈 실천이 있을 때만.
   * 빈 세부 목표는 홈의 'AI로 빈 칸 채우기'(초안 화면)로 채워요 — 편집 화면이 없어지며 가운데 블록 채우기 버튼도 없어졌어요.
   */
  const aiFillFor = (subIndex: number) => {
    if (!aiEnabled || !canFillActions(board, subIndex)) return undefined;
    const left = ai.runsLeft;
    return {
      label: '빈 실천 AI로 채우기',
      caption:
        left === 0
          ? AI_MESSAGES.limit
          : AI_MESSAGES.fillCaption(`'${board.subs[subIndex].title.trim()}'의 빈 실천 ${emptyActionCount(board, subIndex)}칸을 채워요.`, left),
      disabled: left === 0 || ai.busy,
      onPress: () => void ai.fillActions(subIndex).then(afterFill),
    };
  };

  /**
   * 홈 'AI로 빈 칸 채우기'(2.1): 핵심 목표가 있고 칸을 일부 채운 판에 빈 칸이 남았을 때만. 초안 화면을 거치지 않고 누르면 바로 광고 → 그 자리에서 빈 칸만 채워요
   * (사용자 2026-10-21 '뎁스가 깊이 들어가는 게 싫어'). 핵심 목표를 바꾸려면 가운데 칸을 고쳐요.
   */
  const aiFillHome = () => {
    if (!aiEnabled || !canFillBoard(board)) return undefined;
    const left = ai.runsLeft;
    return {
      label: 'AI로 빈 칸 채우기',
      caption: left === 0 ? AI_MESSAGES.limit : AI_MESSAGES.fillCaption(`빈 칸 ${emptyCellCount(board)}개만 채우고, 적어 둔 칸은 그대로예요.`, left),
      disabled: left === 0 || ai.busy,
      onPress: () => void ai.fillBoard().then(afterFill),
    };
  };

  /** 홈. editLink = 예전 편집 화면 링크(block/4)로 들어와 편집 모드로 시작 */
  const renderHome = (editLink?: { cell: number | null; onDone: () => void }) => (
    <HomeScreen
      key={editLink ? 'home-edit' : 'home'}
      board={board}
      content={content}
      checkin={record}
      boardCount={state.boards.boards.length}
      activeIndex={state.boards.active}
      notificationVisible={notificationPrompt}
      onSelectSub={openSub}
      onChangeGoal={app.setGoal}
      onChangeSubTitle={app.setSubTitle}
      todayBusy={todayBusy}
      todayAdNotice={interstitial.upcoming}
      onToday={() => void openToday()}
      onOverview={() => navigate({ name: 'overview' })}
      onSettings={() => navigate({ name: 'settings' })}
      onSwitchBoard={openBoardPicker}
      onNotification={() => void askNotification('home')}
      onAiDraft={aiEnabled ? () => navigate({ name: 'draft' }) : undefined}
      aiFill={aiFillHome()}
      aiFilling={ai.boardFilling}
      onDeleteCells={(cells) => deleteCells(CENTER, cells)}
      trialCard={
        showTrialCard
          ? {
              ai: aiEnabled,
              onOpen: () => openTrial('home'),
              onClose: () => {
                logEvent('trial_card_close');
                dismissTrialCard();
              },
            }
          : undefined
      }
      editLink={editLink}
    />
  );

  /** 세부 목표 화면. 세부 목표마다 따로 그려요(편집 모드가 다른 세부 목표로 옮겨 가지 않게) */
  const renderSub = (subIndex: number, editLink?: { cell: number | null; onDone: () => void }) => (
    <SubScreen
      key={`${editLink ? 'sub-edit' : 'sub'}-${subIndex}`}
      board={board}
      subIndex={subIndex}
      checkin={record}
      onToggle={toggleToday}
      onChangeAction={app.setAction}
      onChangeSubTitle={app.setSubTitle}
      aiFill={aiFillFor(subIndex)}
      onDeleteCells={(cells) => deleteCells(cellOfRing(subIndex), cells)}
      editLink={editLink}
    />
  );

  /** 미리보기 '이대로 시작하기': 지금 판의 빈 칸에 넣고 이전 화면(대개 홈)으로 */
  const applyAiDraft = (goal: string, draft: Parameters<typeof ai.applyDraft>[1]) => {
    ai.applyDraft(goal, draft);
    void haptic('success');
    toast.openToast('AI 초안을 넣었어요. 칸을 눌러 고쳐 쓸 수 있어요');
    goBack();
  };

  let view: JSX.Element;
  switch (route.name) {
    case 'sub':
      view = renderSub(route.sub);
      break;
    case 'block': {
      // 예전 편집 화면 링크(콘솔 앱 내 기능 '만다라트 작성' = intoss://mandalartplan/block/4): 편집 화면은 없어지고(2.1),
      // 그 3×3 화면(가운데 = 홈, 둘레 = 세부 목표 화면)을 편집 모드로 열어요. '완료'는 이전 화면, 링크로 바로 들어왔으면 홈
      const editLink = { cell: route.cell ?? null, onDone: goBack };
      view = route.block === CENTER ? renderHome(editLink) : renderSub(ringIndex(route.block), editLink);
      break;
    }
    case 'overview':
      view = <OverviewScreen board={board} checkin={record} onSelectSub={openSub} onShare={() => navigate({ name: 'share' })} />;
      break;
    case 'today':
      view = (
        <TodayScreen
          board={board}
          record={record}
          content={content}
          onNotification={notificationPrompt ? () => void askNotification('today') : undefined}
          onDone={goBack}
          showHome={atHistoryBottom()}
          onStatsView={(info) => logEvent('stats_view', { ...info })}
        />
      );
      break;
    case 'share':
      view = (
        <ShareScreen
          board={board}
          checkin={record}
          canSave={canSaveImage()}
          busy={shareBusy}
          onSaveImage={(card) => void saveShareImage(card)}
          onSaveHd={hdReward.supported ? () => void saveHdImage() : undefined}
          onShareText={() => void shareBoardText()}
          onShareLink={() => void shareBoardLink()}
          onDone={goBack}
        />
      );
      break;
    case 'settings':
      view = (
        <SettingsScreen
          content={content}
          notification={state.settings.notification}
          notificationAvailable={notificationReady}
          onNotification={() => void askNotification('settings')}
          hasAnyText={state.boards.boards.some((b) => getProgress(b).filled > 0)}
          extraBoard={{
            unlocked: extraBoardOpen,
            count: state.boards.boards.length,
            busy: extraBoardBusy,
            onUnlock: () => void unlockExtraBoard(),
            onAdd: addExtraBoard,
          }}
          backup={{
            configured: backup.configured,
            enabled: backup.enabled,
            busy: backup.busy,
            lastBackupAt: backup.lastBackupAt,
            onEnable: () => void enableBackup(),
            onBackupNow: () => void backupNow(),
            onRestore: () => void restoreBackup(),
            onDisable: () => void disableBackup(),
          }}
          onTrial={() => openTrial('settings')}
          onReset={() => void resetAll()}
        />
      );
      break;
    case 'trial':
      view = (
        <TrialScreen
          content={content}
          aiAvailable={aiEnabled}
          fresh={getProgress(board).actionsFilled === 0}
          onFinish={(steps) => {
            logEvent('trial_finish', { steps });
            // 끝까지 해 봤으면 홈 맨 위 안내 카드는 거둬요
            dismissTrialCard();
            goBack();
          }}
        />
      );
      break;
    case 'draft':
      view = (
        <DraftScreen
          board={board}
          runsLeft={ai.runsLeft}
          onGenerate={(goal, hooks) => ai.runDraft(goal, board, hooks)}
          onApply={applyAiDraft}
        />
      );
      break;
    default:
      view = renderHome();
  }
  // 생성형 AI 고지 시트는 어느 화면에서 AI 를 눌러도 같은 것 하나
  return (
    <>
      {view}
      {ai.noticeSheet}
    </>
  );
}

export default App;
