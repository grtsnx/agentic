import { BadRequestException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { WebsocketExceptionFilter } from '@/middleware';

describe('WebsocketExceptionFilter', () => {
  it('sends a safe validation error event', () => {
    const client = { emit: vi.fn() };
    const host = {
      switchToWs: () => ({ getClient: () => client }),
    } as unknown as ArgumentsHost;

    new WebsocketExceptionFilter().catch(
      new BadRequestException('Invalid message'),
      host,
    );

    expect(client.emit).toHaveBeenCalledWith('chat.error', {
      code: 'INVALID_MESSAGE',
      message: 'The WebSocket message is invalid.',
    });
  });
});
