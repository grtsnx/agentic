import { runInNewContext } from 'node:vm';
import { WORKSPACE_APP } from '@/config/playground/workspace.asset.js';

class Element {
  children: Element[] = [];
  textContent = '';
  className = '';
  innerHTML = '';
  hidden = false;
  disabled = false;
  value = '';
  attributes = new Map<string, string>();
  listeners = new Map<string, () => unknown>();
  append(...children: Element[]) {
    this.children.push(...children);
  }
  replaceChildren(...children: Element[]) {
    this.children = children;
  }
  setAttribute(key: string, value: string) {
    this.attributes.set(key, value);
  }
  toggleAttribute(key: string, on: boolean) {
    if (on) this.attributes.set(key, '');
    else this.attributes.delete(key);
  }
  addEventListener(event: string, listener: () => unknown) {
    this.listeners.set(event, listener);
  }
  close() {
    this.listeners.get('close')?.();
  }
  focus() {}
}

function setup() {
  const nodes = new Map<string, Element>();
  const query = (selector: string) => {
    if (!nodes.has(selector)) nodes.set(selector, new Element());
    return nodes.get(selector)!;
  };
  const action = {
    id: 'approval-1',
    status: 'pending',
    expiresAt: Date.now() + 300000,
    target: 'Isolated JavaScript container',
    risk: 'Runs only this exact code.',
    action: {
      tool: 'execute_code',
      code: 'console.log("<script>untrusted</script>")',
    },
  };
  const fetch = vi.fn(async (_path: string, options: RequestInit = {}) => ({
    ok: true,
    status: 200,
    json: async () => ({
      data:
        options.method === 'POST'
          ? String(_path).includes('/approvals/')
            ? { status: 'denied' }
            : { id: 'scope', token: 'secret' }
          : { files: [], approvals: [action] },
    }),
  }));
  const context = {
    document: { querySelector: query, createElement: () => new Element() },
    fetch,
    AbortSignal,
    URL,
    active: false,
    setTimeout: vi.fn(),
    clearTimeout: vi.fn(),
  };
  const panel = runInNewContext(
    WORKSPACE_APP + '\nworkspacePanel;',
    context,
  ) as {
    prepare: () => Promise<unknown>;
    refresh: () => Promise<void>;
    reset: () => Promise<void>;
  };
  return { panel, query, fetch, action, context };
}

describe('inline workspace approval cards', () => {
  it('shows exact code in chat without executing it, and denies only on click', async () => {
    const ui = setup();
    await ui.panel.prepare();
    await ui.panel.refresh();
    const card = ui.query('#messages').children[0]!;
    expect(card.className).toBe('approval-card');
    expect(
      card.children.find((x) => x.textContent === ui.action.action.code)
        ?.innerHTML,
    ).toBe('');
    expect(
      ui.fetch.mock.calls.some(([path]) => path.includes('/approvals/')),
    ).toBe(false);
    const footer = card.children.find((x) =>
      x.children.some((b) => b.textContent === 'Deny'),
    )!;
    await footer.children
      .find((x) => x.textContent === 'Deny')!
      .listeners.get('click')!();
    const decision = ui.fetch.mock.calls.find(([path]) =>
      path.includes('/approvals/'),
    )!;
    expect(decision[0]).toBe('/v1/workspaces/scope/approvals/approval-1');
    expect(JSON.parse(decision[1]!.body as string)).toEqual({
      decision: 'deny',
    });
    expect(footer.children.every((x) => x.disabled)).toBe(true);
    expect(ui.query('#messages').children).toHaveLength(1);
    expect(
      card.children.some(
        (x) => x.textContent === 'Denied. Nothing was executed.',
      ),
    ).toBe(true);
  });
  it('prevents repeat approval clicks and blocks approval during an active response', async () => {
    const ui = setup();
    await ui.panel.prepare();
    await ui.panel.refresh();
    const card = ui.query('#messages').children[0]!;
    const footer = card.children.find((x) =>
      x.children.some((b) => b.textContent === 'Approve once'),
    )!;
    const click = footer.children[0]!.listeners.get('click')!;
    ui.context.active = true;
    await click();
    expect(
      ui.fetch.mock.calls.filter(([path]) => path.includes('/approvals/')),
    ).toHaveLength(0);
    ui.context.active = false;
    await Promise.all([click(), click()]);
    await click();
    expect(
      ui.fetch.mock.calls.filter(([path]) => path.includes('/approvals/')),
    ).toHaveLength(1);
  });
  it('locks a card when the result is uncertain, without retrying a write', async () => {
    const ui = setup();
    await ui.panel.prepare();
    await ui.panel.refresh();
    const card = ui.query('#messages').children[0]!;
    const footer = card.children.find((x) =>
      x.children.some((b) => b.textContent === 'Approve once'),
    )!;
    ui.fetch.mockRejectedValueOnce(new Error('Network unavailable'));
    await footer.children[0]!.listeners.get('click')!();
    expect(
      card.children.some((x) =>
        x.textContent.startsWith('Could not confirm the outcome:'),
      ),
    ).toBe(true);
    expect(footer.children.every((x) => x.disabled)).toBe(true);
  });
});
