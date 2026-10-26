import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
// Keep provider initialization independent of the config barrel's module wiring.
import { macosObservationSchema, macosDoctorSchema } from '../../config/schema/computer/computer.schema.js';
import type { ComputerAction, ComputerSnapshot } from '@/config';
const executeFile = promisify(execFile);
@Injectable()
export class MacosService {
  private used = false;
  constructor(private readonly config: ConfigService) {}
  private async run(args: string[], signal: AbortSignal): Promise<unknown> {
    if (process.platform !== 'darwin')
      throw new ServiceUnavailableException(
        'Native desktop access currently supports macOS only.',
      );
    signal.throwIfAborted();
    try {
      const binary =
        this.config.get<string>('COMPUTER_MACOS_BINARY') ||
        resolve('.computer-venv/bin/macos-harness');
      // Deliberately do not pass API keys, application secrets, or shell commands.
      this.used = true;
      const { stdout } = await executeFile(binary, [...args, '--json'], {
        shell: false,
        signal,
        timeout: 12000,
        maxBuffer: 512000,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          MACOS_HARNESS_HOME: resolve('.computer-runtime/macos'),
          DO_NOT_TRACK: '1',
          ANONYMIZED_TELEMETRY: 'false',
        },
      });
      this.used = true;
      return JSON.parse(stdout);
    } catch (error) {
      signal.throwIfAborted();
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new ServiceUnavailableException(
          'Install the macOS adapter using the README setup command.',
        );
      throw new ServiceUnavailableException(
        'The Mac action could not be confirmed. Check adapter permissions and the app before trying again.',
      );
    }
  }
  async doctor(signal: AbortSignal) {
    return this.run(['doctor'], signal);
  }
  async observe(app: string, signal: AbortSignal): Promise<ComputerSnapshot> {
    const doctor = macosDoctorSchema.parse(await this.doctor(signal));
    if (!doctor.ready)
      throw new ServiceUnavailableException(
        'Grant Accessibility and Screen Recording to the app running Agentic in macOS System Settings, then reconnect.',
      );
    const state = macosObservationSchema.parse(
      await this.run(['get_app_state', '--app', app, '--disableDiff'], signal),
    );
    return {
      text: state.text.slice(0, 32000),
      fingerprint: createHash('sha256').update(state.text).digest('hex'),
    };
  }
  async act(app: string, action: ComputerAction, signal: AbortSignal) {
    const args =
      action.kind === 'click'
        ? ['click', '--element_index', String(action.index)]
        : action.kind === 'type'
          ? [
              'set_value',
              '--element_index',
              String(action.index),
              '--value',
              action.value!,
            ]
          : action.kind === 'key'
            ? [
                'press_key',
                '--key',
                action.value === 'Enter' ? 'Return' : action.value!,
              ]
            : action.kind === 'scroll'
              ? [
                  'scroll',
                  '--element_index',
                  String(action.index),
                  '--direction',
                  action.value!,
                  '--pages',
                  '1',
                ]
              : undefined;
    if (!args)
      throw new ServiceUnavailableException('Unsupported desktop action.');
    await this.run([...args, '--app', app], signal);
  }
  async close() {
    if (!this.used) return;
    this.used = false;
    const binary =
      this.config.get<string>('COMPUTER_MACOS_BINARY') ||
      resolve('.computer-venv/bin/macos-harness');
    await executeFile(binary, ['helper', 'stop'], {
      shell: false,
      timeout: 5000,
      maxBuffer: 4096,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        MACOS_HARNESS_HOME: resolve('.computer-runtime/macos'),
        DO_NOT_TRACK: '1',
      },
    });
  }
}
