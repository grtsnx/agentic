import {
  Injectable,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium, type Browser, type Page } from 'playwright';
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
// Provider leaf imports avoid config -> lib -> browser -> config initialization.
import { publicPageUrl } from '../../config/agent/tools/web/web-tool.policy.js';
import type { ComputerAction, ComputerSnapshot } from '@/config';

@Injectable()
export class BrowserService {
  private browser?: Browser;
  private page?: Page;
  private opening?: Promise<Browser>;
  constructor(private readonly config: ConfigService) {}
  async open(signal: AbortSignal) {
    signal.throwIfAborted();
    // A dedicated temporary Chrome profile never imports the owner's cookies.
    this.opening = chromium.launch({
      channel: 'chrome',
      headless: false,
      chromiumSandbox: true,
      timeout: 15000,
      env: Object.fromEntries(
        ['PATH', 'HOME', 'TMPDIR', 'LANG', 'DISPLAY', 'XAUTHORITY'].flatMap(
          (key) => (process.env[key] ? [[key, process.env[key]!]] : []),
        ),
      ),
    });
    const browser = await this.opening;
    this.browser = browser;
    try {
      signal.throwIfAborted();
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        acceptDownloads: false,
        serviceWorkers: 'block',
        permissions: [],
      });
      await context.route('**/*', async (route) => {
        try {
          await this.allowedUrl(route.request().url());
          await route.continue();
        } catch {
          await route.abort().catch(() => {});
        }
      });
      await context.routeWebSocket('**/*', (socket) => socket.close());
      this.page = await context.newPage();
      context.on('page', (page) => {
        if (page !== this.page) void page.close().catch(() => {});
      });
      this.page.on('download', (download) => {
        void download.cancel();
      });
      this.page.setDefaultTimeout(8000);
      signal.throwIfAborted();
    } catch (error) {
      await this.close();
      throw error;
    }
  }
  async allowedUrl(value: string) {
    const domains = this.config.get<string[]>('COMPUTER_BROWSER_DOMAINS') ?? [];
    const url = publicPageUrl(value, domains);
    if (!domains.length || !url)
      throw new ForbiddenException(
        'Website is not in COMPUTER_BROWSER_DOMAINS.',
      );
    const privateNetworks = new BlockList();
    for (const [network, prefix] of [
      ['0.0.0.0', 8],
      ['10.0.0.0', 8],
      ['127.0.0.0', 8],
      ['169.254.0.0', 16],
      ['172.16.0.0', 12],
      ['192.168.0.0', 16],
      ['100.64.0.0', 10],
      ['198.18.0.0', 15],
      ['224.0.0.0', 4],
      ['240.0.0.0', 4],
    ] as const)
      privateNetworks.addSubnet(network, prefix);
    const publicV6 = new BlockList();
    publicV6.addSubnet('2000::', 3, 'ipv6');
    const addresses = await lookup(url.hostname, { all: true });
    if (
      !addresses.length ||
      addresses.some(({ address }) =>
        isIP(address) === 4
          ? privateNetworks.check(address)
          : !publicV6.check(address, 'ipv6'),
      )
    )
      throw new ForbiddenException('Private network destinations are blocked.');
    return url;
  }
  private requirePage() {
    if (!this.page || this.page.isClosed())
      throw new ServiceUnavailableException(
        'Computer browser is closed. Reconnect it.',
      );
    return this.page;
  }
  async observe(signal: AbortSignal): Promise<ComputerSnapshot> {
    return this.withSignal(signal, async () => {
      const page = this.requirePage();
      const state = await page.evaluate(() => ({
        title: document.title,
        url: location.href,
        text: (document.body?.innerText ?? '').slice(0, 16000),
        elements: Array.from(
          document.querySelectorAll(
            'a,button,input,textarea,select,[role="button"],[contenteditable="true"]',
          ),
        )
          .slice(0, 150)
          .map((el, index) => ({
            index,
            tag: el.tagName,
            label: (
              el.getAttribute('aria-label') ??
              el.textContent ??
              ''
            ).slice(0, 160),
            type: el.getAttribute('type'),
            placeholder: el.getAttribute('placeholder'),
            href: el.getAttribute('href'),
            value:
              el instanceof HTMLInputElement && el.type !== 'password'
                ? el.value
                : undefined,
          })),
      }));
      const text = JSON.stringify(state);
      const screenshot = await page.screenshot({
        type: 'jpeg',
        quality: 60,
        timeout: 5000,
      });
      return {
        text,
        fingerprint: createHash('sha256').update(text).digest('hex'),
        image: 'data:image/jpeg;base64,' + screenshot.toString('base64'),
      };
    });
  }
  async act(action: ComputerAction, signal: AbortSignal) {
    await this.withSignal(signal, async () => {
      const page = this.requirePage();
      const target = () =>
        page
          .locator(
            'a,button,input,textarea,select,[role="button"],[contenteditable="true"]',
          )
          .nth(action.index!);
      if (action.kind === 'navigate') {
        await this.allowedUrl(action.value!);
        signal.throwIfAborted();
        await page.goto(action.value!, {
          waitUntil: 'domcontentloaded',
          timeout: 10000,
        });
      } else if (action.kind === 'click')
        await target().click({ timeout: 5000 });
      else if (action.kind === 'type')
        await target().fill(action.value!, { timeout: 5000 });
      else if (action.kind === 'key') await page.keyboard.press(action.value!);
      else {
        await target().scrollIntoViewIfNeeded();
        await page.mouse.wheel(0, action.value === 'down' ? 600 : -600);
      }
    });
  }
  private async withSignal<T>(
    signal: AbortSignal,
    run: () => Promise<T>,
  ): Promise<T> {
    signal.throwIfAborted();
    const abort = () => {
      void this.close().catch(() => {});
    };
    signal.addEventListener('abort', abort, { once: true });
    try {
      const result = await run();
      signal.throwIfAborted();
      return result;
    } finally {
      signal.removeEventListener('abort', abort);
    }
  }
  async close() {
    const browser =
      this.browser ?? (await this.opening?.catch(() => undefined));
    this.browser = undefined;
    this.page = undefined;
    this.opening = undefined;
    if (browser) await browser.close();
  }
}
