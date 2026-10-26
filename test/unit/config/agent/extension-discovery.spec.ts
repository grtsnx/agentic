import { ConfigService } from '@nestjs/config';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AgentExtensionsService } from '@/config';
import { OpenaiService } from '@/lib';

it('answers MCP availability from configuration without asking permission or invoking a model', async () => {
  const root = await mkdtemp(join(tmpdir(), 'capability-list-'));
  try {
    const path = join(root, 'extensions.json');
    await writeFile(
      path,
      JSON.stringify({
        servers: [
          {
            id: 'internal_id',
            displayName: 'Example documentation',
            description: 'Search reference pages.',
            transport: 'http',
            url: 'https://example.com/mcp',
            allowedTools: ['private_function'],
          },
        ],
      }),
    );
    const settings = {
      AGENT_EXTENSIONS_ENABLED: true,
      AGENT_EXTENSIONS_FILE: path,
    };
    const extensions = AgentExtensionsService.fromEnvironment(settings);
    const service = new OpenaiService(
      new ConfigService(settings),
      undefined,
      undefined,
      extensions,
    );
    const reply = await service.generateReply(
      'which mcp do you have access to right now?',
    );
    expect(reply.message).toContain('Example documentation');
    expect(reply.message).not.toMatch(
      /internal_id|private_function|permission|want me/,
    );
    expect(reply.runtime.models).toEqual([]);
    expect(reply.runtime.tokens.total).toBe(0);
    const session = service.createSession();
    const events = [];
    for await (const event of service.streamReply(
      'which mcp do you have access to right now?',
      { session },
    ))
      events.push(event);
    expect(events.at(-1)).toMatchObject({
      type: 'completed',
      response: { message: reply.message },
    });
    expect(await session.getItems()).toHaveLength(2);
    expect(
      await extensions.describeAvailable(
        'Which MCP can you use to delete files?',
        new AbortController().signal,
      ),
    ).toBeUndefined();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
