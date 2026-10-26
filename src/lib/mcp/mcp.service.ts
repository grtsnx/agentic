import { Injectable, Logger } from '@nestjs/common';
import {
  MCPServerStdio,
  MCPServerStreamableHttp,
  type MCPServer,
} from '@openai/agents';
import { createHash } from 'node:crypto';
import type { McpAction, McpServerConfig } from '@/config';
// Provider leaf imports avoid config -> lib -> OpenAI -> config initialization cycles.
import { withinToolDeadline } from '../../config/agent/tools/web/web-tool.policy.js';

@Injectable()
export class McpService {
  private active = 0;
  private readonly logger = new Logger(McpService.name);
  private readonly sdkLogger = {
    namespace: 'agentic:mcp',
    dontLogModelData: true,
    dontLogToolData: true,
    debug: () => {},
    warn: () =>
      this.logger.warn('MCP transport warning; check server availability.'),
    error: () =>
      this.logger.error('MCP transport failed; check server configuration.'),
  };
  private normalize(
    config: McpServerConfig,
    tool: Awaited<ReturnType<MCPServer['listTools']>>[number],
  ) {
    const normalized = {
      name: tool.name,
      description: tool.description?.slice(0, 1000),
      inputSchema: tool.inputSchema,
      approvalRequired: !config.safeReadTools.includes(tool.name),
    };
    if (JSON.stringify(normalized).length > 16000)
      throw new Error('MCP_SCHEMA_TOO_LARGE');
    return normalized;
  }
  private values(mapping: Record<string, string>) {
    return Object.fromEntries(
      Object.entries(mapping).map(([key, variable]) => {
        const value = process.env[variable];
        if (!value) throw new Error('MCP_CREDENTIAL_MISSING');
        return [key, value];
      }),
    );
  }
  private client(config: McpServerConfig, signal: AbortSignal): MCPServer {
    const common = {
      logger: this.sdkLogger,
      name: config.id,
      timeout: config.timeoutMs,
      clientSessionTimeoutSeconds: config.timeoutMs / 1000,
      maxListPages: 2,
      cacheToolsList: false,
    };
    return config.transport === 'http'
      ? new MCPServerStreamableHttp({
          ...common,
          url: config.url,
          requestInit: {
            headers: this.values(config.headersEnv),
            redirect: 'error',
          },
          // Abort applies to connection/discovery too, not just the final tool call.
          fetch: (url: string | URL | Request, init?: RequestInit) =>
            fetch(url, {
              ...init,
              redirect: 'error',
              signal: AbortSignal.any([
                signal,
                ...(init?.signal ? [init.signal] : []),
              ]),
            }),
          reconnectionOptions: { maxRetries: 0 },
        })
      : new MCPServerStdio({
          ...common,
          command: config.command,
          args: config.args,
          env: {
            ...Object.fromEntries(
              ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'SystemRoot'].flatMap((key) =>
                process.env[key] ? [[key, process.env[key]!]] : [],
              ),
            ),
            ...this.values(config.env),
          },
        });
  }
  private async using<T>(
    config: McpServerConfig,
    external: AbortSignal,
    action: (client: MCPServer, signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    external.throwIfAborted();
    if (this.active >= 4) throw new Error('MCP_BUSY');
    const signal = AbortSignal.any([
      external,
      AbortSignal.timeout(config.timeoutMs),
    ]);
    const client = this.client(config, signal);
    this.active++;
    try {
      return await withinToolDeadline(signal, async () => {
        await client.connect();
        signal.throwIfAborted();
        return action(client, signal);
      });
    } finally {
      try {
        await withinToolDeadline(AbortSignal.timeout(2000), () =>
          client.close(),
        );
      } finally {
        this.active--;
      }
    }
  }
  async list(config: McpServerConfig, signal: AbortSignal) {
    return this.using(config, signal, async (client) => {
      const tools = await client.listTools();
      const catalog = tools
        .filter((item) => config.allowedTools.includes(item.name))
        .slice(0, 50)
        .map((item) => this.normalize(config, item));
      if (JSON.stringify(catalog).length > 64000)
        throw new Error('MCP_CATALOG_TOO_LARGE');
      return catalog;
    });
  }
  async prepare(
    config: McpServerConfig,
    name: string,
    argumentsJson: string,
    signal: AbortSignal,
  ): Promise<McpAction> {
    this.arguments(argumentsJson);
    const tool = (await this.list(config, signal)).find(
      (item) => item.name === name,
    );
    if (!tool) throw new Error('MCP_TOOL_NOT_ALLOWED');
    return {
      tool: 'mcp_call_tool',
      server: config.id,
      name,
      argumentsJson,
      fingerprint: this.fingerprint(config, tool),
    };
  }
  async execute(
    config: McpServerConfig,
    action: McpAction,
    signal: AbortSignal,
  ) {
    if (
      action.server !== config.id ||
      !config.allowedTools.includes(action.name)
    )
      throw new Error('MCP_TOOL_NOT_ALLOWED');
    const args = this.arguments(action.argumentsJson);
    return this.using(config, signal, async (client, signal) => {
      const definition = (await client.listTools()).find(
        (item) => item.name === action.name,
      );
      const normalized = definition && this.normalize(config, definition);
      // Approval binds the tool contract, destination and credentials as well as its arguments.
      if (
        !normalized ||
        this.fingerprint(config, normalized) !== action.fingerprint
      )
        throw new Error('MCP_TOOL_CHANGED');
      signal.throwIfAborted();
      const result = await client.callToolResult!(
        action.name,
        args,
        undefined,
        { signal },
      );
      if (result.isError) throw new Error('MCP_TOOL_FAILED');
      // Never dereference resource URLs or execute code returned by a server.
      const text = JSON.stringify({
        content: result.content,
        structuredContent: result.structuredContent,
      });
      return {
        contentTrust: 'untrusted',
        text: text.slice(0, 32000),
        truncated: text.length > 32000,
      };
    });
  }
  private fingerprint(config: McpServerConfig, tool: unknown) {
    const credentials = this.values(
      config.transport === 'http' ? config.headersEnv : config.env,
    );
    return createHash('sha256')
      .update(JSON.stringify({ config, credentials, tool }))
      .digest('hex');
  }
  private arguments(value: string): Record<string, unknown> {
    if (value.length > 16000) throw new Error('MCP_INPUT_TOO_LARGE');
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('MCP_ARGUMENTS_MUST_BE_OBJECT');
    return parsed as Record<string, unknown>;
  }
}
