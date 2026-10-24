import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { describeException, httpResponse } from './http-response.js';

@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{
      status: (statusCode: number) => { json: (body: unknown) => void };
    }>();
    const { statusCode, message, data } = describeException(exception);

    if (!(exception instanceof HttpException)) {
      this.logger.error(exception);
    }

    response.status(statusCode).json(httpResponse(statusCode, message, data));
  }
}
