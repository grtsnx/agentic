# Agentic

An OpenAI-powered agent built with NestJS: streaming chat, REST, CLI, LiveKit voice, tools, and reusable skills. Sessions, files, and approvals are held in memory and disappear on restart. No database or Redis yet.

## Quick start

Requires Node.js 24+ and Bun 1.3.14.

```bash
cp .env.example .env # First setup only; preserve an existing .env.
bun install --frozen-lockfile
```

Add `OPENAI_API_KEY` to `.env`, then run:

```bash
bun run start:dev
```

This starts the API and, when `VOICE_ENABLED=true`, the LiveKit worker. Ctrl+C stops both. Use `bun run start:dev:api` for API-only development. Restart after changing `.env`; do not start a second voice worker alongside the combined command.

| Interface  | URL or command                                                |
| ---------- | ------------------------------------------------------------- |
| Playground | [localhost:3001/playground](http://localhost:3001/playground) |
| Swagger    | [localhost:3001/api](http://localhost:3001/api)               |
| Scalar     | [localhost:3001/docs](http://localhost:3001/docs)             |
| Text CLI   | `bun run chat`                                                |

## Configuration

Use one local `.env`. See [.env.example](.env.example) for validated settings, provider keys, timeouts, and session limits. Keep secrets out of version control. Set `CORS_ORIGINS` to exact browser origins, such as `http://localhost:3001`.

Chat routes simple requests to GPT-5 Nano and complex work to GPT-6 Luna. Clef routing is optional; keep `CLEF_ROUTING_ENABLED=false` until `bun run benchmark:routing` passes the latency and billing gates. Responses show input/output tokens and estimated model cost; external tool charges are separate.

Optional web providers use their enable flag and API key: Context.dev for lookups, Firecrawl for page reading, and Valyu for research. Suitable alternatives are allowed. `WEB_SEARCH_ALLOWED_DOMAINS` restricts search domains.

## Using the agent

- **Chat:** the playground uses Agentic's custom UI with a ChatKit backend. Use history to continue conversations and the pencil to edit a message. Editing replaces subsequent replies; completed actions are not undone.
- **Files:** use **+** to attach multiple JPG, PNG, PDF, DOCX, or text files. Click to preview or **×** to remove. Limits: five files, 1 MiB each, 2 MiB per workspace. Scanned PDF OCR is not supported.
- **Approvals:** review the exact action, scope, and risk, then choose **Approve once** or **Deny**. Approvals expire after five minutes. Do not replay an action automatically after a network failure.
- **CLI:** use `/workspace`, `/attach PATH`, `/actions`, `/approve ID`, `/deny ID`, `/cancel ID`, and `/exit`.
- **API:** Swagger and Scalar document chat, sessions, files, workspaces, and approvals. Socket.IO uses `/v1/chat`: send `chat.send` or `chat.cancel`; receive `chat.status`, `chat.delta`, `chat.completed`, and `chat.error`.

## Voice

In [LiveKit Cloud](https://cloud.livekit.io/), select your project, open **Manage API keys**, and copy the project URL, key, and secret into `.env`:

```env
VOICE_ENABLED=true
VOICE_PROVIDER=livekit
VOICE_MODEL=gpt-realtime-2.1-mini
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-livekit-key
LIVEKIT_API_SECRET=your-livekit-secret
LIVEKIT_AGENT_NAME=agentic-voice
```

Alternatively, after `lk cloud auth`, run `lk app env --write --destination .env --project YOUR_PROJECT`. Preserve existing settings; do not use `--overwrite`.

Run `bun run start:dev`, click the composer microphone, and allow microphone access. Both the API and worker must run. Use `VOICE_PROVIDER=openai` for direct OpenAI inference through LiveKit, or `livekit` for LiveKit Cloud inference. Start a new conversation after changing voice settings.

For terminal voice, install the [LiveKit CLI](https://docs.livekit.io/reference/developer-tools/livekit-cli/) and run `bun run voice:console`. Use `bun run voice:devices` to list devices. macOS microphone/playback is verified; Windows/Linux hardware validation remains pending.

Cloud traces are available under **Sessions → Agent insights** when Agent Observability is enabled. Worker audio/transcript retention is disabled. Telephony still requires an approved number purchase and SIP setup; `LIVEKIT_PHONE_NUMBER` only prints an already-provisioned number.

## Installing MCP servers and skills

**Install skills through playground chat:** paste a public GitHub skill-folder link or a [skills.sh](https://skills.sh) skill link and ask the agent to install it. Review the source, pinned commit, file list, and instruction preview, then choose **Approve once**. MCP servers still require manual registration. Uploading a `SKILL.md` as an attachment does not install it.

Enable extensions in the existing `.env`:

```env
AGENT_EXTENSIONS_ENABLED=true
AGENT_EXTENSIONS_FILE=agent-extensions.json
AGENT_SKILL_INSTALL_ENABLED=true
```

For example: **“Install https://skills.sh/vercel-labs/agent-skills/web-design-guidelines.”** GitHub links such as `https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines` also work. Repository-only links need a skill name when they contain multiple skills.

Installation is available only in development, with approval from the localhost playground or local CLI workspace. It writes Markdown/text files under `skills/installed/`, available to all local chats and voice immediately. Scripts and other assets are omitted; existing skills are never overwritten. Public repositories only, with at most 32 document files, 64 KB each and 256 KB total. These limits mean some skill packages are not supported. Inspect third-party instructions before approving; installation does not grant tools or permissions. [skills.sh documentation](https://skills.sh/docs) explains the source format.

If an interrupted process leaves `skills/installed/.install.lock`, stop the API/worker before removing that lock and any `.pending-*` folders. Installed skill folders persist locally and are ignored by Git.

### Add an MCP server

**Remote server:** no local package is needed. Add its Streamable HTTP endpoint to the `servers` array in [agent-extensions.json](agent-extensions.json). The included OpenAI documentation entry is a working example. Use the provider's exact tool names in `allowedTools`. For authenticated servers, add an environment reference:

```json
"headersEnv": { "Authorization": "MY_MCP_AUTHORIZATION" }
```

Store the complete header value in `.env`, for example `MY_MCP_AUTHORIZATION="Bearer your-token"`. OAuth-only connections are not supported yet.

**Local stdio server:** install the server on the same machine as Agentic using its publisher's instructions and a pinned version. For a Node package, the command template is `bun add --exact PACKAGE@VERSION`. Then append a server entry like this, replacing the example package path, tool name, and credential variable with the publisher's values:

```json
{
  "id": "my_integration",
  "description": "Describe what this integration does.",
  "transport": "stdio",
  "command": "node",
  "args": ["node_modules/your-mcp-package/dist/index.js"],
  "env": { "API_KEY": "MY_MCP_API_KEY" },
  "allowedTools": ["your_tool_name"],
  "safeReadTools": [],
  "timeoutMs": 10000
}
```

`env` maps the server's variable names to variables in Agentic's `.env`; omit it when unnecessary. Python or native servers use their installed executable and arguments instead. Use a trusted, preinstalled server: starting a local MCP process executes its code, independently of tool approvals.

Only tools you explicitly put in `safeReadTools` run automatically. Other calls require workspace approval. In the CLI, enter `/workspace`, inspect `/actions`, then use `/approve ID` or `/deny ID`. Voice cannot approve privileged actions. Calls have timeouts and budgets; MCP connection-local state is not retained between operations.

### Add a skill manually

Copy a reviewed skill folder into `skills/`, including its reference files, or create `skills/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: Explain when the agent should use this skill.
---

Write focused instructions here. Reference supporting files with relative paths.
```

Append `"skills/my-skill"` to the manifest's existing `skills` array. Keep the included `"skills/code-review"` entry if wanted. Names must be unique lowercase letters, numbers, hyphens, or underscores. The agent can read relative `.md` and `.txt` references inside the registered folder. Skill scripts do not execute. Remote installation uses the approval flow above.

### Restart and try it

Restart `bun run start:dev` after changing `.env` or the manifest. In the playground, try **“Use the code-review skill to review this code”** or **“Use the documentation integration to find the Responses API streaming guide.”** The agent loads relevant skill instructions and discovers configured MCP tools on demand. Simple availability questions are answered directly from configuration without model charges; configured access does not certify live server reachability.

`bun run smoke:extensions` checks the bundled documentation server and code-review skill; it does not validate every custom integration. Test each new integration with a harmless read before approving actions. For Docker, packages and skill folders must exist inside the container: rebuild the image or mount configuration/skills read-only at the configured paths.

## Computer access and code execution

**Local browser/Mac apps:** set `COMPUTER_ENABLED=true`, configure `COMPUTER_BROWSER_DOMAINS` and `COMPUTER_ALLOWED_APPS`, then connect through the playground's computer icon. Browser mode requires Google Chrome. Mac app access additionally requires the native adapter:

```bash
uv venv .computer-venv --python 3.12
uv pip install --python .computer-venv/bin/python macos-harness==0.2.1
```

Grant Accessibility and Screen Recording to the application launching Agentic in macOS settings. Actions require approval and affect your real computer. Use **Stop & disconnect** to revoke access. This is localhost-only, disabled in production, and not a sandbox. Cloud VMs and Windows/Linux desktop control remain pending.

**Code sandbox:** requires local Docker and `SANDBOX_ENABLED=true`. Pull the pinned image first:

```bash
docker pull node:26.12.1-bookworm-slim@sha256:28147155d47dc31abe0a46e0d12b59b2fb3d0a2dcc5dc65fce76a074180b16fe
```

JavaScript runs after approval with no network or host mounts, a read-only root, 0.5 CPU, 128 MiB memory, and an eight-second lifetime. Try **“Propose running console.log(2 + 2), and wait for approval.”** Compose disables this feature; do not mount the Docker socket into the application container.

## Testing

All tests live under `test/`.

```bash
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run test:e2e
bun run build
```

Explicit integration checks:

```bash
bun run smoke:provider   # Real OpenAI response; provider charges apply.
bun run smoke:tools      # Enabled web providers; provider charges may apply.
bun run smoke:extensions # Public MCP server and bundled skill; no model call.
# After building, with Docker and the pinned image installed:
RUN_SANDBOX_SMOKE=true node test/smoke/sandbox.smoke.mjs
# After building, import a public skill into a temporary directory:
node test/smoke/skill-install.smoke.mjs
# After building, with the API and voice worker running:
RUN_VOICE_SMOKE=true node --env-file=.env test/smoke/voice.smoke.mjs
```

The voice smoke test checks dispatch, transcript, and received audio, not physical microphone/speaker operation. More opt-in checks are in [test/smoke](test/smoke); model and provider checks may incur charges.

## Docker and deployment

```bash
docker compose up --build -d --wait                 # API
docker compose --profile voice up --build -d --wait # API and voice
docker compose --profile voice down
```

Compose uses `.env` and binds the API to localhost:3001. It does not start a self-hosted LiveKit media server. Stop a standalone voice worker before switching to Compose.

[CI](.github/workflows/ci.yml) runs checks and image scans. The [release workflow](.github/workflows/release.yml) publishes images for semantic-version tags; configure production environment protections before releasing.

This is a single-instance development platform. Before public deployment, add authentication, tenant isolation, quotas, persistent state, TLS, and access controls for developer UIs. Model costs are estimates, and in-memory state is not durable.

## Project structure

```text
src/
├── app/                  # Root application and health endpoints.
├── bootstrap/            # Security, validation, docs, and startup.
├── cli/                  # Terminal interface.
├── config/               # Instructions, tools, skills, schemas/types, playground, and voice setup.
├── dto/                  # API input/output contracts.
├── lib/                  # External provider integrations.
├── middleware/           # Filters, interceptors, errors, and shared utilities.
├── modules/              # Feature modules in v1/; reserved v2/ boundary.
└── main.ts               # HTTP entry point; cli.ts, dev.ts, and voice.ts serve other runtimes.
test/                     # Unit, end-to-end, and opt-in smoke tests.
skills/                   # Bundled skills and approved local installs in installed/.
agent-extensions.json     # MCP allowlists and registered skills.
compose.yaml              # Local services built with Dockerfile.
AGENTS.md                 # Architecture and contribution rules.
```

## Roadmap

<details>
<summary>View completed work and upcoming capabilities</summary>

Ordered from foundations to advanced capabilities. ✅ Verified complete · ⬜ Remaining work.

### 1. Foundations and configuration

- ✅ Validate environment variables before application startup.
- ✅ Apply security headers, explicit CORS origins, CSRF protection, validation, and rate limits globally.
- ✅ Return one safe response format for successes and failures, with a request ID on every response.
- ✅ Expose liveness and readiness endpoints without database, Redis, or public-network dependencies.
- ✅ Keep unit and end-to-end tests under categorized `test/` folders.
- ✅ Keep LiveKit SDK integration under `lib/` and expose voice through the v1 module.
- ✅ Run formatting, linting, type checks, tests, audits, application builds, and container scans in CI.

### 2. Basic REST chat

- ✅ Keep v1 chat isolated while reserving a clean v2 boundary for future contract changes.
- ✅ Expose the validated `POST /v1/chat` endpoint without copying it into v2.
- ✅ Wrap the OpenAI Agents SDK behind a shared NestJS service.
- ✅ Return token usage, model/tool calls, and clearly labelled cost estimates.
- ✅ Route lightweight work to GPT-5 Nano and promote complex work only as high as GPT-6 Luna.
- ✅ Add optional Clef-flash routing with bounded context, timeout, validated decisions, and local fallback.
- ✅ Measure Clef accuracy, latency, fallback rate, and reported usage against real Cloudflare responses.
- ⬜ Reconcile actual Clef billed cost and meet the latency rollout gate before enabling it by default.
- ✅ Document each API version in Swagger, Scalar, and OpenAPI JSON.
- ✅ Verify a real provider response with a documented local smoke-test command.
- ✅ Map provider authentication, timeout, rate-limit, and availability failures to stable application errors.

### 3. CLI, Socket.IO streaming, and LiveKit voice

- ✅ Add a CLI that uses the same application services as the REST API.
- ✅ Stream model output over the CLI and a versioned Socket.IO namespace.
- ✅ Provide an embedded same-origin playground; keep Socket.IO available to API clients.
- ✅ Use ChatKit in the main Agentic UI with shared execution, thread history, citations, usage, and inline approvals.
- ✅ Support scoped multi-file uploads and previews with the existing LiveKit composer entry point.
- ✅ Add LiveKit Cloud voice with environment-switched LiveKit Inference and direct OpenAI adapters.
- ✅ Issue short-lived, room-scoped, microphone-only voice tokens without exposing secrets.
- ✅ Run a named TypeScript voice worker with shared chat/voice instructions.
- ✅ Show participant-aware listening, thinking, speaking, transcript, and connection states.
- ✅ Drive the bar visualizer and separate participant meters from live audio, with responsive controls and reduced-motion support.
- ✅ Document Cloud credentials and print the configured telephony number at startup.
- ✅ Cancel active CLI and Socket.IO turns without persisting partial sessions.
- ✅ Display tokens, estimated cost, model calls, tool calls, and safe provider errors.
- ✅ Add configurable model timeouts and explicit non-zero CLI exit codes.
- ✅ Add a native LiveKit voice console command with explicit `.env` loading and verify a synthetic audio conversation.
- ✅ Validate human microphone capture and audible replies on macOS (user confirmed, 2026-10-25).
- ✅ Validate the Linux ARM64 Compose image: API health, playground delivery, native voice bindings, and LiveKit Cloud worker registration (2026-10-25).
- ✅ Run the Windows/Linux CI matrix to verify builds, tests, and native voice-worker loading (user confirmed, 2026-10-25).
- ⬜ Validate human microphone capture on Windows and Linux before marking cross-platform voice CLI input complete; test machines are not yet available.
- ⬜ Add telephony only after an explicitly approved phone-number purchase and SIP dispatch design.
- ✅ Display human approval requests when privileged tools are introduced.

### 4. Structured outputs and conversation sessions

- ✅ Define schema-validated structured outputs for tasks that need machine-readable results.
- ✅ Add in-memory Socket.IO and CLI sessions without claiming durability.
- ✅ Support session creation, continuation, expiration, and deletion.
- ✅ Enforce token and turn limits, and summarize context before it exceeds its budget.
- ✅ Test concurrent session isolation and malformed model output.

### 5. Tools, skills, web, files, and code

- ✅ Add configured MCP HTTP/stdio tools with allowlists, timeouts, cancellation, bounded outputs, audits, and single-use approvals.
- ✅ Load registered SKILL.md instructions and scoped references across chat, CLI, and voice without executing skill scripts.
- ✅ Verify approved GitHub and skills.sh installation, pinned content, atomic writes, and localhost-only approval.
- ✅ Verify public documentation MCP discovery/search and local skill loading (`bun run smoke:extensions`).

- ✅ Add web search with citations, source metadata, domain controls, and timeout limits.
- ✅ Add optional Context.dev web search through its official SDK.
- ✅ Add optional Firecrawl page reading through its official SDK.
- ✅ Add optional Valyu web research through its official SDK.
- ✅ Share optional tools across chat and voice with validated inputs, domain controls, bounded results, call budgets, and stable errors.
- ✅ Add page retrieval that treats remote content as untrusted data rather than instructions.
- ✅ Verify Context.dev search and Firecrawl page reading with real API keys, non-empty content, and source metadata (`bun run smoke:tools`, 2026-10-25).
- ✅ Configure Valyu and verify real search content and source metadata with its live smoke test (2026-10-25).
- ✅ Share flexible provider preferences across chat and voice, and verify seven live model-selection scenarios, including disabled-provider fallbacks (`bun run smoke:tool-selection`, 2026-10-25).
- ✅ Add file upload, type and size validation, extraction, and scoped retrieval.
- ✅ Add sandboxed code execution with CPU, memory, time, network, and filesystem limits.
- ✅ Record tool inputs, outputs, latency, cost, and failure state.

### 6. Permission tiers and human approvals

- ✅ Classify tools as safe reads, sensitive reads, writes, messages, payments, or destructive actions.
- ✅ Allow policy-approved safe reads to run automatically.
- ✅ Require explicit approval for implemented writes and destructive actions; message/payment adapters remain unavailable.
- ✅ Show the exact action, target, scope, and risk before approval.
- ✅ Bind approvals to one immutable action and expire unused approvals.
- ✅ Deny, cancel, and audit actions safely.

### 7. Specialist agents, delegation, and handoffs

- ✅ Define specialist agents with narrow instructions, tools, budgets, and output contracts.
- ✅ Add manager delegation and peer handoffs through the OpenAI Agents SDK.
- ✅ Propagate trace, session, approval, and cancellation context across agents.
- ✅ Limit delegation depth, parallelism, tokens, time, and cost.
- ✅ Detect repeated work, handoff loops, and partial failure.
- ✅ Merge specialist results with provenance and conflict reporting.

### 8. OpenAI-managed sandbox execution

- ⬜ Evaluate OpenAI-managed sandbox capabilities against the platform's security requirements.
- ⬜ Create an isolated sandbox per task or approved reusable session.
- ⬜ Control network destinations, secrets, files, resources, and lifetime.
- ⬜ Capture logs, artifacts, exit status, and cleanup state.
- ⬜ Reject sandbox escape attempts and redact secrets from output.

### 9. Coding-agent workflows and Git operations

- ⬜ Inspect repositories and propose changes before mutation.
- ⬜ Edit files atomically and preserve unrelated user changes.
- ⬜ Run formatters, linters, type checks, tests, and builds in the sandbox.
- ⬜ Present diffs and require approval for commits, pushes, branches, and pull requests.
- ⬜ Detect dirty worktrees, conflicts, generated files, and secret exposure.
- ⬜ Produce reproducible artifacts and a verification summary.

### 10. Browser and computer use

- ✅ Verify local Chrome navigation, text/screenshot capture, single-use approval, blocked destinations, and Stop with a real browser smoke test.
- ✅ Verify native TextEdit accessibility reads through the installed macOS adapter.
- ✅ Verify an approved native TextEdit write in a disposable scratch document.
- ⬜ Validate broader Mac app compatibility and add a live desktop screenshot view.

- ⬜ Add browser navigation, page reading, screenshots, and accessible element inspection in an isolated browser session.
- ⬜ Support clicking, typing, forms, uploads, and downloads through the existing permission tiers and human approvals.
- ⬜ Add local computer use through an explicitly enabled companion with scoped access to applications, folders, keyboard, and mouse.
- ⬜ Show the active browser or desktop session, real action progress, and an immediate stop/takeover control.
- ⬜ Support cloud computers over SSH with verified host keys, short-lived credentials, least-privilege accounts, and restricted commands or file access.
- ⬜ Provide remote desktop control through an authenticated encrypted tunnel or private network; SSH shell access alone does not provide graphical computer use.
- ⬜ Evaluate boats.dev and lower-cost VM or hosted-computer alternatives for browser/desktop support, isolation, startup latency, regions, and total billed cost before choosing a provider.
- ⬜ Share task and approval contracts across local, SSH-connected, and managed cloud computers; keep external provider adapters under `lib/`.
- ⬜ Isolate browser profiles and desktop sessions per user/task; protect credentials and treat page, screenshot, and terminal content as untrusted input.
- ⬜ Enforce resource, network, filesystem, runtime, and spending limits; suspend idle machines and clean up expired sessions and orphaned VMs.
- ⬜ Record redacted action results, artifacts, latency, cost, and failures; verify outcomes before retrying actions that could create duplicate effects.
- ⬜ Test disconnects, cancellation, approval expiry, prompt injection, and session isolation; validate local computer use separately on macOS, Windows, and Linux.

### 11. Composio app integrations

- ⬜ Integrate [Composio Platform](https://docs.composio.dev/docs/configuring-sessions) with a stable local user ID.
- ⬜ List connected apps and available tools without exposing credentials.
- ⬜ Use Composio-managed authentication instead of implementing third-party OAuth flows locally.
- ⬜ Apply the same permission tiers and approvals to Composio tools.
- ⬜ Add one read-only integration before any write-capable integration.
- ⬜ Test revoked connections, expired credentials, retries, and duplicate actions.

### 12. Database and Redis persistence

- ⬜ Choose a relational database and define migrations for users, sessions, tasks, approvals, and audit records.
- ⬜ Add transactional writes, idempotency keys, optimistic concurrency, and rollback tests.
- ⬜ Add Redis only for justified ephemeral needs such as caching, rate limits, locks, or queues.
- ⬜ Define ownership, retention, deletion, backup, restore, and encryption policies.
- ⬜ Test migration rollback, duplicate delivery, concurrent writes, and restore procedures.

### 13. Mem0 long-term memory

- ⬜ Define which facts may enter long-term memory and which data must never be stored.
- ⬜ Integrate Mem0 behind a provider-neutral memory interface.
- ⬜ Require user-visible controls to inspect, correct, export, and delete memories.
- ⬜ Add relevance thresholds, provenance, expiration, deduplication, and tenant isolation.
- ⬜ Measure whether retrieved memories improve task results without leaking between sessions.

### 14. Temporal durable workflows

- ⬜ Identify workflows that exceed the OpenAI Agents SDK's built-in execution and recovery guarantees.
- ⬜ Add [Temporal](https://docs.temporal.io/ai) only for workflows that need durable waits, retries, signals, or recovery.
- ⬜ Keep workflow code deterministic and move external effects into idempotent activities.
- ⬜ Support human approval waits, cancellation, retry policies, and compensation.
- ⬜ Test worker restarts, replay, duplicate delivery, timeout, and partial failure.

### 15. Local Docker and self-hosted sandboxes

- ⬜ Define a sandbox provider interface shared by managed, Docker, and future self-hosted runtimes.
- ✅ Run local Docker sandboxes as non-root with read-only filesystems, dropped capabilities, quotas, and isolated networks.
- ⬜ Mount only task-scoped files and inject short-lived secrets at execution time.
- ⬜ Add image allowlists, vulnerability scanning, cleanup, and orphan recovery.
- ⬜ Document a self-hosted deployment and its threat model.

### 16. Multi-user identity, tenancy, quotas, and billing

- ⬜ Add authentication, secure sessions, account recovery, and optional multi-factor authentication.
- ⬜ Enforce tenant ownership and authorization in every service and data query.
- ⬜ Add per-user and per-tenant budgets, rate limits, quotas, and model policies.
- ⬜ Meter model, tool, storage, and sandbox usage accurately.
- ⬜ Add organization roles, invitations, audit access, and account deletion.
- ⬜ Add billing only after metering and quota tests are reliable.

### 17. Evaluations, observability, security, and production operations

- ✅ Exclude sensitive prompt, response, and tool data from main-agent and specialist SDK traces.
- ✅ Bound main-agent output per model call and distinguish exhausted quota from temporary rate limits.
- ⬜ Configure separate staging/production OpenAI projects, scoped expiring keys, rotation, spend alerts, and hard spend limits.
- ✅ Disable Cloud audio and transcript retention in the LiveKit worker configuration.
- ✅ Verify Agent Observability is enabled and validate Cloud traces, session logs, and metrics with a real voice session (2026-10-25).
- ⬜ Deploy the LiveKit worker to a continuously hosted environment when local development is no longer sufficient.

- ⬜ Add end-to-end traces across requests, agents, tools, approvals, sandboxes, and workflows.
- ⬜ Track latency, availability, tokens, cost, tool success, approval delay, and task outcome.
- ⬜ Build regression evaluations for answer quality, tool selection, delegation, safety, and prompt injection.
- ⬜ Add audit-log integrity, redaction tests, secret rotation, dependency response, and incident runbooks.
- ⬜ Load-test backpressure, cancellation, retries, graceful shutdown, and degraded dependencies.
- ⬜ Define service objectives, alerts, canary releases, rollback, disaster recovery, and data recovery exercises.

</details>
