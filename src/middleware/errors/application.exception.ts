import { HttpException } from '@nestjs/common';

/** A deliberately public error whose stable code may safely cross transports. */
export class ApplicationException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: number,
    readonly retryable = false,
  ) {
    super({ message, data: { code, retryable } }, status);
  }
}
