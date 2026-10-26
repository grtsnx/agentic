import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class LocalComputerGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    // Trust the actual TCP peer, never forwarded headers. This is a single-user
    // local feature, not remote authorization or a multi-user security boundary.
    const peer = request.socket.remoteAddress;
    const port = this.config.get<number>('PORT') ?? 3001;
    const origins = ['localhost', '127.0.0.1', '[::1]'].map(
      (host) => `http://${host}:${port}`,
    );
    const origin = request.headers.origin;
    if (
      !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer ?? '') ||
      typeof origin !== 'string' ||
      !origins.includes(origin) ||
      request.headers.host !== new URL(origin).host ||
      request.headers['sec-fetch-site'] !== 'same-origin'
    )
      throw new ForbiddenException(
        'Computer access is only available from this Mac’s localhost playground.',
      );
    return true;
  }
}
