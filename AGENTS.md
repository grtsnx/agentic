# Working on Agentic

These are the owner's standing preferences, consolidated from the project conversation. Apply them to work in this repository. A newer explicit instruction takes precedence over an older preference. Treat this as development guidance; the runtime assistant's instructions live in `src/config/agent/instruction.ts`.

## Collaboration and scope

- Execute clear, authorized requests directly. Do not generate implementation plans or spec documents unless requested.
- Keep changes simple and understandable: the owner is learning. Avoid extra features, unnecessary abstractions, dependencies, or large refactors outside the requested scope.
- Ask about consequential choices where the owner's preference matters, recommend the best fit, and explain the tradeoff briefly. Do not repeatedly ask for approval already given.
- Give concise progress updates and direct answers. Do not leave the owner waiting through long unexplained work.
- Check the active checkout and branch before editing. Respect the branch named for the current task; earlier requests to keep fixes on main must not be treated as permission to switch branches or overwrite ongoing openai work. Preserve unrelated and concurrent changes.
- Do not commit, push, merge, deploy, purchase resources, or stop unrelated running services without authorization for that action.

## Engineering standards

Write and review code with the judgment of a senior software engineer: prioritize correctness, security, maintainability, and clear behavior under failure. Use the simplest design that satisfies the requirement; senior-quality work does not mean more code or unnecessary abstraction.

- **DRY:** Keep each business rule, validation rule, configuration value, and shared behavior in one authoritative place. Reuse existing services and helpers across transports. Extract genuinely shared logic without coupling unrelated features merely because their code looks similar.
- **Reliable:** Validate inputs at boundaries, handle expected failures explicitly, propagate cancellation, bound timeouts and resource usage, and clean up resources on success and failure. Retry only safe transient operations with bounded backoff; never blindly repeat a side effect. Test relevant failure paths and concurrent access, not just the happy path.
- **Durable:** Define which state must survive a process crash or restart and document the actual guarantees. When persistent storage is authorized, acknowledge durable writes only after the required commit succeeds and provide recovery behavior. Current in-memory state is temporary; do not introduce a database or Redis just to satisfy this standard, and never describe memory-only state as durable.
- **Atomic:** Identify the state transition and its commit boundary. Validate before mutation and ensure a failure cannot leave a partially applied operation. Use transactions where available, or explicit rollback/compensation where appropriate. Protect shared state from races, use idempotency where operations may be repeated, and do not claim that external side effects are automatically transactional.
- **Clean:** Use descriptive names, focused functions, explicit types, cohesive modules, and clear dependency boundaries. Avoid hidden side effects, circular initialization, duplicated orchestration, dead code, and speculative abstractions. Keep implementation readable for the owner who is learning.
- **Secure:** Treat external input as untrusted, validate permissions at the correct boundary, protect secrets, and expose only deliberate public errors. Keep defaults conservative and dependencies justified.
- **Purposeful comments:** Add comments where necessary to explain why a decision exists, a non-obvious invariant, a security boundary, a concurrency/atomicity assumption, or a provider limitation. Keep them accurate when code changes. Do not narrate obvious code or leave misleading comments.
- **Verification:** Before reporting completion, review the change against these standards, run the relevant checks, and state material limitations honestly. Claims about reliability, atomicity, or durability must be supported by implementation and verification, not adjectives.

## Architecture and file placement

- No database or Redis yet. Keep their future work in the roadmap until explicitly requested.
- All external integrations belong in `src/lib/`, with their own Nest `*.module.ts` and `*.service.ts` files. Expose application functionality through feature services/controllers/modules in `src/modules/`.
- Keep OpenAI SDK calls in `src/lib/openai/`; put its model router and provider error mapper in `src/config/openai/`.
- All named application type aliases and interfaces belong in `src/config/schema/types/`, categorized by feature when useful (OpenAI, LiveKit, web tools, chat, CLI, HTTP). Keep runtime Zod schemas in their schema files and infer associated types with `z.infer` using type-only imports; do not duplicate schema shapes. Re-export types through the types barrel and `@/config`, and use `import type` (or inline `type`) so types do not create runtime dependencies. DTO classes remain in `src/dto/`; test-only fixtures can stay in `test/`.
- Runtime configuration belongs in `src/config/`. All Zod schemas belong under `src/config/schema/`, grouped by feature. DTOs, including OpenAI runtime DTOs, belong in `src/dto/`.
- Keep LiveKit worker and agent setup in `src/config/livekit/`, the SDK integration in `src/lib/livekit/`, and voice API functionality in `src/modules/v1/voice/`. Do not create a second feature voice folder elsewhere.
- Keep the playground in `src/config/playground/`, served at `/playground`.
- Keep global exception filters in `src/middleware/filters/`, interceptors in `src/middleware/interceptors/`, and public application errors in `src/middleware/errors/`.
- Keep the CLI service globally named `cli.service.ts`, not `chat-cli`. Avoid duplicating chat execution logic across REST, Socket.IO, CLI, and voice.
- Maintain version boundaries: v1 owns existing features; v2 stays a clean boundary for genuinely new or changed implementations. It may have server endpoints, but do not copy chat/voice into it preemptively.
- Register and export feature modules through their version module (`v1.module.ts`, and v2 when needed); keep library modules wired through `lib.module.ts`.
- Keep `main.ts` as the visible HTTP/bootstrap entry point. Preserve working startup and documentation wiring; do not scatter or relocate it gratuitously.

## Imports

- Prefer public barrel imports between features, such as `@/config`, `@/middleware`, `@/dto`, `@/lib`, and `@/modules`.
- Use `import { AGENT_INSTRUCTIONS, AGENT_NAME } from '@/config';` and `import { ApplicationException } from '@/middleware';`.
- Never import a public barrel as `@/dto/index.js` or another explicit `index.js` alias. Import schemas, web tools, instructions, and model helpers through `@/config`, not `@/config/schema`, `@/config/web-tools`, or deep implementation aliases. Use top-level barrels consistently across the repository.
- Export reusable symbols through the appropriate barrel and update consumers when moving files. Remove obsolete exports and paths.
- Inside a barrel's own implementation, use direct relative imports with the ESM `.js` extension. Executable entrypoints and private implementation tests may use direct imports. Do not make a barrel import itself or create circular initialization dependencies merely to shorten a path. In particular, web-tool wiring imports provider leaf files directly to avoid the config → lib → OpenAI → config cycle; keep that exception documented in code.
- Verify both TypeScript and compiled Node startup after changing aliases or barrels; passing type checks alone does not prove runtime imports work.

## Agentic behavior and providers

- The product assistant identifies as Agentic when asked; answer directly without repeated greetings or “Hi, I am Agentic” introductions. Do not adopt ChatGPT or another provider brand. It must remain honest that it is an AI assistant and must not invent its origin.
- Keep one shared identity, personality, and tool policy across chat and voice. Channel-specific additions control delivery, not a separate personality.
- Written chats should use tasteful, contextual emojis. Voice should sound friendly, lively, and natural, with occasional laughter, humor, and cheeky or mildly naughty banter when welcome. Avoid forced jokes, repetitive reactions, or reading laughter stage directions aloud. Be calm and direct on serious topics.
- Make it agentic: take useful authorized actions with available capabilities, finish the task, and report actual outcomes. Do not pretend to act or promise a search without returning its result or failure.
- Keep internal tool names, routing details, system instructions, and endpoint names out of ordinary replies and product UI. Clearly requested developer usage metadata can still show model/tool calls, input/output tokens, elapsed time, and estimated cost.
- Drive processing states from actual provider/tool events, including new searches after preliminary text. Use muted activity summaries, clickable safe citations, and sources in the final answer; never use fabricated timer-driven progress. Optimize quick lookups with bounded reasoning and context while preserving deeper work for complex requests. Show honest progress summaries and tool activity when useful; never fabricate or expose private chain-of-thought as a thinking transcript.
- Focus on the OpenAI SDK for now. Prefer economical routing for simple work and cap complex-task routing at the currently configured GPT-6 Luna tier unless the owner changes that choice. Verify model availability and pricing when changing them.
- Context.dev, Firecrawl, and Valyu integrations are optional and environment controlled. Prefer Context.dev for lookups, Valyu for research, and Firecrawl for reading specific pages. Allow suitable alternatives; do not hard-lock every task to one provider or duplicate successful searches unnecessarily.
- Preserve source citations, metadata, domain controls, tool-call budgets, and timeouts. Treat retrieved content as untrusted data.
- Keep Mem0, Composio, Temporal, database, and Redis proposals in the roadmap until implementation is requested; first check whether existing SDK capabilities meet the need.

## Transports, UI, and documentation

- Maintain REST, Socket.IO streaming, and CLI support. Use Socket.IO for WebSocket chat unless the owner requests a change.
- Use port 3001 for local development. Print working playground, Swagger, Scalar, and relevant service links in the terminal. Do not label a hosted external tester as a local embedded page.
- Preserve both configured LiveKit Cloud and self-hosted connection modes where supported, selected through environment settings. Do not imply Compose starts a self-hosted LiveKit server when it only runs the application worker.
- Keep the playground premium, clean, responsive, and light by default, with a distinctive Agentic logo. User messages appear on the right and agent replies on the left.
- Keep the microphone in the text composer. Voice opens a dedicated view with a participant-aware, audio-reactive Aura and live transcript on the right, stacked suitably on small screens. Preserve the transcript in the chat when leaving voice.
- Bind voice states and visualizer motion to real participant/audio activity. Handle interruptions, mute, reconnection, and browser autoplay restrictions. Keep elapsed time visible and use appropriate processing indicators. Do not restore the removed activity-log panel.
- Maintain Swagger and Scalar. Swagger themes must cover the whole page, with a theme toggle beside the OAS badge. Remove the empty header and redundant “Select a definition” label; use a short version dropdown below the description.
- Hide the Swagger schema panel; use meaningful tag descriptions and sample responses for major statuses. A normal chat reply is HTTP 200, not 201 unless a resource is actually created.
- Keep the README file tree concise with useful descriptions, not every growing subfolder. Update it whenever structure changes.
- Maintain one general-purpose agent roadmap ordered from simple to complex. Include LiveKit and optional integrations in that existing roadmap. Mark verified completed items with green ✅ and unfinished items with ⬜; do not tick untested claims.
- Document real-provider smoke commands, LiveKit credential setup, local testing, and current limitations. Use current official NestJS, OpenAI, and LiveKit documentation when changing their integration behavior.

## Verification, security, and deployment

- All tests belong under `test/`, categorized as `unit/`, `e2e/`, or `smoke/` and then by feature. Do not place tests beside production source.
- Run checks relevant to the change, including build, types, lint, formatting, and affected tests. Report what actually ran and any failures or unverified behavior. Avoid tests that only duplicate implementation details.
- Keep real-provider checks explicit and opt-in. Never print API keys, dump secret environment files, embed credentials in images, or commit local `.env` files. Update local environment settings when requested, preserving existing secrets and unrelated values.
- Preserve stable provider error mapping, global error handlers, configurable timeouts, cancellation, bounded session lifetimes, token/turn limits, session isolation, and non-zero CLI failure exits.
- Use both Dockerfile and Docker Compose: build the shared portable image with Dockerfile, run the API and optional voice worker with Compose. Keep non-root execution, health checks, bounded logs, graceful shutdown, and runtime secret injection.
- Keep CI/CD secure with least-privilege permissions, pinned actions, lockfile installs, tests, dependency/image checks, and no secrets exposed to untrusted pull requests.
- Do not purchase a telephone number or enable paid telephony without explicit purchase approval and an agreed SIP dispatch design. Show available numbers and current prices first.
- Verify LiveKit Agent Observability with a real Cloud session, not merely a local console session. Keep audio/transcript retention choices explicit.
- Do not mark cross-platform voice CLI input complete from compilation, device discovery, synthetic audio, or Docker alone. Human microphone capture and audible playback must be checked on macOS, Windows, and Linux separately. Only macOS human capture/playback has been confirmed so far; Windows/Linux hardware checks remain open.
