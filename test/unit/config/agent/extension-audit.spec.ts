import {
  auditedTool,
  auditSnapshot,
} from '../../../../src/config/agent/tools/tool-policy.js';

describe('extension auditing', () => {
  it('redacts credentials nested in JSON tool arguments', () => {
    expect(
      auditSnapshot({
        argumentsJson: JSON.stringify({
          password: 'private-value',
          text: 'hello',
        }),
      }),
    ).toEqual({ argumentsJson: { password: '[redacted]', text: 'hello' } });
  });
  it('records a proposed action as pending, not executed', async () => {
    const sink = vi.fn();
    await auditedTool(
      'scope',
      'trace',
      'mcp_call_tool',
      {},
      sink,
      async () => ({ status: 'pending' }),
    );
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', tier: 'write' }),
    );
  });
});
