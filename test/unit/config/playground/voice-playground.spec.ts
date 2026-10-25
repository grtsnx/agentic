import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIVEKIT_BROWSER_APP } from '@/config/playground/voice-playground.asset.js';
import { VOICE_AURA_FACTORY } from '@/config/playground/voice-aura.asset.js';

class Element extends EventEmitter {
  hidden = false;
  disabled = false;
  inert = false;
  textContent = '';
  className = '';
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  attributes: Record<string, string> = {};
  children: Element[] = [];
  scrollHeight = 0;
  scrollTop = 0;
  clientHeight = 100;
  classList = { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() };
  focus = vi.fn();
  remove = vi.fn();
  addEventListener = this.on;
  setAttribute(key: string, value: string) {
    this.attributes[key] = value;
  }
  append(...elements: Element[]) {
    this.children.push(...elements);
  }
  replaceChildren(...elements: Element[]) {
    this.children = elements;
  }
  querySelectorAll() {
    return this.children;
  }
}

function setup() {
  vi.useFakeTimers();
  const elements = new Map<string, Element>();
  const query = (selector: string) => {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector)!;
  };
  const element = (name: string) => query('#voice-' + name);
  element('session').hidden = true;
  const frames = new Map<number, () => void>();
  let nextFrame = 0;
  const aura = Object.fromEntries(
    [
      'setState',
      'setParticipants',
      'addTrack',
      'removeTrack',
      'start',
      'stop',
      'reset',
      'prepareAudio',
    ].map((name) => [name, vi.fn()]),
  );
  const agent = {
    identity: 'agent',
    isAgent: true,
    isSpeaking: false,
    audioLevel: 0,
    attributes: { 'lk.agent.state': 'listening' },
    audioTrackPublications: new Map(),
  };
  const local = {
    identity: 'user',
    isAgent: false,
    isSpeaking: false,
    isMicrophoneEnabled: false,
    getTrackPublication: vi.fn(),
    setMicrophoneEnabled: vi.fn(async (enabled: boolean) => {
      local.isMicrophoneEnabled = enabled;
    }),
  };
  const room = Object.assign(new EventEmitter(), {
    localParticipant: local,
    remoteParticipants: new Map([['agent', agent]]),
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    startAudio: vi.fn(async () => {}),
    canPlaybackAudio: true,
  });
  const events = new Proxy({}, { get: (_, key) => key });
  const fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      serverUrl: 'wss://test.invalid',
      participantToken: 'test-token',
    }),
  }));
  const dispatch = vi.fn();
  runInNewContext(
    LIVEKIT_BROWSER_APP.replace(
      VOICE_AURA_FACTORY,
      'function createAudioReactiveAura() { return fakeAura; }',
    ),
    {
      fakeAura: aura,
      document: {
        querySelector: query,
        createElement: () => new Element(),
        body: new Element(),
        dispatchEvent: dispatch,
      },
      window: { addEventListener: vi.fn() },
      LivekitClient: {
        Room: function () {
          return room;
        },
        RoomEvent: events,
        Track: {
          Source: { Microphone: 'microphone' },
          Kind: { Audio: 'audio' },
        },
      },
      fetch,
      AbortController,
      performance,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      requestAnimationFrame: (callback: () => void) => {
        frames.set(++nextFrame, callback);
        return nextFrame;
      },
      cancelAnimationFrame: (id: number) => frames.delete(id),
      CustomEvent: class {
        constructor(
          public type: string,
          public detail: unknown,
        ) {}
      },
    },
  );
  const settle = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  };
  const click = async (name: string) => {
    element(name).emit('click');
    await settle();
  };
  const start = async () => {
    await click('connect');
    await click('start');
  };
  const flush = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback());
  };
  return {
    element,
    query,
    aura,
    agent,
    local,
    room,
    fetch,
    dispatch,
    click,
    start,
    flush,
    settle,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('voice playground lifecycle', () => {
  it('opens without recording, then preserves an agent already speaking during connection', async () => {
    const ui = setup();
    await ui.click('connect');
    expect(ui.element('session').hidden).toBe(false);
    expect(ui.fetch).not.toHaveBeenCalled();
    expect(ui.local.setMicrophoneEnabled).not.toHaveBeenCalled();
    ui.room.connect.mockImplementation(async () => {
      ui.agent.attributes['lk.agent.state'] = 'speaking';
      ui.room.emit('ParticipantAttributesChanged', {}, ui.agent);
    });
    await ui.click('start');
    expect(ui.element('session').dataset.state).toBe('agent-speaking');
    expect(ui.local.setMicrophoneEnabled).toHaveBeenCalledWith(true);
  });

  it('ignores other remote speakers and preserves local speech over late agent attributes', async () => {
    const ui = setup();
    await ui.start();
    ui.room.emit('ActiveSpeakersChanged', [
      { identity: 'other-human', isAgent: false },
    ]);
    expect(ui.element('session').dataset.state).toBe('listening');
    ui.room.emit('ActiveSpeakersChanged', [ui.local]);
    ui.agent.attributes['lk.agent.state'] = 'thinking';
    ui.room.emit('ParticipantAttributesChanged', {}, ui.agent);
    expect(ui.element('session').dataset.state).toBe('user-speaking');
    ui.room.emit('ActiveSpeakersChanged', []);
    expect(ui.element('session').dataset.state).toBe('thinking');
    await ui.click('mute');
    expect(ui.element('session').dataset.state).toBe('muted');
    ui.agent.attributes['lk.agent.state'] = 'speaking';
    ui.room.emit('ParticipantAttributesChanged', {}, ui.agent);
    expect(ui.element('session').dataset.state).toBe('agent-speaking');
  });

  it('separates transcript segment IDs by participant and ignores bystanders', async () => {
    const ui = setup();
    await ui.start();
    const segment = { id: 'same-id', text: 'Hello', final: true };
    ui.room.emit('TranscriptionReceived', [segment], ui.local);
    ui.room.emit(
      'TranscriptionReceived',
      [{ ...segment, text: 'Hi there' }],
      ui.agent,
    );
    ui.room.emit('TranscriptionReceived', [segment], {
      identity: 'other',
      isAgent: false,
    });
    ui.flush();
    expect(ui.element('transcript').children).toHaveLength(2);
    expect(ui.dispatch).toHaveBeenCalledTimes(2);
    ui.room.emit('TranscriptionReceived', [segment], ui.local);
    ui.flush();
    expect(ui.dispatch).toHaveBeenCalledTimes(2);
  });

  it('does not publish a microphone when a pending connection is cancelled', async () => {
    const ui = setup();
    let finish!: () => void;
    ui.room.connect.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await ui.start();
    await ui.click('back');
    finish();
    await ui.settle();
    expect(ui.element('session').hidden).toBe(true);
    expect(ui.query('.app-shell').inert).toBe(false);
    expect(ui.local.setMicrophoneEnabled).not.toHaveBeenCalled();
    expect(ui.room.listenerCount('ActiveSpeakersChanged')).toBe(0);
  });

  it('turns off a microphone enabled after the user has ended the call', async () => {
    const ui = setup();
    let finish!: () => void;
    ui.local.setMicrophoneEnabled.mockImplementation(async (enabled) => {
      if (enabled)
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
      ui.local.isMicrophoneEnabled = enabled;
    });
    await ui.start();
    await ui.click('back');
    finish();
    await ui.settle();
    expect(ui.local.isMicrophoneEnabled).toBe(false);
    expect(ui.local.setMicrophoneEnabled).toHaveBeenLastCalledWith(false);
  });

  it('keeps the call when browser autoplay needs another user gesture', async () => {
    const ui = setup();
    ui.room.startAudio.mockRejectedValue(new Error('Autoplay blocked'));
    await ui.start();
    expect(ui.element('enable-audio').hidden).toBe(false);
    expect(ui.element('session').dataset.state).toBe('listening');
    expect(ui.room.disconnect).not.toHaveBeenCalled();
  });

  it('updates reconnecting state and removes audio/listeners when ended', async () => {
    const ui = setup();
    await ui.start();
    ui.room.emit('Reconnecting');
    expect(ui.element('session').dataset.state).toBe('connecting');
    ui.room.emit('Reconnected');
    expect(ui.element('session').dataset.state).toBe('listening');
    await ui.click('end');
    ui.room.emit('ParticipantAttributesChanged', {}, ui.agent);
    expect(ui.element('session').dataset.state).toBe('disconnected');
    expect(ui.element('mute').disabled).toBe(true);
    expect(ui.aura.reset).toHaveBeenCalled();
    expect(ui.room.eventNames()).toHaveLength(0);
  });
});

describe('audio-reactive Aura', () => {
  it('responds quickly to the identified speaker, ignores bystanders, and releases muted audio', () => {
    const paths: number[][] = [];
    const onLevels = vi.fn();
    let frame!: (time: number) => void;
    const gradient = { addColorStop() {} };
    const context = new Proxy(
      {},
      {
        get: (_, name) => {
          if (String(name).includes('Gradient')) return () => gradient;
          if (name === 'lineTo')
            return (...point: number[]) => paths.push(point);
          return () => {};
        },
        set: () => true,
      },
    );
    const factory = runInNewContext(
      VOICE_AURA_FACTORY + '; createAudioReactiveAura',
      {
        window: { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 },
        document: { hidden: false },
        requestAnimationFrame: (callback: typeof frame) => {
          frame = callback;
          return 1;
        },
        cancelAnimationFrame: vi.fn(),
        ResizeObserver: class {
          observe() {}
        },
      },
    );
    const aura = factory(
      {
        dataset: {},
        getContext: () => context,
        getBoundingClientRect: () => ({ width: 400, height: 400 }),
      },
      onLevels,
    );
    const user = { audioLevel: 0, isMicrophoneEnabled: true };
    const agent = { audioLevel: 0 };
    aura.setParticipants(user, agent);
    aura.start();
    frame(40);
    const silentPath = paths.slice(0, 160);
    paths.length = 0;
    user.audioLevel = 0.3;
    aura.setState('user-speaking');
    frame(80);
    expect(onLevels.mock.lastCall![0].user).toBeGreaterThan(0.6);
    expect(onLevels.mock.lastCall![0].agent).toBe(0);
    expect(paths.slice(0, 160)).not.toEqual(silentPath);
    user.isMicrophoneEnabled = false;
    for (let time = 120; time <= 800; time += 40) frame(time);
    expect(onLevels.mock.lastCall![0].user).toBeLessThan(0.01);
    agent.audioLevel = 0.25;
    aura.setState('agent-speaking');
    frame(840);
    expect(onLevels.mock.lastCall![0].agent).toBeGreaterThan(0.5);
    aura.reset();
    expect(onLevels.mock.lastCall![0]).toEqual({ user: 0, agent: 0 });
  });
});
