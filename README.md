# Agentic

An OpenAI-powered agent platform built with NestJS, with REST, streaming chat, CLI, and LiveKit voice. Sessions are stored in memory and disappear on restart. No database or Redis yet.

## Quick start

Requires Node.js 24+ and Bun 1.3.14.

```bash
cp .env.example .env
bun install --frozen-lockfile
```

Add `OPENAI_API_KEY` to `.env`, then start the API:

```bash
bun run start:dev
```

| Interface  | URL or command                   |
| ---------- | -------------------------------- |
| Playground | http://localhost:3001/playground |
| Swagger    | http://localhost:3001/api        |
| Scalar     | http://localhost:3001/docs       |
| Text CLI   | `bun run chat`                   |

Chat routes simple requests to `gpt-5-nano` and complex requests to `gpt-6-luna`. Responses include input/output tokens, model usage, and estimated model cost.

## Configuration

See [.env.example](.env.example) for settings and defaults. Configuration is validated at startup. Keep credentials in your local `.env` and restart affected services after changes.

- `CORS_ORIGINS`: exact, comma-separated browser origins. Use `http://localhost:3001` locally, never `*`.
- `MODEL_TIMEOUT_MS`: total text-generation deadline, including hosted search.
- `SESSION_TTL_MS`, `SESSION_MAX_TURNS`, `SESSION_MAX_TOKENS`: conversation lifetime and context limits.
- `WEB_SEARCH_ENABLED`, `WEB_SEARCH_ALLOWED_DOMAINS`: hosted search and optional domain restrictions.
- `SWAGGER_ENABLED`, `REALTIME_PLAYGROUND_ENABLED`: documentation and playground availability.

## Optional web tools

Enable each provider with its flag and API key in `.env`. Chat and voice share these tools.

| Provider                                                | Preferred use           | Enable flag           | Credential            |
| ------------------------------------------------------- | ----------------------- | --------------------- | --------------------- |
| [Context.dev](https://docs.context.dev/sdks/typescript) | Quick web lookups       | `CONTEXT_DEV_ENABLED` | `CONTEXT_DEV_API_KEY` |
| [Firecrawl](https://docs.firecrawl.dev/sdks/node)       | Read a specific page    | `FIRECRAWL_ENABLED`   | `FIRECRAWL_API_KEY`   |
| [Valyu](https://docs.valyu.ai/)                         | Research across sources | `VALYU_ENABLED`       | `VALYU_API_KEY`       |

The agent may choose a suitable alternative when its preferred provider is unavailable. `WEB_SEARCH_ALLOWED_DOMAINS` also applies to external tools. `EXTERNAL_TOOLS_*` settings bound time, calls, and result size. Tool-provider charges are separate from the displayed model-cost estimate. A timed-out provider request may continue remotely, particularly with Valyu's current SDK.

## Voice

### LiveKit credentials

1. Open [LiveKit Cloud](https://cloud.livekit.io/) and select or create a project.
2. Select **Manage API keys** and copy the project URL, API key, and secret.
3. Add these settings to `.env`:

```env
VOICE_ENABLED=true
VOICE_PROVIDER=livekit
VOICE_MODEL=gpt-realtime-2.1-mini
VOICE_NAME=marin
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-livekit-key
LIVEKIT_API_SECRET=your-livekit-secret
LIVEKIT_AGENT_NAME=agentic-voice
```

If your [LiveKit CLI](https://docs.livekit.io/reference/developer-tools/livekit-cli/projects/) is already connected, you can write the credentials directly:

```bash
lk project list
lk app env --write --destination .env --project YOUR_PROJECT
```

Use `lk cloud auth` to connect first if needed. The app reads `.env`, not the CLI's default `.env.local`. Preserve existing settings and avoid `--overwrite`.

### Browser voice

Keep the API running and start the worker in a second terminal:

```bash
bun run voice:dev
```

Open the playground, click the microphone, and allow microphone access. Both processes must run for voice replies. If playback is blocked, select **Tap to hear Agentic**. After changing voice settings, restart the worker and start a new conversation.

`VOICE_PROVIDER=livekit` bills inference through LiveKit Cloud. Use `VOICE_PROVIDER=openai` with `OPENAI_API_KEY` for direct OpenAI inference through the same LiveKit transport.

### Terminal voice

Install the [LiveKit CLI](https://docs.livekit.io/reference/developer-tools/livekit-cli/), then run:

```bash
bun run voice:devices
bun run voice:console
bun run voice:console --text
```

Use `m` to mute, `Ctrl+T` to switch voice/text, and `q` to quit (`Ctrl+C` in text mode). Select devices with `--input-device "Microphone name" --output-device "Speaker name"`.

Human microphone capture and playback have been confirmed on macOS. Windows and Linux hardware validation remains open. Use a glibc Linux distribution such as Ubuntu or Debian; Alpine/musl and Windows ARM64 lack bindings in the installed SDK. On each platform, verify a spoken reply, mute/unmute, mode switching, and microphone shutdown before marking support complete.

### Observability and telephony

Enable **Agent observability** in the Cloud project's settings. End a new voice conversation, then inspect **Sessions → Agent insights** for traces and logs. Cloud observability has been verified; audio and transcript retention are disabled in the worker. See [Agent insights](https://docs.livekit.io/testing/observability/insights/).

Telephony remains pending an approved number purchase and SIP dispatch design. Once provisioned, `LIVEKIT_PHONE_NUMBER` prints the number at startup; it does not purchase or route calls. See [LiveKit phone numbers](https://docs.livekit.io/telephony/start/phone-numbers/).

## API and streaming

Use Swagger or Scalar for request schemas and response examples.

| Route                                 | Purpose                 |
| ------------------------------------- | ----------------------- |
| `POST /v1/chat`                       | Stateless chat          |
| `POST /v1/chat/sessions`              | Create a conversation   |
| `POST /v1/chat/sessions/:id/messages` | Continue a conversation |
| `DELETE /v1/chat/sessions/:id`        | Delete a conversation   |
| `GET /v1/health/live`                 | Process liveness        |
| `GET /v1/health/ready`                | Memory readiness        |

Socket.IO uses the `/v1/chat` namespace:

| Direction           | Events                                                             |
| ------------------- | ------------------------------------------------------------------ |
| Client → server     | `chat.send` with `{ "message": "Hello" }`; `chat.cancel` with `{}` |
| Server → client     | `chat.started`, `chat.status`, `chat.delta`, `chat.completed`      |
| Cancellation/errors | `chat.cancelling`, `chat.cancelled`, `chat.error`                  |

The playground displays streamed answers, citations, sources, and usage. For external testing with [Hoppscotch](https://hoppscotch.com/), allow its exact origin in `CORS_ORIGINS`.

## Testing

All tests live in categorized folders under `test/`.

```bash
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run test:e2e
bun run build
```

Real-provider checks use credentials from `.env` and may incur charges:

```bash
bun run smoke:provider          # Structured response and usage
bun run smoke:search            # Hosted search and citations
bun run smoke:tools             # Enabled external provider APIs
bun run smoke:tool-selection    # Model tool selection with fixture results
RUN_VOICE_SMOKE=true node --env-file=.env test/smoke/voice.smoke.mjs
```

The voice check requires the API and worker. It verifies dispatch, a reply transcript, and received audio, not physical microphone or speaker operation.

## Docker and releases

`Dockerfile` builds the application image. `compose.yaml` runs the API and optional voice worker with runtime credentials from `.env`.

```bash
docker compose up --build -d --wait                 # API
docker compose --profile voice up --build -d --wait # API and voice
docker compose logs -f api voice
docker compose --profile voice down
```

The API binds to `localhost:3001`. Stop any standalone worker before switching to Compose if only one worker should accept jobs. Compose does not start a self-hosted LiveKit media server or capture your microphone. Use the browser or native voice console for microphone input.

Set `AGENTIC_ENV_FILE` to select another environment file or `AGENTIC_HTTP_PORT` to change the host port. Update CORS origins when changing ports. API restarts lose in-memory sessions.

[CI](.github/workflows/ci.yml) checks formatting, types, tests, dependencies, and the container image. The [release workflow](.github/workflows/release.yml) publishes AMD64/ARM64 images to GHCR for semantic-version tags, with an SBOM and provenance attestation. Configure the repository's `production` environment protections before releasing.

## Project structure

```text
src/
├── app/                  # Root application and health endpoints.
├── bootstrap/            # Security, validation, docs, and startup.
├── cli/                  # Terminal application context.
├── config/               # Runtime configuration and application setup.
│   ├── agent/            # Shared chat and voice instructions.
│   ├── livekit/          # Voice agent, worker, and console setup.
│   ├── openai/           # Model routing and provider error mapping.
│   ├── schema/           # Zod schemas and categorized types/.
│   ├── web-tools/        # Shared tool policies and registration.
│   └── playground/       # Chat and voice UI.
├── dto/                  # API input and output contracts.
├── lib/                  # External provider modules and services.
├── middleware/           # Filters, interceptors, errors, and shared utilities.
├── modules/              # Features in v1/; v2/ reserved for new contracts.
├── cli.ts                # Text CLI entry point.
├── main.ts               # HTTP and Socket.IO entry point.
└── voice.ts              # LiveKit worker entry point.
test/                     # Categorized unit/, e2e/, and smoke/ tests.
AGENTS.md                 # Development rules and conventions.
compose.yaml              # API and optional worker services.
Dockerfile                # Shared application image.
```

Use public barrel imports such as `@/config`, `@/lib`, `@/dto`, and `@/middleware`. See [AGENTS.md](AGENTS.md) for architecture and contribution rules.

## Agent platform roadmap

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
- ✅ Document each API version in Swagger, Scalar, and OpenAPI JSON.
- ✅ Verify a real provider response with a documented local smoke-test command.
- ✅ Map provider authentication, timeout, rate-limit, and availability failures to stable application errors.

### 3. CLI, Socket.IO streaming, and LiveKit voice

- ✅ Add a CLI that uses the same application services as the REST API.
- ✅ Stream model output over the CLI and a versioned Socket.IO namespace.
- ✅ Provide an embedded same-origin playground for testing Socket.IO streams.
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
- ⬜ Run the Windows/Linux CI matrix to verify builds, tests, and native voice-worker loading.
- ⬜ Validate human microphone capture on Windows and Linux before marking cross-platform voice CLI input complete; test machines are not yet available.
- ⬜ Add telephony only after an explicitly approved phone-number purchase and SIP dispatch design.
- ⬜ Display human approval requests when privileged tools are introduced.

### 4. Structured outputs and conversation sessions

- ✅ Define schema-validated structured outputs for tasks that need machine-readable results.
- ✅ Add in-memory Socket.IO and CLI sessions without claiming durability.
- ✅ Support session creation, continuation, expiration, and deletion.
- ✅ Enforce token and turn limits, and summarize context before it exceeds its budget.
- ✅ Test concurrent session isolation and malformed model output.

### 5. Hosted tools: web, files, and code

- ✅ Add web search with citations, source metadata, domain controls, and timeout limits.
- ✅ Add optional Context.dev web search through its official SDK.
- ✅ Add optional Firecrawl page reading through its official SDK.
- ✅ Add optional Valyu web research through its official SDK.
- ✅ Share optional tools across chat and voice with validated inputs, domain controls, bounded results, call budgets, and stable errors.
- ✅ Add page retrieval that treats remote content as untrusted data rather than instructions.
- ✅ Verify Context.dev search and Firecrawl page reading with real API keys, non-empty content, and source metadata (`bun run smoke:tools`, 2026-10-25).
- ✅ Configure Valyu and verify real search content and source metadata with its live smoke test (2026-10-25).
- ✅ Share flexible provider preferences across chat and voice, and verify seven live model-selection scenarios, including disabled-provider fallbacks (`bun run smoke:tool-selection`, 2026-10-25).
- ⬜ Add file upload, type and size validation, extraction, and scoped retrieval.
- ⬜ Add sandboxed code execution with CPU, memory, time, network, and filesystem limits.
- ⬜ Record tool inputs, outputs, latency, cost, and failure state.

### 6. Permission tiers and human approvals

- ⬜ Classify tools as safe reads, sensitive reads, writes, messages, payments, or destructive actions.
- ⬜ Allow policy-approved safe reads to run automatically.
- ⬜ Require explicit approval before writes, messages, payments, or destructive actions.
- ⬜ Show the exact action, target, scope, and risk before approval.
- ⬜ Bind approvals to one immutable action and expire unused approvals.
- ⬜ Deny, cancel, and audit actions safely.

### 7. Specialist agents, delegation, and handoffs

- ⬜ Define specialist agents with narrow instructions, tools, budgets, and output contracts.
- ⬜ Add manager delegation and peer handoffs through the OpenAI Agents SDK.
- ⬜ Propagate trace, session, approval, and cancellation context across agents.
- ⬜ Limit delegation depth, parallelism, tokens, time, and cost.
- ⬜ Detect repeated work, handoff loops, and partial failure.
- ⬜ Merge specialist results with provenance and conflict reporting.

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

### 10. Composio app integrations

- ⬜ Integrate [Composio Platform](https://docs.composio.dev/docs/configuring-sessions) with a stable local user ID.
- ⬜ List connected apps and available tools without exposing credentials.
- ⬜ Use Composio-managed authentication instead of implementing third-party OAuth flows locally.
- ⬜ Apply the same permission tiers and approvals to Composio tools.
- ⬜ Add one read-only integration before any write-capable integration.
- ⬜ Test revoked connections, expired credentials, retries, and duplicate actions.

### 11. Database and Redis persistence

- ⬜ Choose a relational database and define migrations for users, sessions, tasks, approvals, and audit records.
- ⬜ Add transactional writes, idempotency keys, optimistic concurrency, and rollback tests.
- ⬜ Add Redis only for justified ephemeral needs such as caching, rate limits, locks, or queues.
- ⬜ Define ownership, retention, deletion, backup, restore, and encryption policies.
- ⬜ Test migration rollback, duplicate delivery, concurrent writes, and restore procedures.

### 12. Mem0 long-term memory

- ⬜ Define which facts may enter long-term memory and which data must never be stored.
- ⬜ Integrate Mem0 behind a provider-neutral memory interface.
- ⬜ Require user-visible controls to inspect, correct, export, and delete memories.
- ⬜ Add relevance thresholds, provenance, expiration, deduplication, and tenant isolation.
- ⬜ Measure whether retrieved memories improve task results without leaking between sessions.

### 13. Temporal durable workflows

- ⬜ Identify workflows that exceed the OpenAI Agents SDK's built-in execution and recovery guarantees.
- ⬜ Add [Temporal](https://docs.temporal.io/ai) only for workflows that need durable waits, retries, signals, or recovery.
- ⬜ Keep workflow code deterministic and move external effects into idempotent activities.
- ⬜ Support human approval waits, cancellation, retry policies, and compensation.
- ⬜ Test worker restarts, replay, duplicate delivery, timeout, and partial failure.

### 14. Local Docker and self-hosted sandboxes

- ⬜ Define a sandbox provider interface shared by managed, Docker, and future self-hosted runtimes.
- ⬜ Run local Docker sandboxes as non-root with read-only filesystems, dropped capabilities, quotas, and isolated networks.
- ⬜ Mount only task-scoped files and inject short-lived secrets at execution time.
- ⬜ Add image allowlists, vulnerability scanning, cleanup, and orphan recovery.
- ⬜ Document a self-hosted deployment and its threat model.

### 15. Multi-user identity, tenancy, quotas, and billing

- ⬜ Add authentication, secure sessions, account recovery, and optional multi-factor authentication.
- ⬜ Enforce tenant ownership and authorization in every service and data query.
- ⬜ Add per-user and per-tenant budgets, rate limits, quotas, and model policies.
- ⬜ Meter model, tool, storage, and sandbox usage accurately.
- ⬜ Add organization roles, invitations, audit access, and account deletion.
- ⬜ Add billing only after metering and quota tests are reliable.

### 16. Evaluations, observability, security, and production operations

- ✅ Disable Cloud audio and transcript retention in the LiveKit worker configuration.
- ✅ Verify Agent Observability is enabled and validate Cloud traces, session logs, and metrics with a real voice session (2026-10-25).
- ⬜ Deploy the LiveKit worker to a continuously hosted environment when local development is no longer sufficient.

- ⬜ Add end-to-end traces across requests, agents, tools, approvals, sandboxes, and workflows.
- ⬜ Track latency, availability, tokens, cost, tool success, approval delay, and task outcome.
- ⬜ Build regression evaluations for answer quality, tool selection, delegation, safety, and prompt injection.
- ⬜ Add audit-log integrity, redaction tests, secret rotation, dependency response, and incident runbooks.
- ⬜ Load-test backpressure, cancellation, retries, graceful shutdown, and degraded dependencies.
- ⬜ Define service objectives, alerts, canary releases, rollback, disaster recovery, and data recovery exercises.
