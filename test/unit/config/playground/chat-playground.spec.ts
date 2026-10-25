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
  setAttribute() {}
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

function setup() {
  const nodes = new Map<string, Element>();
  const query = (selector: string) => {
    if (!nodes.has(selector)) nodes.set(selector, new Element());
    return nodes.get(selector)!;
  };
  const socket = Object.assign(new EventEmitter(), { connected: true });
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
    performance,
    requestAnimationFrame: (callback: () => void) => callback(),
    setInterval: vi.fn(),
    clearInterval: vi.fn(),
  });
  query('#message').value = 'Hello';
  query('#send').emit('click');
  socket.emit('chat.delta', { delta: 'An answer in progress.' });
  const article = query('#messages').children[1]!;
  const body = article.children[1]!;
  const content = body.children.find(
    (node) => node.className === 'message-content',
  )!;
  return { query, socket, body, content };
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
      ).toBe(true);
      expect(
        ui.body.children.find((node) => node.className === 'agent-status')
          ?.hidden,
      ).toBe(true);
      expect(ui.query('#stop').hidden).toBe(true);
    },
  );

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
});

describe('live progress and citations', () => {
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
    expect(ui.content.children.find((node) => node.tagName === 'a')?.href).toBe(
      'https://docs.nestjs.com/',
    );
    expect(ui.content.innerHTML).toBe('');
    expect(ui.content.textContent).toContain('<img src=x onerror=alert(1)>');
    const sources = ui.body.children.find(
      (node) => node.className === 'message-sources',
    )!;
    expect(
      sources.children
        .filter((node) => node.tagName === 'a')
        .map((node) => node.href),
    ).toEqual(['https://docs.nestjs.com/']);
  });
});
