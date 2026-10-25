import type { RequestWithId, ResponseWithHeader } from '@/config';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

const validRequestId = /^[A-Za-z0-9._-]{1,64}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(
    request: RequestWithId,
    response: ResponseWithHeader,
    next: () => void,
  ): void {
    const supplied = request.headers['x-request-id'];
    const requestId =
      typeof supplied === 'string' && validRequestId.test(supplied)
        ? supplied
        : randomUUID();

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  }
}
