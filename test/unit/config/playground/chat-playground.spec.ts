import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import { PLAYGROUND_APP } from '@/config/playground/playground.assets.js';

class Element extends EventEmitter {
  textContent = '';
  value = '';
  hidden = false;
  disabled = false;
  className = '';
  innerHTML = '';
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
  querySelector() {
    return new Element();
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
      createElement: () => new Element(),
      addEventListener() {},
    },
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
