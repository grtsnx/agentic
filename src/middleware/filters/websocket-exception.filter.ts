import {
  BadRequestException,
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
  Injectable,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

@Catch()
@Injectable()
export class WebsocketExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WebsocketExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();
    const validationError = exception instanceof BadRequestException;
    const expectedError = validationError || exception instanceof WsException;

    if (!expectedError) {
      this.logger.error(
        exception instanceof Error
          ? { name: exception.name, message: exception.message }
          : String(exception),
      );
    }

    client.emit('chat.error', {
      code: validationError ? 'INVALID_MESSAGE' : 'INTERNAL_ERROR',
      message: validationError
        ? 'The WebSocket message is invalid.'
        : 'The WebSocket request could not be completed.',
    });
  }
}
