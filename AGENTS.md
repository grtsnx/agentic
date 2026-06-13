## Learned User Preferences

- Uses `bun` as the package manager, not npm; run scripts with `bun run <script>` (e.g. `bun run setup:pipeline`).
- Treats the plan/spec file `doc/instruct.md` as read-only — implement against it but do not edit it.

## Learned Workspace Facts

- NestJS provisioning pipeline lives under `src/pipeline/`; it creates a Vault, an Environment, and 26 Claude Managed Agents on the Anthropic beta Managed Agents API and writes their IDs to `output/`.
- Run the pipeline with `bun run setup:pipeline` (maps to `bun src/pipeline/pipeline.command.ts`).
- In `.env`, payment provider keys (Stripe, LemonSqueezy, Paddle, Paystack, PayPal) and `HIGGSFIELD_API_KEY` are optional; the pipeline skips those features when the keys are missing (e.g. video agent is skipped without Higgsfield).
- Email "from" address follows the `{custom}@snapblock.app` pattern (domain `snapblock.app`).
