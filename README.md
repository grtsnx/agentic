# Agentic

Agentic is a NestJS foundation for provider-specific agent experiments. It exposes versioned APIs, bounded in-memory sessions, health checks, OpenAPI documents, structured responses, and global error handling without database or Redis persistence.

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

Swagger UI runs at `http://localhost:3001/api`, Scalar runs at `http://localhost:3001/docs`, and the embedded Socket.IO playground runs at `http://localhost:3001/playground`. The application prints every enabled documentation URL when it starts.

Start the interactive streaming CLI in another terminal:

```bash
bun run chat
```

The stateless REST endpoint remains `POST /v1/chat`. Session REST endpoints create, continue, expire, and delete isolated in-memory conversations under `/v1/chat/sessions`. Socket.IO streams on the `/v1/chat` namespace. All conversation state disappears when the process restarts; durable persistence remains intentionally deferred until the database milestone.

Verify the configured provider with one small, real request:

```bash
bun run smoke:provider
```

The command requires `OPENAI_API_KEY` in `.env`, validates the structured response and usage metadata, prints only safe model/token details, and exits non-zero on failure.

Create and continue an in-memory REST session with `POST /v1/chat/sessions` and `POST /v1/chat/sessions/:id/messages`; delete it with `DELETE /v1/chat/sessions/:id`. Session IDs are UUIDs, expiry slides after each successful turn, overlapping turns on one session are rejected, and separate sessions never share provider history.

Hosted web search follows the [official OpenAI web-search contract](https://developers.openai.com/api/docs/guides/tools-web-search). Set `WEB_SEARCH_ALLOWED_DOMAINS` to restrict results. Provider URL annotations are normalized into source metadata and rendered as visible, clickable citations in the playground; model-written URLs are not trusted as source records.

Chat requests are automatically routed without an extra model call. Lightweight requests use `gpt-5-nano`; complex code, architecture, security, multi-step, or large requests use `gpt-6-luna`. The router is capped at Luna, and the runtime metadata reports the model actually called.

## Optional external tools

These tools are available to REST, Socket.IO, CLI, and LiveKit voice. Each provider has its own module and service under `lib/`; shared tool registration and policies live in `config/web-tools/`. All Zod schemas live in `config/schema/`, grouped by feature, and are imported through `@/config/schema`. Each provider is disabled by default and can be enabled independently. They do not require a database or Redis.

| Provider                                                | Agent tool                                       | Enable flag                | Server-side credential |
| ------------------------------------------------------- | ------------------------------------------------ | -------------------------- | ---------------------- |
| [Context.dev](https://docs.context.dev/sdks/typescript) | `context_dev_search`: search the public web      | `CONTEXT_DEV_ENABLED=true` | `CONTEXT_DEV_API_KEY`  |
| [Firecrawl](https://docs.firecrawl.dev/sdks/node)       | `firecrawl_read_page`: read one page as Markdown | `FIRECRAWL_ENABLED=true`   | `FIRECRAWL_API_KEY`    |
| [Valyu](https://docs.valyu.ai/)                         | `valyu_search`: research search over web sources | `VALYU_ENABLED=true`       | `VALYU_API_KEY`        |

Create an API key in the provider's dashboard, add it to `.env`, enable that provider, and restart the API, CLI, and voice worker you use. Missing keys fail startup validation when enabled. Keys remain server-side. Hosted OpenAI search is controlled separately by `WEB_SEARCH_ENABLED`; you can turn it off and use these search tools instead.

`WEB_SEARCH_ALLOWED_DOMAINS` applies to these providers too, including page reads and returned sources. Tools reject literal IP addresses, local hostnames, URL credentials, and non-HTTP(S) URLs. This input policy is not a network firewall: remote fetching and redirect enforcement belong to the provider. Treat retrieved text as untrusted evidence, and use an allowlist when the agent must stay within specific sites.

Calls share a budget of `EXTERNAL_TOOLS_MAX_CALLS` per chat run or voice conversation, including failures. Parallel calls reserve their slot before starting. Results are limited by count and total content characters, with public URL/title/domain source metadata attached to chat responses. The agent chooses a tool when needed; enabling several providers does not call them all automatically.

### How the agent chooses a provider

Chat and voice share one selection policy and the same tool descriptions in `config/web-tools/web-tool.instructions.ts`:

| Task                                                                           | Preferred tool | Example                                                                |
| ------------------------------------------------------------------------------ | -------------- | ---------------------------------------------------------------------- |
| General web lookup, current fact, news, or official documentation discovery    | Context.dev    | “Find the official Node.js URL documentation.”                         |
| Read, summarize, or extract from a specific URL                                | Firecrawl      | “Read this article and summarize it.”                                  |
| Research or compare evidence from several sources                              | Valyu          | “Compare evidence for retrieval-augmented generation and fine-tuning.” |
| Greeting, arithmetic, rewriting supplied text, or an answer already in context | No web tool    | “Rewrite this paragraph.”                                              |

If the preferred search provider is unavailable, the agent uses the other configured search provider, then hosted OpenAI search if available. Firecrawl can read a relevant result after search when snippets are insufficient, or directly verify a known canonical official documentation URL. A direct page read is not a substitute for discovering current news or unknown sources. The agent distinguishes snippets from full page reads, respects domain restrictions and call budgets, and avoids repeating a successful query across providers. Valyu currently uses public web search only; licensed datasets and DeepResearch are not enabled.

Selection is model-driven and flexible: Context.dev and Valyu are both valid search providers. The agent prefers Context.dev for lookups and Valyu for research, and may choose a suitable alternative. These preferences are not fixed routing rules. Test representative choices and disabled-provider fallbacks with:

```bash
bun run smoke:tool-selection
```

This makes seven small requests to the economical OpenAI model using the production instructions and tool definitions. It checks search, research, page reading, no-tool replies, disabled-provider fallbacks, and canonical documentation reads. Suitable alternatives pass the capability checks; logs separately report whether the preferred provider was selected. Tool execution is replaced with fixtures and stops at the first selection, so it does not charge the search providers. `bun run smoke:tools` separately verifies their real APIs.

`EXTERNAL_TOOLS_TIMEOUT_MS` bounds how long the application waits for a tool. Cancellation stops waiting and discards late results. Context.dev supports request cancellation; Firecrawl has a request timeout with automatic resume disabled. The installed Valyu search SDK does not expose request cancellation or apply its general timeout option to search, so an already submitted provider request may continue after the application deadline. No adapter automatically retries. Provider charges are **not** included in the existing model-cost estimate.

After configuring keys, verify the enabled providers with:

```bash
bun run smoke:tools
```

This makes one billable read/search per enabled provider, restricted to `example.com`. It checks real source results, logs only tool names and source counts, and exits non-zero for missing configuration or provider failures. Unit tests use SDK mocks and make no paid requests.

## LiveKit Cloud voice

### Get your credentials

1. Sign in to [LiveKit Cloud](https://cloud.livekit.io/) and select or create a project.
2. On the project overview, select **Manage API keys** (or **Settings → API keys** in the original dashboard). Copy the project URL, API key, and API secret.
3. Put the URL in `LIVEKIT_URL` (it starts with `wss://`), the key in `LIVEKIT_API_KEY`, and the secret in `LIVEKIT_API_SECRET` in your local `.env`. Keep the key and secret server-side.

If you have already connected the LiveKit CLI, list the saved projects and write the selected project's credentials directly to the file this app reads:

```bash
lk cloud auth                     # only needed to connect your account
lk project list
lk app env --write --destination .env --project agentic
```

Replace `agentic` with your project name. `lk app env` prints variables unless you pass `--write`; its default output file is `.env.local`. Our API, CLI, and development voice worker explicitly read `.env`, so use `--destination .env`. Keep your existing application settings and do not pass `--overwrite`. Both local environment files are Git-ignored. See the [LiveKit CLI project guide](https://docs.livekit.io/reference/developer-tools/livekit-cli/projects/).

Enable voice and keep local HTTP and CORS settings aligned:

```env
PORT=3001
CORS_ORIGINS=http://localhost:3001
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

Open `http://localhost:3001/playground`, click the microphone in the message input, then **Start conversation**. Allow microphone access when prompted. The server issues a unique ten-minute token that can join only its generated room, publish only microphone audio and data, subscribe to the agent, and dispatch only `LIVEKIT_AGENT_NAME`. API secrets are never sent to the browser.

To use your OpenAI account directly while retaining LiveKit's WebRTC transport, set `VOICE_PROVIDER=openai` and provide `OPENAI_API_KEY`. With `VOICE_PROVIDER=livekit`, realtime inference is billed through LiveKit Cloud instead.

The voice screen has a spacious Aura stage and a live transcript alongside it (below it on narrow screens). Independent meters follow your microphone and the identified agent's audio. The Aura responds to actual volume and frequency changes, with separate listening, thinking, speaking, muted, and reconnecting states. You can interrupt, mute, hide the transcript, or return to chat. Final transcript segments stay in the current chat; a page reload clears them. If browser audio is blocked, select **Tap to hear Agentic**.

The visual direction uses the soft gradients and restrained controls of [this Dribbble voice assistant reference](https://dribbble.com/shots/26793063-AI-Assistant-Mobile-App-UI-Modern-Voice-Chat-Experience), with [LiveKit Agents UI](https://livekit.com/products/agents-ui) as the interaction reference. The renderer is framework-free and respects reduced motion.

### Phone calls

A Cloud API key does not include a telephone number. To receive calls, provision a [LiveKit phone number](https://docs.livekit.io/telephony/start/phone-numbers/), associate it with an inbound SIP dispatch rule targeting `LIVEKIT_AGENT_NAME`, and keep the named worker running. Follow LiveKit's [inbound-call testing guide](https://docs.livekit.io/telephony/testing/) to verify routing.

Once the number is provisioned, set `LIVEKIT_PHONE_NUMBER` in `.env` to its international E.164 value, such as `+12025550123` (example only). Restart the API: startup prints the configured number and a `tel:` link. This variable displays the number; it does not buy a number or configure routing.

Check the project's actual numbers and dispatch rules with:

```bash
lk number list --project agentic
lk sip dispatch list --project agentic
```

With no configured number, startup says telephony is unconfigured. The connected project had no number or inbound dispatch rule when checked on 2026-10-25; `LIVEKIT_PHONE_NUMBER` is therefore left empty locally.

### LiveKit product coverage

| Product                                                                     | Current integration                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Agents UI](https://livekit.com/products/agents-ui)                         | The embedded, framework-free playground follows its control-bar, transcript, audio-state, and visualizer patterns. It reads `lk.agent.state` to show connecting, listening, thinking, speaking, and failure states. The React/Shadcn package itself is not installed because this repository does not contain a React frontend. |
| [Agent Builder](https://livekit.com/products/agent-builder)                 | Agent Builder is an alternative Cloud authoring and deployment surface that generates Python. This code-first TypeScript worker remains the single dispatched agent to avoid duplicate deployments.                                                                                                                             |
| [LiveKit Inference](https://livekit.com/products/inference)                 | Enabled when `VOICE_PROVIDER=livekit`; the configured realtime model is selected through LiveKit Inference without exposing provider credentials to the browser.                                                                                                                                                                |
| [LiveKit Phone Numbers](https://livekit.com/products/livekit-phone-numbers) | Telephony is not provisioned automatically. Purchasing a number is billable and also requires an inbound SIP dispatch rule. Use `lk number search`, explicitly approve a purchase, then bind the number to `LIVEKIT_AGENT_NAME`.                                                                                                |
| [Agent Observability](https://livekit.com/products/agent-observability)     | The worker exports redacted traces and logs while explicitly disabling Cloud audio and transcript retention. Enable Agent Observability for the project in LiveKit Cloud to inspect those sessions.                                                                                                                             |

The connected Cloud project currently has no deployed Cloud agent and no purchased phone number. The local worker is intentional for development; deploy it only when a continuously hosted voice agent is required.

### LiveKit TODO

- ✅ Keep LiveKit SDK integration under `lib/` and expose voice through the v1 module.
- ✅ Switch LiveKit Inference and direct OpenAI voice adapters with `VOICE_PROVIDER`.
- ✅ Issue short-lived, room-scoped, microphone-only tokens without browser secrets.
- ✅ Run a named TypeScript voice worker with shared chat/voice instructions.
- ✅ Show participant-aware listening, thinking, speaking, transcript, and connection states.
- ✅ Drive the Aura and separate participant meters from live audio, with responsive controls and reduced-motion support.
- ✅ Document Cloud credentials and print the configured telephony number at startup.
- ✅ Disable Cloud audio and transcript retention in worker configuration.
- ⬜ Deploy the worker to a continuously hosted environment when local development is no longer sufficient.
- ⬜ Enable and validate LiveKit Agent Observability in the Cloud project.
- ⬜ Add telephony only after an explicitly approved phone-number purchase and SIP dispatch design.
- ⬜ Add voice CLI input only after selecting and testing a cross-platform audio capture path.

## Socket.IO chat

Open `http://localhost:3001/playground`, wait for **Online**, enter a message, and send it. Prompt starter cards fill the composer so you can edit before sending. The light chat and voice screens share an original SVG Agentic mark; its geometry lives in `src/config/playground/brand.asset.ts` and also supplies the favicon and assistant avatars.

The conversation shows a thinking orb, shimmering activity, elapsed time, and plain-language progress, then hides that activity when response text begins. It never exposes private chain-of-thought. Runtime chips show total time, tokens, estimated cost, and models after completion. Internal tool names stay out of conversation progress, playground chips, and CLI output; structured API runtime metadata remains available for diagnostics. Use the stop button to cancel the active turn.

All channels use the Agentic identity and shared instructions to keep internal implementation details out of replies. Text runs, including hosted search, use `MODEL_TIMEOUT_MS` as their total deadline; the old `WEB_SEARCH_TIMEOUT_MS` setting is no longer used. External calls retain their separate `EXTERNAL_TOOLS_TIMEOUT_MS` limit. Interrupted text replies retain received text with an incomplete-response notice. Voice filters microphone noise before speech detection, retains intentional interruptions, and offers a new connection if the agent leaves. Noise filtering follows the [LiveKit realtime audio options](https://docs.livekit.io/agents/models/realtime/openai/); actual microphone behavior depends on the room, device, and connection.

| Direction       | Event             | Data                                                                    |
| --------------- | ----------------- | ----------------------------------------------------------------------- |
| Client → server | `chat.send`       | `{ "message": "Explain the Roman Republic" }`                           |
| Client → server | `chat.cancel`     | `{}`                                                                    |
| Server → client | `chat.started`    | `{ "requestId": "..." }`                                                |
| Server → client | `chat.status`     | Safe activity phase and label; never private chain-of-thought.          |
| Server → client | `chat.delta`      | `{ "requestId": "...", "delta": "partial text" }`                       |
| Server → client | `chat.completed`  | Final message, clickable sources, time, tokens, cost, models and tools. |
| Server → client | `chat.cancelling` | Confirms that cancellation was requested.                               |
| Server → client | `chat.cancelled`  | Confirms that the active model turn stopped.                            |
| Server → client | `chat.error`      | A stable error code and safe message.                                   |

The embedded playground is same-origin, so it works without adding a public website to `CORS_ORIGINS`. The Socket.IO adapter allows the API's own browser origin by default and rejects other browser origins unless they are explicitly configured. For optional external testing in [Hoppscotch](https://hoppscotch.com/), add its exact origin to `CORS_ORIGINS`; do not use `*`.

## Configuration

The application validates configuration before it starts. Invalid ports, booleans, and CORS origins stop startup.

| Variable                                                    | Default               | Purpose                                                                             |
| ----------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------- |
| `NODE_ENV`                                                  | `development`         | Selects development, test, or production behavior.                                  |
| `PORT`                                                      | `3001`                | Sets the HTTP port.                                                                 |
| `PLATFORM_NAME`                                             | `Agentic`             | Names the API and OpenAPI document.                                                 |
| `CORS_ORIGINS`                                              | empty                 | Lists exact, comma-separated browser origins. Empty disables CORS.                  |
| `SWAGGER_ENABLED`                                           | on outside production | Enables Swagger, Scalar, and OpenAPI JSON. Set it explicitly in production.         |
| `REALTIME_PLAYGROUND_ENABLED`                               | on outside production | Enables the embedded same-origin Socket.IO chat tester.                             |
| `OBSERVE_ENABLED`                                           | `false`               | Enables NestJS Observe when valid credentials are present.                          |
| `VOICE_ENABLED`                                             | `false`               | Enables LiveKit Cloud voice credentials and the voice worker.                       |
| `VOICE_PROVIDER`                                            | `livekit`             | Chooses LiveKit Inference or the direct `openai` adapter.                           |
| `VOICE_MODEL`                                               | `gpt-realtime-2.1`    | Selects the realtime speech-to-speech model.                                        |
| `VOICE_NAME`                                                | `marin`               | Selects the realtime model voice.                                                   |
| `LIVEKIT_URL`                                               | empty                 | LiveKit Cloud WebSocket URL; required when voice is enabled.                        |
| `LIVEKIT_API_KEY`                                           | empty                 | Server-side LiveKit key; required when voice is enabled.                            |
| `LIVEKIT_API_SECRET`                                        | empty                 | Server-side LiveKit secret; required when voice is enabled.                         |
| `LIVEKIT_AGENT_NAME`                                        | `agentic-voice`       | Explicit dispatch name shared by tokens and the worker.                             |
| `LIVEKIT_PHONE_NUMBER`                                      | empty                 | Optional provisioned E.164 number displayed at startup; does not provision routing. |
| `MODEL_TIMEOUT_MS`                                          | `60000`               | Maximum duration of a text model run, including hosted search.                      |
| `WEB_SEARCH_ENABLED`                                        | `true`                | Makes hosted web search available for model-selected use.                           |
| `WEB_SEARCH_ALLOWED_DOMAINS`                                | empty                 | Optional comma-separated allowlist of up to 100 domain names.                       |
| `CONTEXT_DEV_ENABLED`, `FIRECRAWL_ENABLED`, `VALYU_ENABLED` | `false`               | Independently enable optional external tools.                                       |
| `CONTEXT_DEV_API_KEY`, `FIRECRAWL_API_KEY`, `VALYU_API_KEY` | empty                 | Required only for the corresponding enabled provider.                               |
| `EXTERNAL_TOOLS_TIMEOUT_MS`                                 | `15000`               | Maximum wait per external tool call (1–60 seconds).                                 |
| `EXTERNAL_TOOLS_MAX_CALLS`                                  | `5`                   | Shared call budget per chat run or voice conversation (1–20).                       |
| `EXTERNAL_TOOLS_MAX_RESULTS`                                | `5`                   | Maximum sources returned by one tool call (1–10).                                   |
| `EXTERNAL_TOOLS_MAX_CHARS`                                  | `12000`               | Total content characters returned by one tool call (1,000–30,000).                  |
| `SESSION_TTL_MS`                                            | `1800000`             | Sliding lifetime of an in-memory REST chat session.                                 |
| `SESSION_MAX_TURNS`                                         | `50`                  | Maximum completed turns in one in-memory session.                                   |
| `SESSION_MAX_TOKENS`                                        | `32000`               | Estimated context budget that triggers bounded summarization.                       |

Never use `*` in `CORS_ORIGINS`. The server accepts only complete HTTP or HTTPS origins without paths.

## Project structure

API versions own their transport contracts and controllers. Reusable feature logic stays in unversioned modules, while provider SDK adapters stay under `lib/`. V2 remains empty until a contract or implementation genuinely changes.

```text
src/                      # Application source.
├── app/                  # Root application and health endpoints.
├── bootstrap/            # Security, validation, documentation, and startup setup.
├── cli/                  # Standalone Nest application context for terminal commands.
├── config/               # Runtime configuration and executable application setup.
│   ├── agent/            # Shared Agentic identity and channel-specific delivery rules.
│   ├── livekit/          # LiveKit voice agent and worker configuration.
│   ├── schema/           # All Zod schemas, grouped by feature; shared inferred types.
│   ├── web-tools/        # Tool registration, limits, source policy, and Nest wiring.
│   └── playground/       # Same-origin chat and voice playground.
├── dto/                  # Versioned API input and output contracts.
├── lib/                  # Shared provider and infrastructure adapters.
│   ├── livekit/          # Reusable LiveKit SDK adapter and Nest provider.
│   ├── openai/           # OpenAI agent execution, streaming, and model routing.
│   └── context-dev/, firecrawl/, valyu/ # Optional provider modules and services.
├── middleware/           # Global HTTP behavior.
│   ├── commons/         # Shared response and request utilities.
│   ├── filters/         # Global exception handling.
│   ├── errors/          # Stable, deliberately public application errors.
│   └── interceptors/    # Global response transformation.
├── modules/              # Feature modules separated by API version.
│   ├── v1/              # Stable version 1 features, including chat and voice.
│   ├── v2/              # Clean boundary reserved for changed v2 contracts.
├── cli.ts                # Standalone CLI entry point.
├── main.ts               # HTTP and Socket.IO application entry point.
└── voice.ts              # LiveKit Agents worker entry point.
test/                     # All automated tests.
├── e2e/                  # Assembled HTTP and Socket.IO tests.
├── smoke/                # Explicit opt-in tests against real providers.
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
- ✅ Verify a real provider response with a documented local smoke-test command.
- ✅ Map provider authentication, timeout, rate-limit, and availability failures to stable application errors.

Completion: v1 returns a live model response, rejects invalid input, and exposes useful provider failures without leaking secrets; v2 remains clean until it differs.

### 3. CLI and Socket.IO streaming

- ✅ Add a CLI that uses the same application services as the REST API.
- ✅ Stream model output over the CLI and a versioned Socket.IO namespace.
- ✅ Provide an embedded same-origin playground for testing Socket.IO streams.
- ✅ Add LiveKit Cloud voice with environment-switched LiveKit Inference and direct OpenAI adapters.
- ✅ Issue short-lived, room-scoped, microphone-only voice tokens without exposing secrets.
- ✅ Cancel active CLI and Socket.IO turns without persisting partial sessions.
- ✅ Display tokens, estimated cost, model calls, tool calls, and safe provider errors.
- ✅ Add configurable model timeouts and explicit non-zero CLI exit codes.
- ⬜ Display human approval requests when privileged tools are introduced.

Completion: a user can start and cancel a streaming chat from the CLI or Socket.IO without duplicated agent logic.

### 4. Structured outputs and conversation sessions

- ✅ Define schema-validated structured outputs for tasks that need machine-readable results.
- ✅ Add in-memory Socket.IO and CLI sessions without claiming durability.
- ✅ Support session creation, continuation, expiration, and deletion.
- ✅ Enforce token and turn limits, and summarize context before it exceeds its budget.
- ✅ Test concurrent session isolation and malformed model output.

Completion: two concurrent sessions preserve separate context and every structured response passes its declared schema.

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
docker run --rm --read-only --tmpfs /tmp --publish 3001:3000 agentic:local
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
