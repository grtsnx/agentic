import {
  auditedTool,
  permissionFor,
  requiresApproval,
} from '../../../../src/config/agent/tools/tool-policy.js';

describe('tool policy and audit', () => {
  it('fails closed for unknown tools and gates side effects', () => {
    for (const name of [
      'arbitrary_shell',
      '__proto__',
      'constructor',
      'toString',
    ])
      expect(() => permissionFor(name)).toThrow('TOOL_NOT_ALLOWED');
    for (const tool of [
      'execute_code',
      'delete_file',
      'send_message',
      'make_payment',
    ])
      expect(requiresApproval(permissionFor(tool))).toBe(true);
    expect(requiresApproval(permissionFor('context_dev_search'))).toBe(false);
  });
  it('records redacted input, bounded output, duration and unknown provider cost', async () => {
    const sink = vi.fn();
    await auditedTool(
      'scope',
      'trace',
      'context_dev_search',
      { apiKey: 'secret', input: 'query' },
      sink,
      async () => ({ text: 'x'.repeat(5000) }),
    );
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { apiKey: '[redacted]', input: 'query' },
        output: expect.objectContaining({ truncated: true }),
        durationMs: expect.any(Number),
        cost: { usd: null, kind: 'unknown', currency: 'USD' },
      }),
    );
  });
  it('records thrown and nonzero-exit failures', async () => {
    const sink = vi.fn();
    await expect(
      auditedTool('scope', 'trace', 'retrieve_files', {}, sink, async () => {
        throw new Error('secret provider failure');
      }),
    ).rejects.toThrow();
    expect(sink.mock.calls[0][0]).toMatchObject({
      status: 'failed',
      errorCode: 'TOOL_FAILED',
      output: null,
    });
    await auditedTool('scope', 'trace', 'execute_code', {}, sink, async () => ({
      exitCode: 1,
      stderr: 'bad syntax',
    }));
    expect(sink.mock.calls[1][0]).toMatchObject({
      status: 'failed',
      errorCode: 'SANDBOX_EXIT_NONZERO',
    });
  });
});
