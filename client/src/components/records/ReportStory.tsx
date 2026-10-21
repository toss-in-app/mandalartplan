import { colors } from '@toss/tds-colors';
import { useState } from 'react';

import { AD_GROUPS } from '../../ads/config';
import { CENTER, ringIndex, type Board } from '../../lib/mandalart';
import { subTitle, type WeekReport } from '../../lib/records';
import { WEEKDAY_LABELS } from '../../lib/stats';
import { brandColor, shade, withAlpha } from '../../theme';
import { AdBanner } from '../AdBanner';
import { reportText } from './shared';

/** 스토리 바탕: 브랜드 색을 어둡게(흰 글자 대비 7:1 이상) */
const STORY_BG = shade(brandColor, 0.35);
const PAGES = 4;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <p style={{ margin: 0, display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
      <span style={{ color: withAlpha('#ffffff', 0.8) }}>{label}</span>
      <b>{value}</b>
    </p>
  );
}

function Page({ board, report, page, onShare }: { board: Board; report: WeekReport; page: number; onShare: () => void }) {
  if (page === 0) {
    const diff = report.checks - report.previousChecks;
    return (
      <>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: withAlpha('#ffffff', 0.85) }}>지난주에</p>
        <p style={{ margin: '6px 0 0', fontSize: 52, lineHeight: '60px', fontWeight: 700 }}>도장 {report.checks}개</p>
        <p style={{ margin: '6px 0 0', fontSize: 20, fontWeight: 600, color: withAlpha('#ffffff', 0.85) }}>를 찍었어요</p>
        <div
          role="img"
          aria-label={`요일마다 도장: ${report.daily.map((n, i) => `${WEEKDAY_LABELS[i]} ${n}`).join(', ')}`}
          style={{ marginTop: 36, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, justifyItems: 'center' }}
        >
          {report.daily.map((n, i) => (
            <span key={i} aria-hidden style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 36,
                  height: 36,
                  boxSizing: 'border-box',
                  borderRadius: '50%',
                  border: n > 0 ? '2.5px solid #ffffff' : `2px dashed ${withAlpha('#ffffff', 0.4)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {n > 0 ? n : ''}
              </span>
              <span style={{ fontSize: 12, color: withAlpha('#ffffff', 0.8) }}>{WEEKDAY_LABELS[i]}</span>
            </span>
          ))}
        </div>
        <div style={{ marginTop: 36, padding: 18, borderRadius: 18, background: withAlpha('#ffffff', 0.12), display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Stat label="실천한 날" value={report.activeDays === 7 ? '7일 모두' : `${report.activeDays}일`} />
          {report.previousKnown && <Stat label="그 전 주보다" value={diff > 0 ? `${diff}개 더` : diff < 0 ? `${-diff}개 덜` : '같아요'} />}
          <Stat label="손댄 세부 목표" value={report.subsTouched === 8 ? '8개 모두' : `${report.subsTouched}개`} />
        </div>
      </>
    );
  }
  if (page === 1) {
    return (
      <>
        <p style={{ margin: 0, fontSize: 26, lineHeight: '36px', fontWeight: 700 }}>가장 많이 한 실천</p>
        <ol style={{ margin: '28px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {report.top.map((a, i) => (
            <li key={a.index} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 10, alignItems: 'center', padding: '16px 18px', borderRadius: 16, background: withAlpha('#ffffff', i === 0 ? 0.2 : 0.1), fontSize: 17 }}>
              <b>{i + 1}</b>
              <span style={{ minWidth: 0, wordBreak: 'keep-all' }}>{a.text}</span>
              <b>{a.count}번</b>
            </li>
          ))}
        </ol>
      </>
    );
  }
  if (page === 2) {
    const steadiest = report.subDays.reduce((best, d, s) => (d > report.subDays[best] ? s : best), 0);
    return (
      <>
        <p style={{ margin: 0, fontSize: 26, lineHeight: '36px', fontWeight: 700 }}>가지별로 보면</p>
        <div
          role="img"
          aria-label={`세부 목표마다 도장을 찍은 날: ${report.subDays.map((d, s) => `${subTitle(board, s)} ${d}일`).join(', ')}`}
          style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}
        >
          {Array.from({ length: 9 }, (_, cell) => {
            if (cell === CENTER) {
              return (
                <span key={cell} aria-hidden style={{ minHeight: 88, borderRadius: 12, background: '#ffffff', color: STORY_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, textAlign: 'center', fontSize: 13, fontWeight: 700, wordBreak: 'keep-all' }}>
                  {board.goal.trim() || '핵심 목표'}
                </span>
              );
            }
            const s = ringIndex(cell);
            const d = report.subDays[s];
            return (
              <span
                key={cell}
                aria-hidden
                style={{ minHeight: 88, borderRadius: 12, background: withAlpha('#ffffff', 0.08 + (d / 7) * 0.4), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6, textAlign: 'center', wordBreak: 'keep-all' }}
              >
                <span style={{ fontSize: 13, fontWeight: 700 }}>{subTitle(board, s)}</span>
                <span style={{ fontSize: 12, color: withAlpha('#ffffff', 0.85) }}>{d}일</span>
              </span>
            );
          })}
        </div>
        <p style={{ margin: '24px 0 0', fontSize: 18, lineHeight: '26px', fontWeight: 600, wordBreak: 'keep-all' }}>
          가장 꾸준한 가지는 {subTitle(board, steadiest)}, {report.subDays[steadiest]}일이에요
        </p>
      </>
    );
  }
  return (
    <>
      <p style={{ margin: 0, fontSize: 26, lineHeight: '36px', fontWeight: 700 }}>이번 주도 이어 가요</p>
      <p style={{ margin: '10px 0 0', fontSize: 16, lineHeight: '24px', color: withAlpha('#ffffff', 0.85) }}>지난주 기록을 글로 남기거나 보낼 수 있어요</p>
      <button
        type="button"
        onClick={onShare}
        style={{ marginTop: 28, width: '100%', height: 52, border: 0, borderRadius: 14, background: '#ffffff', color: STORY_BG, font: 'inherit', fontSize: 17, fontWeight: 700, cursor: 'pointer' }}
      >
        글로 공유하기
      </button>
      <div data-interactive style={{ marginTop: 28, borderRadius: 12, overflow: 'hidden' }}>
        <AdBanner adGroupId={AD_GROUPS.bannerToday} />
      </div>
    </>
  );
}

/**
 * 지난주 리포트(F1, 3.0): 전체 화면 4장 — 도장 수 · 많이 한 실천 · 가지별 · 이어 가요(글로 공유 + 배너).
 * 왼쪽 1/3 을 누르면 앞 장, 나머지를 누르면 다음 장. ✕ 는 판으로. 이미지 카드 공유는 다음 버전 후보(설계 문서).
 */
export function ReportStory({ board, report, onClose, onShare }: { board: Board; report: WeekReport; onClose: () => void; onShare: (text: string) => void }) {
  const [page, setPage] = useState(0);
  return (
    <div className="rc-story" style={{ background: STORY_BG }}>
      <div className="rc-story-bars" role="img" aria-label={`${PAGES}장 중 ${page + 1}장`}>
        {Array.from({ length: PAGES }, (_, i) => (
          <i key={i} style={{ background: i <= page ? '#ffffff' : withAlpha('#ffffff', 0.35) }} />
        ))}
      </div>
      <div style={{ padding: '8px 8px 0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: withAlpha('#ffffff', 0.85) }}>지난주 리포트 · {report.range.label}</span>
        <button type="button" aria-label="리포트 닫기" onClick={onClose} style={{ width: 44, height: 44, border: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.white} strokeWidth={2.2} strokeLinecap="round" aria-hidden focusable="false">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="rc-story-taps">
        <button type="button" aria-label="이전 장" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} />
        <button type="button" aria-label="다음 장" disabled={page === PAGES - 1} onClick={() => setPage((p) => Math.min(PAGES - 1, p + 1))} />
      </div>
      <div className="rc-story-body" aria-live="polite">
        <Page board={board} report={report} page={page} onShare={() => onShare(reportText(board, report))} />
      </div>
    </div>
  );
}
