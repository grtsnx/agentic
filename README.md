# AI Builder — Agent Setup

This project sets up the "brain" behind an AI website-and-app builder. When you run
it once, it creates **26 specialized AI agents** on your Anthropic account. Each agent
is good at one job (researching, designing, writing code, deploying, etc.), and a final
"orchestrator" agent knows how to make them work together.

You do **not** need to be a programmer to run this. Just follow the steps below in order.

---

## What this actually does

When you run the setup command one time, it will:

1. **Create a secure vault** — a locked box on Anthropic's servers that safely stores
   your service passwords (API keys).
2. **Create an environment** — the workspace the agents run inside.
3. **Create 26 agents** — the AI workers listed at the bottom of this page.
4. **Save the results** — it writes a file with all the agent IDs so other apps can use them.

That's it. It's a one-time provisioning step, not something that runs all day.

---

## Before you start (one-time install)

You need two free things installed on your computer.

### 1. Bun (runs the project)

Bun is the tool that runs this project. Open your terminal and paste this:

**Mac or Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows (PowerShell):**
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

After it finishes, close and reopen your terminal, then check it works:
```bash
bun --version
```
If you see a version number (like `1.3.14`), you're good.

### 2. An Anthropic API key (the only required key)

This is the password that lets the project talk to Anthropic's AI.

1. Go to **https://console.anthropic.com**
2. Sign in (or create an account).
3. Open **API Keys** and click **Create Key**.
4. Copy the key — it starts with `sk-ant-...`. Keep it somewhere safe for the next step.

> ⚠️ Treat this key like a password. Never share it or post it publicly.

---

## Setup (do this once)

### Step 1 — Open the project in your terminal

```bash
cd path/to/agents
```
(Replace `path/to/agents` with the folder where this project lives.)

### Step 2 — Install the project

```bash
bun install
```

### Step 3 — Create your settings file

The project reads your keys from a file called `.env`. There's a template called
`.env.example`. Copy it to make your own:

```bash
cp .env.example .env
```

### Step 4 — Add your Anthropic key

Open the new `.env` file in any text editor and paste your key after `ANTHROPIC_API_KEY=`:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**That's the only required value.** Everything else is optional (see the table below).
Save the file.

---

## Run it

```bash
bun run setup:pipeline
```

Sit back and watch. You'll see progress messages like:

```
📦 Step 1/4: Vault
🌍 Step 2/4: Environment
🤖 Step 3/4: Agents
   ✅ Intent Agent → agent_01EU...
   ✅ Design Agent → agent_01Wv...
   ...
💾 Step 4/4: Saving agents.config.json
   ✅ Pipeline setup complete!
```

When it finishes, all 26 agent IDs are saved to:
```
src/pipeline/output/agents.config.json
```

🎉 You're done.

---

## Which keys do I need?

Only **`ANTHROPIC_API_KEY`** is required. Everything else is optional — if you leave a key
blank, the project simply skips that feature and prints a friendly "Skipping…" note instead
of failing.

| Key | Required? | What it's for | Where to get it |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | ✅ **Required** | Talking to Anthropic's AI | [Anthropic Console → API Keys](https://console.anthropic.com/settings/keys) |
| `ANTHROPIC_ENVIRONMENT_ID` | Pre-filled | Reuses an existing workspace (leave as-is) | Created automatically by the setup |
| `ANTHROPIC_VAULT_ID` | Pre-filled | Reuses an existing vault (leave as-is) | Created automatically by the setup |
| `INSFORGE_API_KEY` | Optional | Database features | Your [InsForge](https://insforge.dev) dashboard → API Keys |
| `COOLIFY_API_TOKEN` | Optional | Deploying/previewing websites | Your [Coolify](https://coolify.io) instance → Keys & Tokens → API tokens |
| `UNSPLASH_ACCESS_KEY` | Optional | Stock photos | [Unsplash Developers](https://unsplash.com/developers) → Your apps |
| `R2_*` keys | Optional | File/image storage | [Cloudflare Dashboard → R2 → API Tokens](https://dash.cloudflare.com/?to=/:account/r2/api-tokens) |
| `RESEND_API_KEY` | Optional | Sending emails | [Resend → API Keys](https://resend.com/api-keys) |
| `EMAIL_DOMAIN` | Optional | Your verified email domain (e.g. `example.com`). Emails are sent from `{name}@EMAIL_DOMAIN` | [Resend → Domains](https://resend.com/domains) (must be verified) |
| `STRIPE_SECRET_KEY` | Optional | Payments via Stripe | [Stripe Dashboard → API keys](https://dashboard.stripe.com/apikeys) |
| `LEMONSQUEEZY_API_KEY` | Optional | Payments via Lemon Squeezy | [Lemon Squeezy → Settings → API](https://app.lemonsqueezy.com/settings/api) |
| `PADDLE_API_KEY` | Optional | Payments via Paddle | [Paddle → Developer Tools → Authentication](https://vendors.paddle.com/authentication-v2) |
| `PAYSTACK_SECRET_KEY` | Optional | Payments via Paystack | [Paystack → Settings → API Keys & Webhooks](https://dashboard.paystack.com/#/settings/developers) |
| `PAYPAL_CLIENT_SECRET` | Optional | Payments via PayPal | [PayPal Developer → Apps & Credentials](https://developer.paypal.com/dashboard/applications) |
| `HIGGSFIELD_API_KEY` | Optional | AI video (video agent is skipped without it) | [Higgsfield](https://higgsfield.ai) → API access |
| `DAYTONA_*` keys | Optional | Sandboxed dev environments | [Daytona Dashboard → Keys](https://app.daytona.io/dashboard/keys) |

Add an optional key later only if you want that specific feature switched on.

---

## Frequently asked questions

**Do I need to keep this running?**
No. It's a one-time setup. Run it, it creates the agents, it stops.

**Can I run it again?**
Yes — it's safe. The setup is **idempotent**: re-running finds each agent by name and
**updates it in place** instead of creating a duplicate. So you can tweak an agent and
re-run `bun run setup:pipeline` to push the change.

**I have leftover duplicate agents from an early run — how do I clean them up?**
Run:
```bash
bun run archive:duplicates
```
This keeps one agent per name (preferring the ones in `agents.config.json`) and archives
the rest. Agents with a unique name are never touched.

**It said "Skipping … not in env" — did something break?**
No. That's normal. It just means you didn't fill in an optional key, so that feature was
skipped on purpose.

**Where do the agent IDs go?**
Into `src/pipeline/output/agents.config.json` after a successful run.

**Emails are sent from where?**
From whatever domain you set in `EMAIL_DOMAIN` in your `.env`, using addresses like
`noreply@your-domain.com` or `hello@your-domain.com`. It must be a domain you've verified
with Resend.

---

## Troubleshooting

| Message you see | What it means | What to do |
| --- | --- | --- |
| `Configuration key ANTHROPIC_API_KEY does not exist` | Your key is missing | Make sure `.env` exists and has your `ANTHROPIC_API_KEY` filled in |
| `401` / `authentication` error | The key is wrong or expired | Create a fresh key in the Anthropic Console and paste it again |
| `command not found: bun` | Bun isn't installed | Reinstall Bun (see "Before you start") and reopen your terminal |
| `Skipping … not in env` | An optional key is blank | Safe to ignore, unless you wanted that feature |

If you get stuck, copy the full error message and share it with whoever set this project up.

---

## The 26 agents (for the curious)

Grouped roughly by the order they run in:

- **Understanding your request:** Intent, Conversation, Audit
- **Look & content:** Research, Design, Asset, Video, Animation
- **Data & features:** Schema, CMS, Email, Payments, i18n (translations)
- **Building the app:** CodeWriter
- **Quality checks:** QAS, Accessibility, Performance
- **Run, fix & ship:** RunDev, AutoFix, Testing, Preview, Deploy, Version
- **Extras:** CustomMCP, KnowledgeBase
- **The conductor:** Orchestrator (coordinates all of the above)

---

## For developers

This is a [NestJS](https://nestjs.com/) project. Common commands:

```bash
bun install              # install dependencies
bun run build            # type-check / compile
bun run setup:pipeline   # provision (or update) the 26 agents (main command)
bun run archive:duplicates # archive duplicate agents from old runs
bun run start:dev        # run the Nest app in watch mode
bun run test             # run unit tests
```

Key locations:
- `src/pipeline/` — the provisioning pipeline (vault, environment, agents)
- `src/pipeline/agents/` — one file per agent
- `src/pipeline/config/` — models, tools, and MCP server config
- `doc/instruct.md` — the original specification (read-only)
