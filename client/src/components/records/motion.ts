/**
 * 기록 화면의 차오르는 움직임(3.0, 사용자 2026-10-21 '그래프가 빨리 차다가 끝에 가까워지면 천천히 꽉 차는 액션',
 * '도장이 없다가 월요일부터 차례로 찍히는 느낌'). CSS 쪽은 records.css '차오르는 움직임'.
 * 동작 줄이기(prefers-reduced-motion)면 움직이지 않고 끝 모습만 보여요. 테스트(vitest)에서도 끝 모습만.
 */
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties } from 'react';

import { haptic } from '../../lib/bridge';

/** false 면 이 안의 숫자·그림은 움직이지 않고 끝 모습으로(판 편집 모드를 오가며 다시 그릴 때) */
export const MotionContext = createContext(true);

/** 움직여도 되는지: 동작 줄이기가 아니고 테스트가 아닐 때 */
export function motionAllowed(): boolean {
  if (import.meta.env.MODE === 'test') return false;
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

/** 빨리 차다가 끝에서 천천히(ease-out quart) */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/**
 * 숫자가 지금 값에서 target 까지 차올라요(처음엔 0 부터). 값이 바뀌면 보이던 값에서 새 값으로.
 * 정수만 다뤄요(도장·일·점수).
 */
export function useCountUp(target: number, { duration = 900, delay = 0 }: { duration?: number; delay?: number } = {}): number {
  const enabled = useContext(MotionContext) && motionAllowed();
  const [shown, setShown] = useState(() => (enabled ? 0 : target));
  const shownRef = useRef(shown);
  shownRef.current = shown;
  useEffect(() => {
    if (!enabled) {
      setShown(target);
      return;
    }
    const from = shownRef.current;
    if (from === target) return;
    let frame = 0;
    let start: number | null = null;
    const timer = window.setTimeout(() => {
      const tick = (now: number) => {
        start ??= now;
        const t = Math.min(1, (now - start) / duration);
        setShown(Math.round(from + (target - from) * easeOut(t)));
        if (t < 1) frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
    };
  }, [target, enabled, duration, delay]);
  return shown;
}

/**
 * 차례로 하나씩: delay 뒤 interval 마다 1씩 count 까지(지난주 리포트 도장 — 월요일부터 하나씩 찍혀요).
 * 하나 찍힐 때마다 onStep(번호). 움직이지 않으면 바로 count.
 */
export function useStepper(count: number, { interval = 150, delay = 300, onStep }: { interval?: number; delay?: number; onStep?: (index: number) => void } = {}): number {
  const enabled = motionAllowed();
  const [step, setStep] = useState(() => (enabled ? 0 : count));
  const latest = useRef(onStep);
  latest.current = onStep;
  useEffect(() => {
    if (!enabled) {
      setStep(count);
      return;
    }
    setStep(0);
    const timers: number[] = [];
    for (let i = 0; i < count; i += 1) {
      timers.push(
        window.setTimeout(() => {
          setStep(i + 1);
          latest.current?.(i);
        }, delay + i * interval),
      );
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [count, enabled, interval, delay]);
  return step;
}

/** 차례로 시작하게 animation-delay 를 줘요 */
export function stagger(index: number, step: number, base = 0): CSSProperties {
  return { animationDelay: `${base + index * step}ms` };
}

/** 도장이 찍힐 때 손끝에 톡(움직일 때만) */
export function stampTick(): void {
  if (motionAllowed()) void haptic('tickWeak');
}
