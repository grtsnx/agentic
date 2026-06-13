## Learned User Preferences

- Uses `bun` as the package manager, not npm; run scripts with `bun run <script>` (e.g. `bun run setup:pipeline`).
- Treats the plan/spec file `doc/instruct.md` as read-only — implement against it but do not edit it.

## Learned Workspace Facts

- NestJS provisioning pipeline lives under `src/pipeline/`; it creates a Vault, an Environment, and 26 Claude Managed Agents on the Anthropic beta Managed Agents API and writes their IDs to `output/`.
- Run the pipeline with `bun run setup:pipeline` (maps to `bun src/pipeline/pipeline.command.ts`).
- In `.env`, payment provider keys (Stripe, LemonSqueezy, Paddle, Paystack, PayPal) and `HIGGSFIELD_API_KEY` are optional; the pipeline skips those features when the keys are missing (e.g. video agent is skipped without Higgsfield).
- Email "from" address domain is configured via the `EMAIL_DOMAIN` env var (the Email Agent interpolates it as `{custom}@${EMAIL_DOMAIN}`); do not hardcode a brand/domain name in code or README.
- Reruns of `setup:pipeline` are idempotent (agents are matched by name and updated in place); `bun run archive:duplicates` cleans up duplicate agents from earlier runs.
- Refero MCP (`https://api.refero.design/mcp`, needs Refero Pro) is optional, gated on `REFERO_API_KEY`. When set, the vault gets a `static_bearer` credential bound to the MCP URL and the Design + Research agents attach the `refero` URL MCP server; when unset, both agents build without it. Config lives in `src/pipeline/config/mcps.config.ts` (`referoEnabled`, `REFERO_MCP_URL`).
