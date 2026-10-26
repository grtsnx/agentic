import { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { LocalComputerGuard } from '../../../../src/middleware/guards/local-computer.guard.js';
const guard = new LocalComputerGuard(new ConfigService({ PORT: 3001 }));
function context(
  peer = '127.0.0.1',
  origin = 'http://localhost:3001',
  host = 'localhost:3001',
  site = 'same-origin',
) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        socket: { remoteAddress: peer },
        headers: {
          origin,
          host,
          'sec-fetch-site': site,
          'x-forwarded-for': '127.0.0.1',
        },
      }),
    }),
  } as ExecutionContext;
}
describe('local computer consent boundary', () => {
  it('accepts a same-origin browser on the actual loopback connection without an env key', () => {
    expect(guard.canActivate(context())).toBe(true);
  });
  it('rejects remote callers even when forwarded headers claim localhost', () => {
    expect(() => guard.canActivate(context('10.0.0.2'))).toThrow();
  });
  it('rejects cross-site requests and DNS-rebinding hosts', () => {
    expect(() =>
      guard.canActivate(context('127.0.0.1', 'https://evil.example')),
    ).toThrow();
    expect(() =>
      guard.canActivate(
        context('127.0.0.1', 'http://localhost:3001', 'evil.example:3001'),
      ),
    ).toThrow();
    expect(() =>
      guard.canActivate(
        context(
          '127.0.0.1',
          'http://localhost:3001',
          'localhost:3001',
          'cross-site',
        ),
      ),
    ).toThrow();
  });
});
