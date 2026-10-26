import { ConfigService } from '@nestjs/config';
import { ComputerService } from '../../../../../src/modules/v1/computer/computer.service.js';
import { BrowserService } from '../../../../../src/lib/browser/browser.service.js';
import { MacosService } from '../../../../../src/lib/macos/macos.service.js';
import { computerActionSchema } from '../../../../../src/config/schema/computer/computer.schema.js';

function fixture(apps = ['com.apple.TextEdit']) {
  const browser = {
    open: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    observe: vi.fn(async () => ({
      text: 'button 0: Save',
      fingerprint: 'first',
    })),
    act: vi.fn(async () => {}),
  };
  const mac = {
    observe: vi.fn(async () => ({ text: 'Editor', fingerprint: 'first' })),
    act: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  const service = new ComputerService(
    new ConfigService({ COMPUTER_ENABLED: true, COMPUTER_ALLOWED_APPS: apps }),
    browser as unknown as BrowserService,
    mac as unknown as MacosService,
  );
  const abort = new AbortController();
  return { service, browser, mac, abort, scope: { id: 'owner', abort } };
}
describe('local computer permissions', () => {
  it('allows any named app when the owner enables all apps', async () => {
    const f = fixture(['*']);
    try {
      await f.service.connect(f.scope, 'desktop');
      await f.service.observe(f.scope.id, 'Safari', f.abort.signal);
      expect(f.mac.observe).toHaveBeenCalled();
    } finally {
      await f.service.onModuleDestroy();
    }
  });
  it('isolates leases and rejects stale approved actions without execution', async () => {
    const f = fixture();
    try {
      await f.service.connect(f.scope, 'browser');
      const view = await f.service.observe(f.scope.id, null, f.abort.signal);
      const action = f.service.proposal(f.scope.id, {
        observationId: view.observationId,
        kind: 'click',
        index: 0,
        value: null,
      });
      await expect(
        f.service.execute('stranger', action, f.abort.signal),
      ).rejects.toThrow();
      f.browser.observe.mockResolvedValue({
        text: 'button 0: Pay',
        fingerprint: 'changed',
      });
      await expect(
        f.service.execute(f.scope.id, action, f.abort.signal),
      ).rejects.toThrow(/changed/i);
      expect(f.browser.act).not.toHaveBeenCalled();
    } finally {
      await f.service.onModuleDestroy();
    }
  });
  it('revokes access on Stop and cannot replay an old lease after reconnecting', async () => {
    const f = fixture();
    try {
      await f.service.connect(f.scope, 'browser');
      const view = await f.service.observe(f.scope.id, null, f.abort.signal);
      const action = f.service.proposal(f.scope.id, {
        observationId: view.observationId,
        kind: 'click',
        index: 0,
        value: null,
      });
      await f.service.disconnect(f.scope.id);
      await f.service.connect(f.scope, 'browser');
      await expect(
        f.service.execute(f.scope.id, action, f.abort.signal),
      ).rejects.toThrow();
      expect(f.browser.act).not.toHaveBeenCalled();
    } finally {
      await f.service.onModuleDestroy();
    }
  });
  it('requires an observed allowed app and rejects arbitrary commands', async () => {
    const f = fixture();
    try {
      await f.service.connect(f.scope, 'desktop');
      await expect(
        f.service.observe(f.scope.id, 'com.apple.Terminal', f.abort.signal),
      ).rejects.toThrow();
      expect(f.mac.observe).not.toHaveBeenCalled();
      expect(
        computerActionSchema.safeParse({ kind: 'shell', value: 'rm -rf /' })
          .success,
      ).toBe(false);
    } finally {
      await f.service.onModuleDestroy();
    }
  });
  it('executes one approved operation and requires another observation', async () => {
    const f = fixture();
    try {
      await f.service.connect(f.scope, 'browser');
      const view = await f.service.observe(f.scope.id, null, f.abort.signal);
      const action = f.service.proposal(f.scope.id, {
        observationId: view.observationId,
        kind: 'click',
        index: 0,
        value: null,
      });
      await f.service.execute(f.scope.id, action, f.abort.signal);
      await expect(
        f.service.execute(f.scope.id, action, f.abort.signal),
      ).rejects.toThrow();
      expect(f.browser.act).toHaveBeenCalledTimes(1);
    } finally {
      await f.service.onModuleDestroy();
    }
  });
});
