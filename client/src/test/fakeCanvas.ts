/** 캔버스 2D 를 흉내 내는 가짜 컨텍스트. 그린 글을 모아 두고 measureText 는 글자 수 × 10 으로 쳐요. */
export function fakeCanvasContext() {
  const calls = { fillText: [] as string[], fillRect: 0 };
  const noop = () => {};
  const ctx = {
    save: noop,
    restore: noop,
    scale: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arcTo: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    fillRect() {
      calls.fillRect += 1;
    },
    fillText(text: string) {
      calls.fillText.push(text);
    },
    measureText: (text: string) => ({ width: text.length * 10 }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    font: '',
    textAlign: '',
    textBaseline: '',
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}
