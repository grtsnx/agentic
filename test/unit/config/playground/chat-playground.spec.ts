import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import { PLAYGROUND_APP } from '@/config/playground/playground.assets.js';

class Element extends EventEmitter {
  private text = '';
  get textContent(): string {
    return this.text + this.children.map((child) => child.textContent).join('');
  }
  set textContent(value: string) {
    this.text = value;
    this.children = [];
  }
  value = '';
  hidden = false;
  disabled = false;
  className = '';
  innerHTML = '';
  href = '';
  tagName = '';
  replaceChildren(...children: Element[]) {
    this.text = '';
    this.children = children;
  }
  style = {};
  dataset = {};
  children: Element[] = [];
  lastChild = { textContent: '' };
  classList = { add: vi.fn() };
  addEventListener = this.on;
  attributes = new Map<string, string>();
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  focus = vi.fn();
  open = false;
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
    this.emit('close');
  }
  append(...children: Element[]) {
    this.children.push(...children);
  }
  insertBefore(child: Element, before: Element) {
    this.children.splice(this.children.indexOf(before), 0, child);
  }
  private queries = new Map<string, Element>();
  querySelector(selector: string) {
    if (!this.queries.has(selector)) this.queries.set(selector, new Element());
    return this.queries.get(selector)!;
  }
}

function setup(deferFrames = false) {
  const frames: Array<() => void> = [];
  const flushFrames = () => {
    while (frames.length) frames.shift()!();
  };
  const nodes = new Map<string, Element>();
  const query = (selector: string) => {
    if (!nodes.has(selector)) nodes.set(selector, new Element());
    return nodes.get(selector)!;
  };
  const socket = Object.assign(new EventEmitter(), { connected: true });
  const writeText = vi.fn().mockResolvedValue(undefined);
  runInNewContext(PLAYGROUND_APP, {
    io: () => socket,
    document: {
      querySelector: query,
      querySelectorAll: () => [],
      createElement: (tagName: string) =>
        Object.assign(new Element(), { tagName }),
      createTextNode: (text: string) =>
        Object.assign(new Element(), { textContent: text }),
      addEventListener() {},
    },
    URL,
    navigator: { clipboard: { writeText } },
    setTimeout: vi.fn(),
    performance,
    requestAnimationFrame: (callback: () => void) =>
      deferFrames ? frames.push(callback) : callback(),
    setInterval: vi.fn(),
    clearInterval: vi.fn(),
  });
  query('#message').value = 'Hello';
  query('#send').emit('click');
  socket.emit('chat.delta', { delta: 'An answer in progress.' });
  flushFrames();
  const article = query('#messages').children[1]!;
  const body = article.children[1]!;
  const content = body.children.find(
    (node) => node.className === 'message-content',
  )!;
  return { query, socket, body, content, flushFrames, writeText };
}

function descendants(element: Element): Element[] {
  return element.children.flatMap((child) => [child, ...descendants(child)]);
}

describe('chat interruption handling', () => {
  it.each(['chat.error', 'disconnect'])(
    'preserves partial text and clearly marks interruption on %s',
    (event) => {
      const ui = setup();
      ui.socket.emit(event, { message: 'Please try again.' });
      expect(ui.content.textContent).toBe('An answer in progress.');
      expect(
        ui.body.children.some(
          (node) =>
            node.className === 'response-notice' && node.textContent.length > 0,
        ),
      ).toBe(event === 'chat.error');
      const status = ui.body.children.find(
        (node) => node.className === 'agent-status',
      );
      expect(status?.hidden).toBe(event === 'chat.error');
      if (event === 'disconnect') {
        expect(status?.querySelector('.status-label').textContent).toBe(
          'Reconnecting',
        );
      }
      expect(ui.query('#stop').hidden).toBe(event === 'chat.error');
    },
  );

  it('shows reconnecting while Socket.IO retries an active response', () => {
    const ui = setup();
    ui.socket.emit('disconnect');
    const status = ui.body.children.find(
      (node) => node.className === 'agent-status',
    )!;
    expect(status.hidden).toBe(false);
    expect(status.querySelector('.status-label').textContent).toBe(
      'Reconnecting',
    );
    expect(status.querySelector('.status-detail').textContent).toBe(
      'Trying to restore the connection',
    );
  });

  it('does not display internal tool names in completion metadata', () => {
    const ui = setup();
    ui.socket.emit('chat.completed', {
      response: {
        message: 'Done',
        runtime: { tools: [{ name: 'context_dev_search', calls: 1 }] },
      },
    });
    const metadata = ui.body.children.find(
      (node) => node.className === 'runtime-chips',
    )!;
    expect(
      metadata.children.map((node) => node.textContent).join(' '),
    ).not.toContain('context_dev_search');
  });

  it('displays input and output token usage separately', () => {
    const ui = setup();
    ui.socket.emit('chat.completed', {
      response: {
        message: 'Done',
        runtime: {
          tokens: { input: 21, output: 13, total: 34 },
        },
      },
    });
    expect(ui.body.textContent).toContain('21 in / 13 out / 34 total');
    expect(ui.body.textContent).not.toContain('34 tokens');
  });
});

describe('live progress and citations', () => {
  it.each([
    ['thinking', 'Thinking', 'thinking'],
    ['tool', 'Searching the web', 'searching'],
    ['tool', 'Reading a page', 'reading'],
    ['thinking', 'Reviewing sources', 'reviewing'],
    ['thinking', 'Reviewing information', 'reviewing'],
    ['thinking', 'Organizing context', 'organizing'],
    ['tool', 'Using a tool', 'tool'],
    ['handoff', 'Working on your request', 'handoff'],
    ['approval', 'Waiting for approval', 'approval'],
    ['responding', 'Responding', 'responding'],
    ['thinking', 'Stopping', 'stopping'],
  ])(
    'uses the %s event to show the %s indicator',
    (phase, message, activity) => {
      const ui = setup();
      ui.socket.emit('chat.status', { phase, message });
      const status = ui.body.children.find(
        (node) => node.className === 'agent-status',
      )!;
      expect(status.dataset).toMatchObject({ activity });
      expect(status.hidden).toBe(false);
      expect(status.querySelector('.status-label').textContent).toBe(message);
      ui.socket.emit('chat.delta', { delta: ' Result.' });
      expect(status.hidden).toBe(true);
    },
  );

  it('does not let a queued streaming render overwrite the completed response', () => {
    const ui = setup(true);
    ui.socket.emit('chat.delta', { delta: ' A pending chunk.' });
    ui.socket.emit('chat.completed', {
      response: { message: '**Final answer**' },
    });
    ui.flushFrames();
    expect(ui.content.textContent).toBe('Final answer');
    expect(
      descendants(ui.content).some((node) => node.tagName === 'strong'),
    ).toBe(true);
  });

  it('uses one source number for tracking variants of the same URL', () => {
    const ui = setup();
    ui.socket.emit('chat.completed', {
      response: {
        message:
          'First ([example.com](https://example.com/?utm_source=openai)). Again ([example.com](https://example.com/)).',
        sources: [{ title: 'Example source', url: 'https://example.com/' }],
      },
    });
    expect(
      descendants(ui.content)
        .filter((node) => node.className === 'citation-badge')
        .map((node) => node.textContent),
    ).toEqual(['1 example.com', '1 example.com']);
    descendants(ui.body)
      .find((node) => node.className === 'sources-button')!
      .emit('click');
    const sources = ui.query('#sources-list');
    expect(
      sources.children.filter((node) => node.tagName === 'a'),
    ).toHaveLength(1);
  });

  it('shows new tool activity after a preliminary text chunk and hides it on the next answer chunk', () => {
    const ui = setup();
    const status = ui.body.children.find(
      (node) => node.className === 'agent-status',
    )!;
    expect(status.hidden).toBe(true);
    ui.socket.emit('chat.status', {
      phase: 'tool',
      message: 'Searching the web',
      detail: 'Finding relevant sources',
    });
    expect(status.hidden).toBe(false);
    expect(status.querySelector('.status-label').textContent).toBe(
      'Searching the web',
    );
    expect(status.querySelector('.status-detail').textContent).toBe(
      'Finding relevant sources',
    );
    ui.socket.emit('chat.delta', { delta: ' Updated answer.' });
    expect(status.hidden).toBe(true);
  });

  it('renders clickable citations without allowing HTML or unsafe source URLs', () => {
    const ui = setup();
    ui.socket.emit('chat.completed', {
      response: {
        message:
          'Read [NestJS](https://docs.nestjs.com/) <img src=x onerror=alert(1)> [bad](javascript:alert(1))',
        sources: [
          { title: 'NestJS', url: 'https://docs.nestjs.com/' },
          { title: 'Duplicate', url: 'https://docs.nestjs.com/' },
          { title: 'Unsafe', url: 'javascript:alert(1)' },
        ],
      },
    });
    expect(
      descendants(ui.content).find((node) => node.tagName === 'a')?.href,
    ).toBe('https://docs.nestjs.com/');
    expect(ui.content.innerHTML).toBe('');
    expect(ui.content.textContent).toContain('<img src=x onerror=alert(1)>');
    descendants(ui.body)
      .find((node) => node.className === 'sources-button')!
      .emit('click');
    const sources = ui.query('#sources-list');
    expect(
      sources.children
        .filter((node) => node.tagName === 'a')
        .map((node) => node.href),
    ).toEqual(['https://docs.nestjs.com/']);
  });

  it('replaces citation parentheses with compact source badges and formats the answer', () => {
    const ui = setup();
    ui.socket.emit('chat.completed', {
      response: {
        message:
          '## Background\n\n- **Engineer** in Lagos. ([gravatar.com](https://gravatar.com/thegrtnx?utm_source=openai))\n- Peacebuilding. ([peacecatalyst.org](https://www.peacecatalyst.org/moses-abolade?utm_source=openai))',
        sources: [
          {
            title: 'Professional profile',
            url: 'https://gravatar.com/thegrtnx?utm_source=openai',
          },
        ],
      },
    });
    const nodes = descendants(ui.content);
    expect(
      nodes
        .filter((node) => node.className === 'citation-badge')
        .map((node) => node.textContent),
    ).toEqual(['1 gravatar.com', '2 peacecatalyst.org']);
    expect(
      nodes.some(
        (node) => node.tagName === 'h3' && node.textContent === 'Background',
      ),
    ).toBe(true);
    expect(nodes.filter((node) => node.tagName === 'li')).toHaveLength(2);
    expect(
      nodes.some(
        (node) => node.tagName === 'strong' && node.textContent === 'Engineer',
      ),
    ).toBe(true);
    expect(ui.content.textContent).not.toMatch(/https:|\]\(|\(1 gravatar/);
  });

  it('renders citations across streaming chunk boundaries and preserves the raw buffer', () => {
    const ui = setup();
    ui.socket.emit('chat.delta', {
      delta: ' ([gravatar.com](https://gravatar.com/',
    });
    expect(ui.content.textContent).not.toContain('https://');
    ui.socket.emit('chat.delta', { delta: 'thegrtnx)) Next.' });
    expect(
      descendants(ui.content).find(
        (node) => node.className === 'citation-badge',
      )?.href,
    ).toBe('https://gravatar.com/thegrtnx');
    ui.socket.emit('chat.completed', { response: {} });
    expect(ui.content.textContent).toContain('Next.');
    expect(
      descendants(ui.content).filter(
        (node) => node.className === 'citation-badge',
      ),
    ).toHaveLength(1);
  });

  it('leaves code literal and never turns model HTML or unsafe links into active content', () => {
    const ui = setup();
    ui.socket.emit('chat.completed', {
      response: {
        message:
          '```html\n<img src=x onerror=alert(1)>\n```\n\n`[example](https://example.com)` [bad](data:text/html,hello) [credentials](https://user:pass@example.com) [valid](https://example.com/a_(b))',
      },
    });
    const nodes = descendants(ui.content);
    expect(
      nodes.filter((node) => node.tagName === 'a').map((node) => node.href),
    ).toEqual(['https://example.com/a_(b)']);
    expect(nodes.some((node) => node.tagName === 'img')).toBe(false);
    expect(nodes.filter((node) => node.tagName === 'code')).toHaveLength(2);
  });
});

describe('answer actions and sources sheet', () => {
  it('opens only the selected answer sources and restores focus when closed', () => {
    const ui = setup();
    ui.socket.emit('chat.completed', {
      response: {
        message: 'First answer',
        sources: [{ title: 'First source', url: 'https://example.com/first' }],
      },
    });
    const first = descendants(ui.body).find(
      (node) => node.className === 'sources-button',
    )!;
    ui.query('#message').value = 'Another question';
    ui.query('#send').emit('click');
    ui.socket.emit('chat.completed', {
      response: {
        message: 'Second answer',
        sources: [
          { title: 'Second source', url: 'https://example.com/second' },
        ],
      },
    });
    const buttons = descendants(ui.query('#messages')).filter(
      (node) => node.className === 'sources-button',
    );
    buttons[1]!.emit('click');
    expect(ui.query('#sources-sheet').open).toBe(true);
    expect(ui.query('#sources-list').textContent).toContain('Second source');
    ui.query('#sources-close').emit('click');
    expect(ui.query('#sources-sheet').open).toBe(false);
    expect(buttons[1]!.focus).toHaveBeenCalled();
    first.emit('click');
    expect(ui.query('#sources-list').textContent).toContain('First source');
    expect(ui.query('#sources-list').textContent).not.toContain(
      'Second source',
    );
    expect(first.attributes.get('aria-expanded')).toBe('true');
    ui.query('#sources-sheet').close();
    expect(first.attributes.get('aria-expanded')).toBe('false');
  });

  it('copies the selected answer and handles clipboard failures honestly', async () => {
    const ui = setup();
    ui.socket.emit('chat.completed', {
      response: { message: 'Copy **this answer**' },
    });
    const copy = descendants(ui.body).find(
      (node) => node.className === 'copy-button',
    )!;
    expect(
      descendants(ui.body).some((node) => node.className === 'sources-button'),
    ).toBe(false);
    copy.emit('click');
    await Promise.resolve();
    expect(ui.writeText).toHaveBeenCalledWith('Copy **this answer**');
    await vi.waitFor(() => expect(ui.body.textContent).toContain('Copied'));
    ui.writeText.mockRejectedValueOnce(new Error('Permission denied'));
    copy.emit('click');
    await Promise.resolve();
    await vi.waitFor(() =>
      expect(ui.body.textContent).toContain('Could not copy'),
    );
  });
});
