import { useCountUp } from './motion';

/** 0(또는 지금 보이던 값)에서 value 까지 차오르는 숫자. format 으로 '19개'·'9일째'처럼 */
export function CountUp({ value, format = String, duration, delay }: { value: number; format?: (n: number) => string; duration?: number; delay?: number }) {
  const shown = useCountUp(value, { duration, delay });
  return <>{format(shown)}</>;
}
