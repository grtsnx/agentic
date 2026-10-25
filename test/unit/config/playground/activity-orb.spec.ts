import { runInNewContext } from 'node:vm';
import { ACTIVITY_INDICATOR_APP } from '@/config/playground/activity-indicator.asset.js';

async function setup(reducedMotion = false) {
  const visibility = new EventTarget();
  const document = Object.assign(visibility, {
    hidden: false,
    documentElement: { dataset: {} as Record<string, string> },
  });
  const media = Object.assign(new EventTarget(), { matches: reducedMotion });
  const frames = new Map<number, () => void>();
  let nextId = 0;
  let intersect: (
    entries: Array<{ isIntersecting: boolean }>,
  ) => void = () => {};
  let themeChanged = () => {};
  const disconnect = vi.fn();
  const canvas = {
    width: 0,
    height: 0,
    dataset: {},
    getContext: () => ({ setTransform: vi.fn(), clearRect: vi.fn() }),
  };
  const engine = {
    resolvePreset: vi.fn(() => ({ mode: 'test', speed: 1, opts: {} })),
    MODE_FRAMES: { test: vi.fn(() => ({ dots: [], lines: [] })) },
    paintFrame: vi.fn(),
  };
  const factory = runInNewContext(
    ACTIVITY_INDICATOR_APP + '\ncreateActivityOrb;',
    {
      document,
      matchMedia: () => media,
      devicePixelRatio: 3,
      performance: { now: () => 1000 },
      requestAnimationFrame: (callback: () => void) => {
        frames.set(++nextId, callback);
        return nextId;
      },
      cancelAnimationFrame: (id: number) => frames.delete(id),
      IntersectionObserver: class {
        constructor(callback: typeof intersect) {
          intersect = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
      MutationObserver: class {
        constructor(callback: () => void) {
          themeChanged = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    },
  ) as (
    canvas: unknown,
    load: () => Promise<unknown>,
  ) => {
    setState: (state: string) => void;
    setVisible: (visible: boolean) => void;
    dispose: () => void;
  };
  const orb = factory(canvas, async () => engine);
  await Promise.resolve();
  await Promise.resolve();
  return {
    orb,
    engine,
    canvas,
    document,
    media,
    frames,
    disconnect,
    intersect: (visible: boolean) => intersect([{ isIntersecting: visible }]),
    themeChanged,
  };
}

describe('Thinking Orbs lifecycle', () => {
  it('uses the real preset contract and stops rendering while hidden or disposed', async () => {
    const ui = await setup();
    ui.orb.setState('searching');
    ui.orb.setVisible(true);
    expect(ui.engine.resolvePreset).toHaveBeenLastCalledWith('searching', 20);
    expect(ui.canvas.width).toBe(40);
    expect(ui.frames.size).toBe(1);
    ui.orb.setVisible(false);
    expect(ui.frames.size).toBe(0);
    ui.orb.setVisible(true);
    ui.intersect(false);
    expect(ui.frames.size).toBe(0);
    ui.intersect(true);
    expect(ui.frames.size).toBe(1);
    ui.document.hidden = true;
    ui.document.dispatchEvent(new Event('visibilitychange'));
    expect(ui.frames.size).toBe(0);
    ui.document.hidden = false;
    ui.document.dispatchEvent(new Event('visibilitychange'));
    expect(ui.frames.size).toBe(1);
    ui.orb.dispose();
    expect(ui.frames.size).toBe(0);
    expect(ui.disconnect).toHaveBeenCalledTimes(2);
    const paints = ui.engine.paintFrame.mock.calls.length;
    ui.document.dispatchEvent(new Event('visibilitychange'));
    ui.themeChanged();
    expect(ui.engine.paintFrame).toHaveBeenCalledTimes(paints);
  });

  it('draws one static frame for reduced motion and repaints when the theme changes', async () => {
    const ui = await setup(true);
    ui.orb.setVisible(true);
    expect(ui.frames.size).toBe(0);
    expect(ui.engine.MODE_FRAMES.test).toHaveBeenLastCalledWith(20, 0.6, {});
    ui.document.documentElement.dataset.theme = 'dark';
    ui.themeChanged();
    expect(ui.engine.paintFrame.mock.calls.at(-1)?.[2]).toBe(true);
    ui.orb.dispose();
  });
});
