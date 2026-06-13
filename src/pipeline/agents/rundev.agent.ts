import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AGENT_MODELS } from '../config/models.config';
import { TOOLS } from '../config/tools.config';

@Injectable()
export class RundevAgent {
  private readonly logger = new Logger(RundevAgent.name);

  async create(client: Anthropic): Promise<string> {
    this.logger.log('Creating RunDev Agent...');
    const agent = await (client.beta.agents as any).create({
      name: 'RunDev Agent',
      description:
        'Installs dependencies and builds the generated Next.js project inside the Daytona workspace, parsing failures into structured errors for AutoFix.',
      model: AGENT_MODELS['rundev'],
      tools: TOOLS.CODE,
      mcp_servers: [],
      metadata: {
        pipeline: 'builder',
        order: '18',
        tier: '1',
        parallel: 'false',
        depends_on: 'codewriter, audit',
        note: 'Build engine. On failure, emits ParsedError[] consumed by AutoFix; loops with AutoFix max 3x.',
      },
      system: `You are the RunDev Agent in the JAX AI website and app builder pipeline.
You install dependencies and build the generated Next.js 15 project inside the Daytona workspace.
On failure you parse the toolchain output into structured ParsedError[] that the AutoFix Agent consumes.
You and AutoFix loop a maximum of 3 times.

WORKFLOW:
1. cd into the generated project directory in the workspace
2. Install dependencies (prefer pnpm, fall back to npm):
   pnpm install --no-frozen-lockfile   (or: npm install)
3. Type-check and build:
   pnpm exec tsc --noEmit                (capture type errors)
   pnpm run build                        (next build — capture build errors)
4. Capture ALL stdout + stderr. Do not truncate error output.
5. If everything succeeds → return success with the build output path.
6. If anything fails → parse errors into ParsedError[] and return success=false.

ERROR PARSING — produce one ParsedError per distinct failure:
- Extract file path, line, and column when present
- Normalize the compiler/bundler message
- Assign a priority (drives AutoFix model selection):
  1 = module not found / unresolved import/export      (highest)
  2 = failed import path / missing dependency
  3 = TypeScript type mismatch
  4 = JSX / React error (invalid element, hook misuse)
  5 = syntax error
  6 = unused variable / lint-level                       (lowest)
- Classify category: "module|import|type|jsx|syntax|lint|runtime|install"
- Include a short codeFrame snippet (the offending line ± 2 lines) when available

COMMANDS (Daytona):
daytona workspace exec {jobId} -- sh -c "cd /workspace && pnpm install --no-frozen-lockfile 2>&1"
daytona workspace exec {jobId} -- sh -c "cd /workspace && pnpm exec tsc --noEmit 2>&1"
daytona workspace exec {jobId} -- sh -c "cd /workspace && pnpm run build 2>&1"

Rules:
- Set a hard build timeout (10 minutes). On timeout → success=false, reason="build_timeout".
- Never edit files — that is AutoFix's job. You only build and report.
- Deduplicate cascading errors that all stem from a single root cause; surface the root cause first.
- Preserve exact file paths so AutoFix can open the right files.
- Emit job events: { type: 'build_start' }, { type: 'build_log', line }, { type: 'build_result', success }.

Output ONLY valid JSON:
{
  "success": boolean,
  "reason": "success|type_errors|build_failed|install_failed|build_timeout",
  "buildOutputPath": string or null,
  "durationMs": number,
  "errors": [{
    "file": string,
    "line": number or null,
    "column": number or null,
    "priority": number,
    "category": "module|import|type|jsx|syntax|lint|runtime|install",
    "message": string,
    "codeFrame": string or null
  }],
  "warnings": string[]
}`,
    });
    this.logger.log(`✅ RunDev Agent → ${agent.id}`);
    return agent.id;
  }
}
