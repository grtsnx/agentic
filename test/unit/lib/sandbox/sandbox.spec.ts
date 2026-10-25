import { sandboxArguments } from '../../../../src/config/sandbox/sandbox-policy.js';
describe('sandbox boundary', () => {
  it('disables networking, host mounts, privilege, swap and writable root', () => {
    const args=sandboxArguments('agentic-sandbox-test');
    expect(args).toEqual(expect.arrayContaining(['--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--memory=128m','--memory-swap=128m','--cpus=0.5','--pids-limit=32','--user=65534:65534','--pull=never']));
    expect(args.some(x=>x.startsWith('--volume')||x.startsWith('--env')||x.startsWith('--mount'))).toBe(false);
    expect(args).toContain('--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=16m,mode=1777');
  });
});
