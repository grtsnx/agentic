import {
  ConflictException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { ChatSessionService } from '@/modules';

describe('ChatSessionService', () => {
  function setup(overrides: Record<string, number> = {}) {
    const sessions: object[] = [];
    const openai = {
      createSession: vi.fn(() => {
        const items: Array<Record<string, unknown>> = [];
        const session = {
          getItems: vi.fn(async () => [...items]),
          clearSession: vi.fn(async () => items.splice(0)),
          addItems: vi.fn(async (next) => items.push(...next)),
        };
        sessions.push(session);
        return session;
      }),
      generateReply: vi.fn(
        async (message: string, options: { session: unknown }) => ({
          message,
          options,
        }),
      ),
    };
    const values: Record<string, number> = {
      SESSION_TTL_MS: 60_000,
      SESSION_MAX_TURNS: 2,
      SESSION_MAX_TOKENS: 100,
      ...overrides,
    };
    const config = { getOrThrow: vi.fn((key: string) => values[key]) };
    return {
      service: new ChatSessionService(openai as never, config as never),
      openai,
      sessions,
    };
  }

  it('creates, concurrently continues, and deletes isolated sessions', async () => {
    const { service, openai } = setup();
    const first = service.create();
    const second = service.create();

    await Promise.all([
      service.send(first.id, 'one'),
      service.send(second.id, 'two'),
    ]);

    expect(openai.generateReply.mock.calls[0]?.[1]?.session).not.toBe(
      openai.generateReply.mock.calls[1]?.[1]?.session,
    );
    expect(service.delete(first.id)).toBe(true);
    await expect(service.send(first.id, 'again')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('expires sessions and rejects turns beyond the configured limit', async () => {
    vi.useFakeTimers();
    const { service } = setup({ SESSION_TTL_MS: 10 });
    const expired = service.create();
    vi.advanceTimersByTime(11);
    await expect(service.send(expired.id, 'late')).rejects.toBeInstanceOf(
      GoneException,
    );

    const limited = service.create();
    await service.send(limited.id, 'one');
    await service.send(limited.id, 'two');
    await expect(service.send(limited.id, 'three')).rejects.toBeInstanceOf(
      ConflictException,
    );
    vi.useRealTimers();
  });

  it('summarizes oversized context before continuing', async () => {
    const { service, sessions } = setup({ SESSION_MAX_TOKENS: 20 });
    const created = service.create();
    const providerSession = sessions[0] as {
      addItems(items: object[]): Promise<void>;
      clearSession: ReturnType<typeof vi.fn>;
    };
    await providerSession.addItems([
      { role: 'user', content: 'x'.repeat(100) },
      { role: 'assistant', content: 'y'.repeat(100) },
    ]);

    await service.send(created.id, 'continue');

    expect(providerSession.clearSession).toHaveBeenCalledOnce();
  });

  it('rejects a single turn that exceeds the session token budget', async () => {
    const { service } = setup({ SESSION_MAX_TOKENS: 20 });
    const session = service.create();

    await expect(
      service.send(session.id, 'x'.repeat(100)),
    ).rejects.toMatchObject({ status: 413 });
  });
});
