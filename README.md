# Agentic

Working notes for building AI agents with different providers. `main` holds the shared NestJS app. Each provider gets its own branch, so its setup and examples stay separate.

OpenAI comes first. Mastra, Claude, and later providers each get a branch when that work starts.

## Branches

- `main` — shared NestJS application
- `openai` — OpenAI agents
- `mastra` — Mastra agents
- `claude` — Claude agents

Start the next provider the same way: branch from `main`, and keep that provider's work on its branch.

## Setup

```bash
bun install
```

## Run

```bash
# development
bun run start

# watch mode
bun run start:dev

# production
bun run start:prod
```

## Tests

```bash
bun run test
bun run test:e2e
bun run test:cov
```

## Observability

In production, observability shows how the system behaves, catches problems early, and keeps performance reliable.

[NestJS Observe](https://observe.nestjs.com) instruments the NestJS app and sends that signal with little setup:

- **Distributed tracing:** Follow a request across services and see how it moves through the system.
- **Waterfall analysis:** See the request timeline and find slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Watch performance as it happens and find the spots that need work.
- **Metrics:** Track application and infrastructure metrics for health and performance trends.
- **Logging:** Keep logs with the traces and other telemetry that explain them.
- **Error tracking:** Catch errors and inspect the context around their cause.
- **SLA monitoring:** Track service-level objectives and see when the app nears or passes a threshold.
- **Alarms and alerts:** Alert on critical errors, slowdowns, SLA breaches, and other anomalies.
