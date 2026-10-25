# Agentic

Agentic is a stateless NestJS API foundation for provider-specific agent experiments. The application exposes versioned APIs, health checks, OpenAPI documents, structured responses, and global error handling.

## Requirements

- Bun 1.3.14
- Node.js 24 or later for the production runtime
- Docker or another OCI-compatible container runtime for deployment

## Local development

```bash
cp .env.example .env
bun install --frozen-lockfile
bun run start:dev
```

Swagger UI runs at `http://localhost:3000/api`, Scalar runs at `http://localhost:3000/docs`, and the embedded Socket.IO playground runs at `http://localhost:3000/playground`. The application prints every enabled documentation URL when it starts.

Start the interactive streaming CLI in another terminal:

```bash
bun run chat
```

The REST endpoint remains `POST /v1/chat`. Socket.IO streams on the `/v1/chat` namespace. REST is stateless; each Socket.IO connection and CLI process keeps isolated, in-memory history that disappears on disconnect or exit.

Chat requests are automatically routed without an extra model call. Lightweight requests use `gpt-5-nano`; complex code, architecture, security, multi-step, or large requests use `gpt-6-luna`. The router is capped at Luna, and the runtime metadata reports the model actually called.

## LiveKit Cloud voice

Create a LiveKit Cloud project, copy its WebSocket URL and API credentials into `.env`, and enable voice:

```env
VOICE_ENABLED=true
VOICE_PROVIDER=livekit
VOICE_MODEL=gpt-realtime-2.1
VOICE_NAME=marin
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-livekit-key
LIVEKIT_API_SECRET=your-livekit-secret
LIVEKIT_AGENT_NAME=agentic-voice
```

Start the API and voice worker in separate terminals:

```bash
bun run start:dev
bun run voice:dev
```

Open `http://localhost:3000/playground` and select **Voice**. The server issues a unique ten-minute token that can join only its generated room, publish only microphone audio and data, subscribe to the agent, and dispatch only `LIVEKIT_AGENT_NAME`. API secrets are never sent to the browser.

To use your OpenAI account directly while retaining LiveKit's WebRTC transport, set `VOICE_PROVIDER=openai` and provide `OPENAI_API_KEY`. With `VOICE_PROVIDER=livekit`, realtime inference is billed through LiveKit Cloud instead.

## Socket.IO chat

Open `http://localhost:3000/playground`, wait for **Online**, enter a message, and send it. The conversation shows a thinking orb, shimmering activity, elapsed time, and safe phases such as tool use, handoffs, and approvals, then hides that activity when response text begins. It never exposes private chain-of-thought. Runtime chips show total time, tokens, estimated cost, models, and tools after completion. Use the stop button to cancel the active turn.

| Direction       | Event             | Data                                                               |
| --------------- | ----------------- | ------------------------------------------------------------------ |
| Client → server | `chat.send`       | `{ "message": "Explain the Roman Republic" }`                      |
| Client → server | `chat.cancel`     | `{}`                                                               |
| Server → client | `chat.started`    | `{ "requestId": "..." }`                                           |
| Server → client | `chat.status`     | Safe activity phase and label; never private chain-of-thought.     |
| Server → client | `chat.delta`      | `{ "requestId": "...", "delta": "partial text" }`                  |
| Server → client | `chat.completed`  | Final message plus time, tokens, estimated cost, models and tools. |
| Server → client | `chat.cancelling` | Confirms that cancellation was requested.                          |
| Server → client | `chat.cancelled`  | Confirms that the active model turn stopped.                       |
| Server → client | `chat.error`      | A stable error code and safe message.                              |

The embedded playground is same-origin, so it works without adding a public website to `CORS_ORIGINS`. The Socket.IO adapter allows the API's own browser origin by default and rejects other browser origins unless they are explicitly configured. For optional external testing in [Hoppscotch](https://hoppscotch.com/), add its exact origin to `CORS_ORIGINS`; do not use `*`.

## Configuration

The application validates configuration before it starts. Invalid ports, booleans, and CORS origins stop startup.

| Variable                      | Default               | Purpose                                                                     |
| ----------------------------- | --------------------- | --------------------------------------------------------------------------- |
| `NODE_ENV`                    | `development`         | Selects development, test, or production behavior.                          |
| `PORT`                        | `3000`                | Sets the HTTP port.                                                         |
| `PLATFORM_NAME`               | `Agentic`             | Names the API and OpenAPI document.                                         |
| `CORS_ORIGINS`                | empty                 | Lists exact, comma-separated browser origins. Empty disables CORS.          |
| `SWAGGER_ENABLED`             | on outside production | Enables Swagger, Scalar, and OpenAPI JSON. Set it explicitly in production. |
| `REALTIME_PLAYGROUND_ENABLED` | on outside production | Enables the embedded same-origin Socket.IO chat tester.                     |
| `OBSERVE_ENABLED`             | `false`               | Enables NestJS Observe when valid credentials are present.                  |
| `VOICE_ENABLED`               | `false`               | Enables LiveKit Cloud voice credentials and the voice worker.               |
| `VOICE_PROVIDER`              | `livekit`             | Chooses LiveKit Inference or the direct `openai` adapter.                   |
| `VOICE_MODEL`                 | `gpt-realtime-2.1`    | Selects the realtime speech-to-speech model.                                |
| `VOICE_NAME`                  | `marin`               | Selects the realtime model voice.                                           |
| `LIVEKIT_URL`                 | empty                 | LiveKit Cloud WebSocket URL; required when voice is enabled.                |
| `LIVEKIT_API_KEY`             | empty                 | Server-side LiveKit key; required when voice is enabled.                    |
| `LIVEKIT_API_SECRET`          | empty                 | Server-side LiveKit secret; required when voice is enabled.                 |
| `LIVEKIT_AGENT_NAME`          | `agentic-voice`       | Explicit dispatch name shared by tokens and the worker.                     |

Never use `*` in `CORS_ORIGINS`. The server accepts only complete HTTP or HTTPS origins without paths.

## Project structure

API versions own their transport contracts and controllers. Reusable feature logic stays in unversioned modules, while provider SDK adapters stay under `lib/`. V2 remains empty until a contract or implementation genuinely changes.

```text
src/                      # Application source.
├── app/                  # Root application and health endpoints.
├── bootstrap/            # Security, validation, documentation, and startup setup.
├── cli/                  # Standalone Nest application context for terminal commands.
├── config/               # Runtime configuration and executable application setup.
│   ├── livekit/          # LiveKit voice agent and worker configuration.
│   └── playground/       # Same-origin chat and voice playground.
├── dto/                  # Versioned API input and output contracts.
├── lib/                  # Shared provider and infrastructure adapters.
│   ├── livekit/          # Reusable LiveKit SDK adapter and Nest provider.
│   └── openai/           # OpenAI integration with feature-owned Zod schemas.
├── middleware/           # Global HTTP behavior.
│   ├── commons/         # Shared response and request utilities.
│   ├── filters/         # Global exception handling.
│   └── interceptors/    # Global response transformation.
├── modules/              # Feature modules separated by API version.
│   ├── v1/              # Stable version 1 features, including chat and voice.
│   ├── v2/              # Clean boundary reserved for changed v2 contracts.
├── cli.ts                # Standalone CLI entry point.
├── main.ts               # HTTP and Socket.IO application entry point.
└── voice.ts              # LiveKit Agents worker entry point.
test/                     # All automated tests.
├── e2e/                  # Assembled HTTP and Socket.IO tests.
└── unit/                 # Isolated unit tests grouped by feature.
```

## Agent platform roadmap

This roadmap grows Agentic from a small OpenAI-backed API into a general-purpose agent platform. A green tick means the capability passed its completion check; an empty box means work remains.

### 1. Foundations and configuration

- ✅ Validate environment variables before application startup.
- ✅ Apply security headers, explicit CORS origins, CSRF protection, validation, and rate limits globally.
- ✅ Return one safe response format for successes and failures, with a request ID on every response.
- ✅ Expose liveness and readiness endpoints without database, Redis, or public-network dependencies.
- ✅ Keep unit and end-to-end tests under categorized `test/` folders.
- ✅ Run formatting, linting, type checks, tests, audits, application builds, and container scans in CI.

Completion: a clean checkout passes every verification command and starts with invalid configuration rejected.

### 2. Basic REST chat

- ✅ Keep v1 chat isolated while reserving a clean v2 boundary for future contract changes.
- ✅ Expose the validated `POST /v1/chat` endpoint without copying it into v2.
- ✅ Wrap the OpenAI Agents SDK behind a shared NestJS service.
- ✅ Return token usage, model/tool calls, and clearly labelled cost estimates.
- ✅ Route lightweight work to GPT-5 Nano and promote complex work only as high as GPT-6 Luna.
- ✅ Document each API version in Swagger, Scalar, and OpenAPI JSON.
- ⬜ Verify a real provider response with a documented local smoke-test command.
- ⬜ Map provider authentication, timeout, rate-limit, and availability failures to stable application errors.

Completion: v1 returns a live model response, rejects invalid input, and exposes useful provider failures without leaking secrets; v2 remains clean until it differs.

### 3. CLI and Socket.IO streaming

- ✅ Add a CLI that uses the same application services as the REST API.
- ✅ Stream model output over the CLI and a versioned Socket.IO namespace.
- ✅ Provide an embedded same-origin playground for testing Socket.IO streams.
- ✅ Add LiveKit Cloud voice with environment-switched LiveKit Inference and direct OpenAI adapters.
- ✅ Issue short-lived, room-scoped, microphone-only voice tokens without exposing secrets.
- ✅ Cancel active CLI and Socket.IO turns without persisting partial sessions.
- ✅ Display tokens, estimated cost, model calls, tool calls, and safe provider errors.
- ⬜ Add configurable model timeouts and explicit non-zero CLI exit codes.
- ⬜ Display human approval requests when privileged tools are introduced.

Completion: a user can start and cancel a streaming chat from the CLI or Socket.IO without duplicated agent logic.

### 4. Structured outputs and conversation sessions

- ✅ Define schema-validated structured outputs for tasks that need machine-readable results.
- ✅ Add in-memory Socket.IO and CLI sessions without claiming durability.
- ⬜ Support session creation, continuation, expiration, and deletion.
- ⬜ Enforce token and turn limits, and summarize context before it exceeds its budget.
- ⬜ Test concurrent session isolation and malformed model output.

Completion: two concurrent sessions preserve separate context and every structured response passes its declared schema.

### 5. Hosted tools: web, files, and code

- ⬜ Add web search with citations, source metadata, domain controls, and timeout limits.
- ⬜ Add page retrieval that treats remote content as untrusted data rather than instructions.
- ⬜ Add file upload, type and size validation, extraction, and scoped retrieval.
- ⬜ Add sandboxed code execution with CPU, memory, time, network, and filesystem limits.
- ⬜ Record tool inputs, outputs, latency, cost, and failure state.

Completion: the agent can research a cited answer, inspect an allowed file, and run bounded code without accessing undeclared resources.

### 6. Permission tiers and human approvals

- ⬜ Classify tools as safe reads, sensitive reads, writes, messages, payments, or destructive actions.
- ⬜ Allow policy-approved safe reads to run automatically.
- ⬜ Require explicit approval before writes, messages, payments, or destructive actions.
- ⬜ Show the exact action, target, scope, and risk before approval.
- ⬜ Bind approvals to one immutable action and expire unused approvals.
- ⬜ Deny, cancel, and audit actions safely.

Completion: policy tests prove that privileged actions cannot execute without a valid, action-bound approval.

### 7. Specialist agents, delegation, and handoffs

- ⬜ Define specialist agents with narrow instructions, tools, budgets, and output contracts.
- ⬜ Add manager delegation and peer handoffs through the OpenAI Agents SDK.
- ⬜ Propagate trace, session, approval, and cancellation context across agents.
- ⬜ Limit delegation depth, parallelism, tokens, time, and cost.
- ⬜ Detect repeated work, handoff loops, and partial failure.
- ⬜ Merge specialist results with provenance and conflict reporting.

Completion: one manager can delegate a multi-step task to specialists, stop loops, and return a traceable combined result.

### 8. OpenAI-managed sandbox execution

- ⬜ Evaluate OpenAI-managed sandbox capabilities against the platform's security requirements.
- ⬜ Create an isolated sandbox per task or approved reusable session.
- ⬜ Control network destinations, secrets, files, resources, and lifetime.
- ⬜ Capture logs, artifacts, exit status, and cleanup state.
- ⬜ Reject sandbox escape attempts and redact secrets from output.

Completion: an untrusted task runs in an isolated managed sandbox and leaves no undeclared persistent state.

### 9. Coding-agent workflows and Git operations

- ⬜ Inspect repositories and propose changes before mutation.
- ⬜ Edit files atomically and preserve unrelated user changes.
- ⬜ Run formatters, linters, type checks, tests, and builds in the sandbox.
- ⬜ Present diffs and require approval for commits, pushes, branches, and pull requests.
- ⬜ Detect dirty worktrees, conflicts, generated files, and secret exposure.
- ⬜ Produce reproducible artifacts and a verification summary.

Completion: the agent can repair a small repository in isolation, prove the result, and wait for approval before changing remote state.

### 10. Composio app integrations

- ⬜ Integrate [Composio Platform](https://docs.composio.dev/docs/configuring-sessions) with a stable local user ID.
- ⬜ List connected apps and available tools without exposing credentials.
- ⬜ Use Composio-managed authentication instead of implementing third-party OAuth flows locally.
- ⬜ Apply the same permission tiers and approvals to Composio tools.
- ⬜ Add one read-only integration before any write-capable integration.
- ⬜ Test revoked connections, expired credentials, retries, and duplicate actions.

Completion: a user can connect one external app, perform an approved action, revoke access, and verify that further calls fail safely.

### 11. Database and Redis persistence

- ⬜ Choose a relational database and define migrations for users, sessions, tasks, approvals, and audit records.
- ⬜ Add transactional writes, idempotency keys, optimistic concurrency, and rollback tests.
- ⬜ Add Redis only for justified ephemeral needs such as caching, rate limits, locks, or queues.
- ⬜ Define ownership, retention, deletion, backup, restore, and encryption policies.
- ⬜ Test migration rollback, duplicate delivery, concurrent writes, and restore procedures.

Completion: state survives restarts, concurrent writes stay consistent, and a tested backup restores the service.

### 12. Mem0 long-term memory

- ⬜ Define which facts may enter long-term memory and which data must never be stored.
- ⬜ Integrate Mem0 behind a provider-neutral memory interface.
- ⬜ Require user-visible controls to inspect, correct, export, and delete memories.
- ⬜ Add relevance thresholds, provenance, expiration, deduplication, and tenant isolation.
- ⬜ Measure whether retrieved memories improve task results without leaking between sessions.

Completion: approved memories improve a later session and can be corrected or deleted with verified isolation.

### 13. Temporal durable workflows

- ⬜ Identify workflows that exceed the OpenAI Agents SDK's built-in execution and recovery guarantees.
- ⬜ Add [Temporal](https://docs.temporal.io/ai) only for workflows that need durable waits, retries, signals, or recovery.
- ⬜ Keep workflow code deterministic and move external effects into idempotent activities.
- ⬜ Support human approval waits, cancellation, retry policies, and compensation.
- ⬜ Test worker restarts, replay, duplicate delivery, timeout, and partial failure.

Completion: a multi-step agent task resumes after a worker restart without repeating completed side effects.

### 14. Local Docker and self-hosted sandboxes

- ⬜ Define a sandbox provider interface shared by managed, Docker, and future self-hosted runtimes.
- ⬜ Run local Docker sandboxes as non-root with read-only filesystems, dropped capabilities, quotas, and isolated networks.
- ⬜ Mount only task-scoped files and inject short-lived secrets at execution time.
- ⬜ Add image allowlists, vulnerability scanning, cleanup, and orphan recovery.
- ⬜ Document a self-hosted deployment and its threat model.

Completion: the same sandbox conformance suite passes against the managed and local Docker providers.

### 15. Multi-user identity, tenancy, quotas, and billing

- ⬜ Add authentication, secure sessions, account recovery, and optional multi-factor authentication.
- ⬜ Enforce tenant ownership and authorization in every service and data query.
- ⬜ Add per-user and per-tenant budgets, rate limits, quotas, and model policies.
- ⬜ Meter model, tool, storage, and sandbox usage accurately.
- ⬜ Add organization roles, invitations, audit access, and account deletion.
- ⬜ Add billing only after metering and quota tests are reliable.

Completion: isolation tests prove that one tenant cannot read, invoke, approve, or pay for another tenant's resources.

### 16. Evaluations, observability, security, and production operations

- ⬜ Add end-to-end traces across requests, agents, tools, approvals, sandboxes, and workflows.
- ⬜ Track latency, availability, tokens, cost, tool success, approval delay, and task outcome.
- ⬜ Build regression evaluations for answer quality, tool selection, delegation, safety, and prompt injection.
- ⬜ Add audit-log integrity, redaction tests, secret rotation, dependency response, and incident runbooks.
- ⬜ Load-test backpressure, cancellation, retries, graceful shutdown, and degraded dependencies.
- ⬜ Define service objectives, alerts, canary releases, rollback, disaster recovery, and data recovery exercises.

Completion: a staged release meets its quality and reliability thresholds, exposes actionable telemetry, and can roll back safely.

## Health checks

- `GET /v1/health/live` proves that the process can answer requests.
- `GET /v1/health/ready` checks the process's memory limits.

Both routes also support API version 2. The checks do not depend on external websites, databases, or Redis.

## Verification

All tests live under `test/`.

```bash
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run test:e2e
bun run test:cov
bun run build
```

## Container deployment

Build and run the same OCI image on Docker, Kubernetes, Nomad, ECS, Cloud Run, Fly.io, Railway, Render, or any compatible platform:

```bash
docker build --tag agentic:local .
docker run --rm --read-only --tmpfs /tmp --publish 3000:3000 agentic:local
```

The image uses pinned Bun and Node digests, contains production dependencies only, and runs as the unprivileged `node` user.

## CI/CD

`.github/workflows/ci.yml` installs the lockfile exactly, checks formatting and types, runs all tests, audits dependencies, builds the application and container, and scans the runtime image. Every external action is pinned to a full commit SHA.

`.github/workflows/release.yml` verifies semantic-version tags, then publishes Linux AMD64 and ARM64 images to GitHub Container Registry. It creates an SBOM and signs a provenance attestation through GitHub OIDC. Configure protection rules and required reviewers on the repository's `production` environment before the first release.

Create a release with an immutable semantic version:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow delivers a portable image. Each hosting platform can deploy that immutable image digest with its own native rollout and rollback controls.

## Reliability and state

The service is stateless. It does not pretend that memory or a container filesystem is durable. Add workflow and idempotency modules only with a shared production store and tested transaction boundaries. Until then, replicas can start, stop, and roll back without losing application-owned state because the application owns none.

The application enables graceful NestJS shutdown hooks. Its global exception filter also handles exceptions thrown by middleware, assigns a safe request ID, logs unexpected server errors, and keeps internal error details out of client responses.

## NestJS guidance applied

This project follows the current NestJS guidance for [exception filters](https://docs.nestjs.com/exception-filters), [security headers](https://docs.nestjs.com/techniques/security/cors), [CSRF protection](https://docs.nestjs.com/security/csrf), [validation](https://docs.nestjs.com/application/validation), [rate limiting](https://docs.nestjs.com/security/rate-limiting), and [shutdown hooks](https://docs.nestjs.com/fundamentals/lifecycle-events).
