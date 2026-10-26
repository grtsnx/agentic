import {
  Injectable,
  ForbiddenException,
  ConflictException,
  ServiceUnavailableException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { BrowserService, MacosService } from '@/lib';
import {
  computerActionSchema,
  computerApprovedActionSchema,
  type ComputerAction,
  type ComputerApprovedAction,
  type ComputerTarget,
  type ComputerLease,
} from '@/config';
@Injectable()
export class ComputerService implements OnModuleDestroy {
  // A real desktop is shared physical state. Only one conversation may own it.
  private lease?: ComputerLease;
  private closing?: Promise<void>;
  private cleanupFailed = false;
  constructor(
    private readonly config: ConfigService,
    private readonly browser: BrowserService,
    private readonly mac: MacosService,
  ) {}
  async connect(
    scope: { id: string; abort: AbortController; active?: AbortController },
    token: string,
    target: ComputerTarget,
  ) {
    if (
      !this.config.get<boolean>('COMPUTER_ENABLED') ||
      this.config.get('NODE_ENV') === 'production'
    )
      throw new ServiceUnavailableException(
        'Local computer access is disabled.',
      );
    const expected = this.config.get<string>('COMPUTER_ACCESS_TOKEN') ?? '';
    const hash = (value: string) => createHash('sha256').update(value).digest();
    if (expected.length < 32 || !timingSafeEqual(hash(expected), hash(token)))
      throw new ForbiddenException('Invalid local computer access key.');
    scope.abort.signal.throwIfAborted();
    if(scope.active)throw new ConflictException('Finish the active response before connecting the computer.');
    if (this.lease || this.closing || this.cleanupFailed)
      throw new ConflictException('Stop the current computer session first.');
    const abort = new AbortController();
    const onAbort = () => {
      void this.disconnect(scope.id).catch(() => {});
    };
    const lease: ComputerLease = {
      id: randomUUID(),
      scopeId: scope.id,
      target,
      abort,
      expiresAt: Date.now() + 600000,
      busy: true,
      timer: setTimeout(onAbort, 600000).unref(),
      detach: () => scope.abort.signal.removeEventListener('abort', onAbort),
    };
    this.lease = lease;
    scope.abort.signal.addEventListener('abort', onAbort, { once: true });
    try {
      if (target === 'browser') await this.browser.open(abort.signal);
      abort.signal.throwIfAborted();
      lease.busy=false;
      return this.status(scope.id);
    } catch (error) {
      await this.disconnect(scope.id);
      throw error;
    }
  }
  status(scopeId: string) {
    const lease = this.lease;
    return lease?.scopeId === scopeId
      ? {
          connected: true,
          target: lease.target,
          expiresAt: lease.expiresAt,
          apps: this.config.get<string[]>('COMPUTER_ALLOWED_APPS') ?? [],
        }
      : { connected: false };
  }
  private require(scopeId: string) {
    const lease = this.lease;
    if (
      !lease ||
      lease.scopeId !== scopeId ||
      lease.expiresAt <= Date.now() ||
      lease.abort.signal.aborted
    )
      throw new ForbiddenException(
        'Connect this conversation to the computer first.',
      );
    return lease;
  }
  async observe(scopeId: string, app: string | null, external: AbortSignal) {
    const lease = this.require(scopeId);
    if (lease.busy)
      throw new ConflictException('Computer operation in progress.');
    if (
      lease.target === 'desktop' &&
      (!app ||
        !(this.config.get<string[]>('COMPUTER_ALLOWED_APPS') ?? []).includes(
          app,
        ))
    )
      throw new ForbiddenException('App is not in COMPUTER_ALLOWED_APPS.');
    lease.busy = true;
    try {
      const signal = AbortSignal.any([
        external,
        lease.abort.signal,
        AbortSignal.timeout(15000),
      ]);
      const view = await (lease.target === 'browser'
        ? this.browser.observe(signal)
        : this.mac.observe(app!, signal));
      signal.throwIfAborted();
      lease.observation = {
        ...view,
        app: lease.target === 'browser' ? null : app,
        observationId: randomUUID(),
      };
      return lease.observation;
    } finally {
      lease.busy = false;
    }
  }
  proposal(scopeId: string, input: ComputerAction): ComputerApprovedAction {
    const lease = this.require(scopeId);
    const action = computerActionSchema.parse(input);
    if (
      !lease.observation ||
      lease.observation.observationId !== action.observationId
    )
      throw new ConflictException(
        'Read the current computer state before proposing an action.',
      );
    if (lease.target === 'desktop' && action.kind === 'navigate')
      throw new ForbiddenException(
        'Navigation is only supported in the browser.',
      );
    const lines=lease.observation.text.split('\n');
    const context=lease.target==='browser' ? (()=>{
      try { const state=JSON.parse(lease.observation!.text);return JSON.stringify({title:state.title,url:state.url,element:action.index===null?undefined:state.elements?.find((item:{index:number})=>item.index===action.index)}); }
      catch { return lease.observation!.text; }
    })() : lines.filter((line,index)=>index<8||(action.index!==null&&new RegExp('^\\s*(?:\\[)?'+action.index+'(?:\\]|\\s|:)').test(line))).join('\n');
    return {
      context: context.slice(0,4000),
      ...action,
      tool: 'computer_action',
      leaseId: lease.id,
      target: lease.target,
      app: lease.observation.app,
    };
  }
  async execute(
    scopeId: string,
    input: ComputerApprovedAction,
    external: AbortSignal,
  ) {
    const action = computerApprovedActionSchema.parse(input),
      lease = this.require(scopeId),
      observed = lease.observation;
    if (lease.busy)
      throw new ConflictException('Computer operation in progress.');
    if (
      action.leaseId !== lease.id ||
      action.target !== lease.target ||
      !observed ||
      observed.observationId !== action.observationId ||
      observed.app !== action.app
    )
      throw new ConflictException(
        'Computer approval is stale. Read the current state again.',
      );
    lease.busy = true;
    // Invalidate before any await: uncertain or failed side effects are never replayed.
    lease.observation = undefined;
    const signal = AbortSignal.any([
      external,
      lease.abort.signal,
      AbortSignal.timeout(15000),
    ]);
    try {
      const fresh = await (lease.target === 'browser'
        ? this.browser.observe(signal)
        : this.mac.observe(action.app!, signal));
      signal.throwIfAborted();
      if (fresh.fingerprint !== observed.fingerprint)
        throw new ConflictException(
          'The screen changed after approval was requested. Read it and propose again.',
        );
      await (lease.target === 'browser'
        ? this.browser.act(action, signal)
        : this.mac.act(action.app!, action, signal));
      signal.throwIfAborted();
      return {
        completed: true,
        message: 'Action sent. Read the screen to verify its outcome.',
      };
    } finally {
      lease.busy = false;
    }
  }
  async disconnect(scopeId: string) {
    const lease = this.lease;
    if (!lease || lease.scopeId !== scopeId) return;
    this.lease = undefined;
    lease.abort.abort();
    clearTimeout(lease.timer);
    lease.detach();
    this.closing = Promise.allSettled([
      this.browser.close(),
      this.mac.close(),
    ]).then((results) => {
      this.cleanupFailed = results.some(
        (result) => result.status === 'rejected',
      );
      if (this.cleanupFailed)
        throw new ServiceUnavailableException(
          'Computer access revoked, but cleanup could not be confirmed. Restart the local application before reconnecting.',
        );
    });
    try {
      await this.closing;
    } finally {
      this.closing = undefined;
    }
  }
  async onModuleDestroy() {
    if (this.lease) await this.disconnect(this.lease.scopeId);
    await this.closing;
  }
}
