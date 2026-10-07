import { useDialog, useToast } from '@toss/tds-mobile';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AD_GROUPS } from './ads/config';
import { interstitialEligible } from './ads/rules';
import { useInterstitial } from './ads/useInterstitial';
import { useRewardedAd } from './ads/useRewardedAd';
import { OG_IMAGE_URL, fetchRemoteContent, getBundledContent, type Content, type ContentTemplate } from './content';
import { BackupApiError } from './backup/api';
import { BackupKeyError } from './backup/key';
import { cellsFilled } from './backup/payload';
import { useBackup } from './backup/useBackup';
import { useAppState } from './hooks/useAppState';
import { useBoardPicker } from './hooks/useBoardPicker';
import { useTemplatePicker } from './hooks/useTemplatePicker';
import { canSaveImage, createShareLink, haptic, saveImageToPhotos, shareText } from './lib/bridge';
import { HD_CARD, cardFileName, renderCard, type RenderedCard } from './lib/card';
import { notificationAvailable, requestNotificationAgreement } from './notification/agreement';
import { todaySet, toggleCheck } from './lib/checkin';
import { CENTER, boardToText, cellOfRing, getProgress } from './lib/mandalart';
import { formatDateTime } from './lib/format';
import { goBack, navigate, useRoute } from './lib/router';
import { MAX_BOARDS, dateKey, streak, type BoardsState } from './lib/state';
import { BlockScreen } from './screens/BlockScreen';
import { HomeScreen } from './screens/HomeScreen';
import { OverviewScreen } from './screens/OverviewScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ShareScreen } from './screens/ShareScreen';
import { SubScreen } from './screens/SubScreen';
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
  /** 전면 광고가 뜨는 동안 홈 '오늘 기록 보기' 잠금 */
  const [todayBusy, setTodayBusy] = useState(false);
  /** 두 번째 판 리워드 광고가 뜨는 동안 설정 행 잠금 */
  const [extraBoardBusy, setExtraBoardBusy] = useState(false);
  /** 리워드 광고를 끝까지 봤지만 아직 저장하지 못한 고화질 1회분 (권한 거부 등으로 실패하면 광고를 다시 보지 않게) */
  const hdCredit = useRef(false);
  const { openConfirm } = useDialog();
  const toast = useToast();

  /** 예시 템플릿 적용. 이미 적은 글이 있으면 덮어쓸지 먼저 물어요. */
  const pickTemplate = useCallback(
    async (template: ContentTemplate) => {
      const current = app.board;
      if (!current) return;
      if (getProgress(current).filled > 0) {
        const ok = await openConfirm({
          title: '예시로 바꿀까요?',
          description: '지금 적은 내용과 오늘 체크 기록이 예시 내용으로 바뀌어요.',
          confirmButton: '바꾸기',
          cancelButton: '닫기',
        });
        if (!ok) return;
      }
      app.applyTemplate(template);
      toast.openToast(`${template.title} 예시를 넣었어요`);
      navigate({ name: 'home' });
    },
    [app, openConfirm, toast],
  );
  const openTemplatePicker = useTemplatePicker(content, pickTemplate);

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
  const extraBoardReward = useRewardedAd(AD_GROUPS.rewardedExtraBoard, route.name === 'settings' && !extraBoardOpen);
  const switchBoard = useCallback(
    (index: number) => {
      app.setActiveBoard(index);
      void haptic('tap');
    },
    [app],
  );
  const openBoardPicker = useBoardPicker(app.state?.boards ?? NO_BOARDS, switchBoard);
  const backupErrorToast = useCallback(
    (error: unknown) => {
      if (error instanceof BackupKeyError) toast.openToast(error.message);
      else if (error instanceof BackupApiError) toast.openToast('지금은 서버에 연결할 수 없어요');
      else toast.openToast('지금은 백업할 수 없어요');
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
        toast.openToast('서버에 백업이 없어요');
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

  const { state, board } = app;
  // 저장된 상태를 읽는 동안(수십 ms)은 빈 화면. 번들 안에서 끝나는 일이라 로더는 두지 않아요.
  if (!state || !board) return null;

  const record = state.checkins.byBoard[board.id];
  const editCore = () => navigate({ name: 'block', block: CENTER });
  const openSub = (subIndex: number) => navigate({ name: 'sub', sub: subIndex });

  /** 실천 칸 탭 = 오늘 했어요 체크/해제. 처음 체크한 순간을 settings 에 남겨요(알림 안내용). */
  const toggleToday = (actionIndex: number) => {
    const now = Date.now();
    void haptic('tap');
    app.updateCheckins((checkins) => toggleCheck(checkins, board.id, dateKey(), actionIndex, now));
    if (state.settings.firstCheckinAt === null) {
      app.updateSettings((settings) => ({ ...settings, firstCheckinAt: now }));
    }
  };

  /** 공유 화면: 9×9 PNG 를 사진첩에 저장. 누른 뒤에만 photos 권한을 묻고, 거부해도 글·링크 공유는 그대로예요. */
  const saveShareImage = async (card: RenderedCard) => {
    setShareBusy(true);
    try {
      const result = await saveImageToPhotos(card.base64, cardFileName(dateKey()));
      if (result === 'saved') {
        void haptic('success');
        toast.openToast('사진에 저장했어요');
      } else if (result === 'denied') {
        toast.openToast('사진 접근을 허용하면 저장할 수 있어요');
      } else {
        toast.openToast('지금은 이미지를 저장할 수 없어요');
      }
    } finally {
      setShareBusy(false);
    }
  };

  const shareBoardText = async () => {
    const result = await shareText(boardToText(board, todaySet(record, dateKey())));
    if (result === 'copied') toast.openToast('글을 복사했어요');
    else if (result === 'failed') toast.openToast('지금은 공유할 수 없어요');
  };

  const shareBoardLink = async () => {
    setShareBusy(true);
    try {
      const link = await createShareLink(OG_IMAGE_URL);
      if (!link) {
        toast.openToast('지금은 링크를 만들 수 없어요');
        return;
      }
      const goal = board.goal.trim() || '만다라트';
      const result = await shareText(`[만다라트] ${goal}\n토스 앱에서 만다라트로 목표를 함께 실천해요\n${link}`);
      if (result === 'copied') toast.openToast('링크를 복사했어요');
      else if (result === 'failed') toast.openToast('지금은 공유할 수 없어요');
    } finally {
      setShareBusy(false);
    }
  };

  /**
   * 알림 동의 (홈 행 · 오늘 기록 버튼 · 설정 행에서 사용자가 누른 뒤에만). 결과를 settings.notification 에 남겨요.
   * 이미 동의한 상태에서 설정 행을 누르면 끄는 길(토스 앱 알림 설정)을 안내해요.
   */
  const askNotification = async () => {
    if (state.settings.notification === 'agreed') {
      toast.openToast('알림은 토스 앱의 알림 설정에서 끌 수 있어요');
      return;
    }
    const result = await requestNotificationAgreement();
    if (result === 'agreed' || result === 'alreadyAgreed') {
      app.updateSettings((settings) => ({ ...settings, notification: 'agreed' }));
      toast.openToast(result === 'agreed' ? '매일 저녁 9시에 알림을 보내요' : '이미 알림을 받고 있어요');
    } else if (result === 'declined') {
      app.updateSettings((settings) => ({ ...settings, notification: 'declined' }));
      toast.openToast('알림을 받지 않아요. 설정에서 다시 켤 수 있어요');
    } else if (result === 'unsupported') {
      toast.openToast('알림은 토스앱을 업데이트하면 설정할 수 있어요');
    } else {
      toast.openToast('지금은 알림을 설정할 수 없어요');
    }
  };
  const notificationReady = notificationAvailable();
  /** 홈 행·오늘 기록 버튼은 첫 체크 뒤, 아직 묻지 않았을 때만. 거부했으면 설정에서만 */
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
        toast.openToast('지금은 광고를 불러올 수 없어요');
        return;
      }
      if (outcome === 'dismissed') {
        toast.openToast('광고를 끝까지 보면 두 번째 판을 열 수 있어요');
        return;
      }
      app.updateSettings((settings) => ({ ...settings, unlocks: { ...settings.unlocks, extraBoard: true } }));
      app.addBoard();
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
    toast.openToast('두 번째 판을 만들었어요');
    navigate({ name: 'home' });
  };

  /** 홈 '오늘 기록 보기': 오늘 체크가 있고 오늘 아직 안 봤으면 전면 광고(미리 불러온 것만) → 닫히면 today. 광고가 없으면 바로 today. */
  const openToday = async () => {
    if (interstitialReady) {
      setTodayBusy(true);
      try {
        const result = await interstitial.show();
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
          toast.openToast('지금은 광고를 불러올 수 없어요');
          return;
        }
        if (outcome === 'dismissed') {
          toast.openToast('광고를 끝까지 보면 고화질로 저장할 수 있어요');
          return;
        }
        hdCredit.current = true;
      }
      const card = renderCard({ board, checked: todaySet(record, today), today, streakDays: streak(record, today) }, HD_CARD);
      if (!card) {
        toast.openToast('지금은 이미지를 만들 수 없어요. 광고를 다시 보지 않아도 돼요');
        return;
      }
      const result = await saveImageToPhotos(card.base64, cardFileName(today, HD_CARD));
      if (result === 'saved') {
        hdCredit.current = false;
        void haptic('success');
        toast.openToast('고화질 이미지를 저장했어요');
      } else if (result === 'denied') {
        toast.openToast('사진 접근을 허용하면 저장할 수 있어요. 광고를 다시 보지 않아도 돼요');
      } else {
        toast.openToast('지금은 이미지를 저장할 수 없어요. 광고를 다시 보지 않아도 돼요');
      }
    } finally {
      setShareBusy(false);
    }
  };

  switch (route.name) {
    case 'sub':
      return (
        <SubScreen
          board={board}
          subIndex={route.sub}
          checkin={record}
          onToggle={toggleToday}
          onEdit={() => navigate({ name: 'block', block: cellOfRing(route.sub) })}
        />
      );
    case 'block':
      return (
        <BlockScreen
          board={board}
          block={route.block}
          onChangeGoal={app.setGoal}
          onChangeSubTitle={app.setSubTitle}
          onChangeAction={app.setAction}
          onDone={goBack}
        />
      );
    case 'overview':
      return <OverviewScreen board={board} checkin={record} onSelectSub={openSub} onEditCore={editCore} />;
    case 'today':
      return (
        <TodayScreen
          board={board}
          record={record}
          content={content}
          onNotification={notificationPrompt ? () => void askNotification() : undefined}
          onDone={goBack}
        />
      );
    case 'share':
      return (
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
    case 'settings':
      return (
        <SettingsScreen
          content={content}
          notification={state.settings.notification}
          notificationAvailable={notificationReady}
          onNotification={() => void askNotification()}
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
          onPickTemplate={openTemplatePicker}
          onReset={() => void resetAll()}
        />
      );
    default:
      return (
        <HomeScreen
          board={board}
          content={content}
          checkin={record}
          boardCount={state.boards.boards.length}
          activeIndex={state.boards.active}
          notificationVisible={notificationPrompt}
          onEditCore={editCore}
          onSelectSub={openSub}
          todayBusy={todayBusy}
          onToday={() => void openToday()}
          onOverview={() => navigate({ name: 'overview' })}
          onShare={() => navigate({ name: 'share' })}
          onSettings={() => navigate({ name: 'settings' })}
          onSwitchBoard={openBoardPicker}
          onNotification={() => void askNotification()}
          onStartWithTemplate={openTemplatePicker}
        />
      );
  }
}

export default App;
