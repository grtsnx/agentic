// Pinned runtime, never a model-controlled image or Docker argument.
export const SANDBOX_IMAGE = 'node:26.12.1-bookworm-slim@sha256:28147155d47dc31abe0a46e0d12b59b2fb3d0a2dcc5dc65fce76a074180b16fe';
export function sandboxArguments(name: string): string[] {
  return ['run','--rm','--interactive',`--name=${name}`,'--label=agentic.sandbox=true','--pull=never',
    '--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges',
    '--memory=128m','--memory-swap=128m','--cpus=0.5','--pids-limit=32','--user=65534:65534',
    '--ulimit=cpu=5:5','--ulimit=nofile=64:64','--ulimit=fsize=8388608:8388608',
    '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=16m,mode=1777','--workdir=/tmp',
    SANDBOX_IMAGE,'node','--max-old-space-size=64','--input-type=module'];
}
