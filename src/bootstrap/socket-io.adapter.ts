import type { IncomingMessage } from 'node:http';
import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';

export class SecureSocketIoAdapter extends IoAdapter {
  private readonly allowedOrigins: Set<string>;

  constructor(app: INestApplicationContext, allowedOrigins: string[]) {
    super(app);
    this.allowedOrigins = new Set(allowedOrigins);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const configuredOptions = {
      ...options,
      cors: {
        credentials: true,
        origin: [...this.allowedOrigins],
      },
      allowRequest: (request, callback) => {
        callback(null, this.isAllowedRequest(request));
      },
    } as ServerOptions;

    return super.createIOServer(port, configuredOptions);
  }

  private isAllowedRequest(request: IncomingMessage): boolean {
    const origin = request.headers.origin;

    // Non-browser clients such as the local CLI do not send an Origin header.
    if (!origin) return true;
    if (this.allowedOrigins.has(origin)) return true;

    try {
      // Browsers may always connect back to the API's own host.
      return new URL(origin).host === request.headers.host;
    } catch {
      return false;
    }
  }
}
