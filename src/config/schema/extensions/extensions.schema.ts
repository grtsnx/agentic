import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const envName = z.string().regex(/^[A-Z][A-Z0-9_]*$/);
const serverFields = {
  id,
  description: z.string().min(1).max(500),
  allowedTools: z.array(z.string().min(1).max(128)).min(1).max(50),
  safeReadTools: z.array(z.string().min(1).max(128)).max(50).default([]),
  timeoutMs: z.number().int().min(1000).max(30000).default(10000),
};
export const mcpServerConfigSchema = z
  .discriminatedUnion('transport', [
    z
      .object({
        ...serverFields,
        transport: z.literal('http'),
        url: z.url().refine((value) => {
          const url = new URL(value);
          return (
            !url.username &&
            !url.password &&
            !url.hash &&
            !url.search &&
            (url.protocol === 'https:' ||
              (url.protocol === 'http:' &&
                ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
          );
        }, 'Use HTTPS, or HTTP on loopback, with credentials supplied through header environment variables.'),
        headersEnv: z
          .record(z.string().regex(/^[A-Za-z0-9-]+$/), envName)
          .default({}),
      })
      .strict(),
    z
      .object({
        ...serverFields,
        transport: z.literal('stdio'),
        command: z.string().min(1).max(500),
        args: z.array(z.string().max(1000)).max(32).default([]),
        env: z.record(envName, envName).default({}),
      })
      .strict(),
  ])
  .refine(
    (server) =>
      server.safeReadTools.every((name) => server.allowedTools.includes(name)),
    'Safe reads must be explicitly allowed tools.',
  );
export const extensionsConfigSchema = z
  .object({
    servers: z.array(mcpServerConfigSchema).max(8).default([]),
    skills: z.array(z.string().min(1).max(500)).max(32).default([]),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.servers.map((server) => server.id)).size ===
      value.servers.length,
    'Duplicate MCP server IDs.',
  );

export const skillMetadataSchema = z
  .object({ name: id, description: z.string().min(1).max(1024) })
  .passthrough();
export const mcpActionSchema = z
  .object({
    tool: z.literal('mcp_call_tool'),
    server: id,
    name: z.string().min(1).max(128),
    argumentsJson: z.string().max(16000),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const extensionInputSchema = z
  .object({
    action: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('list_mcp_servers') }).strict(),
      z.object({ kind: z.literal('list_mcp_tools'), server: id }).strict(),
      z
        .object({
          kind: z.literal('call_mcp_tool'),
          server: id,
          name: z.string().min(1).max(128),
          argumentsJson: z.string().max(16000),
        })
        .strict(),
      z.object({ kind: z.literal('list_skills') }).strict(),
      z
        .object({
          kind: z.literal('install_skill'),
          source: z.string().url().max(1000),
          skill: z
            .string()
            .max(200)
            .nullable()
            .describe(
              'Skill name when selecting from a repository, otherwise null.',
            ),
        })
        .strict(),
      z
        .object({
          kind: z.literal('read_skill'),
          name: id,
          file: z
            .string()
            .min(1)
            .max(200)
            .describe(
              'SKILL.md or a relative Markdown/text reference inside the skill.',
            ),
        })
        .strict(),
    ]),
  })
  .strict();
