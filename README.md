<div align="center">

# 🤖 AI Builder — Agent Setup

**The "brain" behind an AI website-and-app builder.**

Run one command and it provisions **26 specialized AI agents** on your Anthropic
account — each an expert at one job (research, design, code, deploy…) — coordinated
by a single orchestrator agent.

<sub>Built with</sub>
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Anthropic](https://img.shields.io/badge/Anthropic-Managed%20Agents-D4A27F)](https://console.anthropic.com/)

</div>

> [!NOTE]
> You do **not** need to be a programmer to run this. Just follow the
> [Step-by-step guide](#-step-by-step-guide) in order.

---

## 📑 Contents

- [What it does](#-what-it-does)
- [Quick start](#-quick-start)
- [Step-by-step guide](#-step-by-step-guide)
- [Environment variables](#-environment-variables)
- [Re-running & cleanup](#-re-running--cleanup)
- [FAQ](#-faq)
- [Troubleshooting](#-troubleshooting)
- [The 27 agents](#-the-27-agents)
- [For developers](#-for-developers)

---

## ✨ What it does

Running the setup command **once** will:

| Step | What happens |
| :--: | :-- |
| 1️⃣ | **Loads your vault** — a secure box on Anthropic's servers that holds your API keys |
| 2️⃣ | **Uses your environment** — the workspace the agents run inside |
| 3️⃣ | **Creates 27 agents** — the AI workers (see [the full list](#-the-27-agents)) |
| 4️⃣ | **Saves the results** — writes every agent ID to a file other apps can read |

It's a **one-time provisioning step**, not something that runs all day.

```mermaid
flowchart LR
    A([💡 Your idea]) --> B[Intent · Conversation · Audit]
    B --> C[Research · Design · Asset · Video]
    C --> D[Schema · CMS · Email · Payments · i18n]
    D --> E[CodeWriter]
    E --> F[QA · Security · Accessibility · Performance]
    F --> G[RunDev → Test → Preview → Deploy]
    G --> H([🚀 Live app])
```

---

## ⚡ Quick start

> Already have Bun and your three Anthropic values? Do this:

```bash
bun install
cp .env.example .env        # then fill in the 3 required values
bun run setup:pipeline
```

New here? Follow the full guide below. 👇

---

## 🧭 Step-by-step guide

### 1. Install Bun (one time)

Bun is the tool that runs this project.

**macOS / Linux**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows (PowerShell)**
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Close and reopen your terminal, then confirm it works:
```bash
bun --version   # a version number like 1.3.14 means you're good
```

### 2. Get your 3 Anthropic values

Everything you need comes from the **[Anthropic Console](https://console.anthropic.com)**.

| Value | Where to get it |
| :-- | :-- |
| `ANTHROPIC_API_KEY` | **API Keys** → *Create Key* (starts with `sk-ant-…`) |
| `ANTHROPIC_ENVIRONMENT_ID` | **Managed Agents → Environments** → create one → copy its ID (`env_…`) |
| `ANTHROPIC_VAULT_ID` | **Managed Agents → Vaults** → create one → copy its ID (`vlt_…`) |

> [!WARNING]
> Treat your API key like a password. Never share it or commit it publicly.

### 3. Set up the project

```bash
cd path/to/agents     # the folder where this project lives
bun install           # install dependencies
cp .env.example .env  # create your settings file
```

### 4. Add your values to `.env`

Open `.env` in any text editor and fill in the three **required** values:

```ini
ANTHROPIC_API_KEY=sk-ant-your-key-here
ANTHROPIC_ENVIRONMENT_ID=env_your-environment-id
ANTHROPIC_VAULT_ID=vlt_your-vault-id
```

Everything else is **optional** — see [Environment variables](#-environment-variables).
Save the file.

### 5. Run it 🚀

```bash
bun run setup:pipeline
```

You'll see live progress:

```text
📦 Step 1/4: Vault
🌍 Step 2/4: Environment
🤖 Step 3/4: Agents
   ✅ Intent Agent  → agent_01EU...
   ✅ Design Agent  → agent_01Wv...
   ...
💾 Step 4/4: Saving agents.config.json
   ✅ Pipeline setup complete!
```

When it finishes, all 26 agent IDs are saved to:

```text
src/pipeline/output/agents.config.json
```

🎉 **You're done.**

---

## 🔑 Environment variables

There are **3 required** values (all from the Anthropic Console). Everything else is
optional: leave an optional key blank and the project simply skips that feature with a
friendly `Skipping…` note instead of failing.

### Required

| Key | What it's for | Where to get it |
| :-- | :-- | :-- |
| `ANTHROPIC_API_KEY` | Talking to Anthropic's AI | [Console → API Keys](https://console.anthropic.com/settings/keys) |
| `ANTHROPIC_ENVIRONMENT_ID` | The workspace agents run in | [Console](https://console.anthropic.com) → Managed Agents → Environments |
| `ANTHROPIC_VAULT_ID` | The secure vault for your keys | [Console](https://console.anthropic.com) → Managed Agents → Vaults |

### Optional (turn features on)

<details>
<summary><strong>Show all optional keys</strong></summary>

| Key | Feature | Where to get it |
| :-- | :-- | :-- |
| `INSFORGE_API_KEY` | Database | Your [InsForge](https://insforge.dev) dashboard → API Keys |
| `COOLIFY_API_TOKEN` | Deploy / preview sites | Your [Coolify](https://coolify.io) instance → Keys & Tokens |
| `UNSPLASH_ACCESS_KEY` | Stock photos | [Unsplash Developers](https://unsplash.com/developers) |
| `R2_*` keys | File / image storage | [Cloudflare → R2 → API Tokens](https://dash.cloudflare.com/?to=/:account/r2/api-tokens) |
| `RESEND_API_KEY` | Sending emails | [Resend → API Keys](https://resend.com/api-keys) |
| `EMAIL_DOMAIN` | Your verified send domain — emails go out as `{name}@EMAIL_DOMAIN` | [Resend → Domains](https://resend.com/domains) |
| `STRIPE_SECRET_KEY` | Payments (Stripe) | [Stripe → API keys](https://dashboard.stripe.com/apikeys) |
| `LEMONSQUEEZY_API_KEY` | Payments (Lemon Squeezy) | [Lemon Squeezy → API](https://app.lemonsqueezy.com/settings/api) |
| `PADDLE_API_KEY` | Payments (Paddle) | [Paddle → Authentication](https://vendors.paddle.com/authentication-v2) |
| `PAYSTACK_SECRET_KEY` | Payments (Paystack) | [Paystack → API Keys](https://dashboard.paystack.com/#/settings/developers) |
| `PAYPAL_CLIENT_SECRET` | Payments (PayPal) | [PayPal → Apps & Credentials](https://developer.paypal.com/dashboard/applications) |
| `HIGGSFIELD_API_KEY` | AI video (video agent skipped without it) | [Higgsfield](https://higgsfield.ai) → API access |
| `REFERO_API_KEY` | Design research — grounds the Design & Research agents in real product screens via [Refero MCP](https://api.refero.design/mcp) (needs Refero Pro) | [Refero → MCP](https://refero.design/mcp) |
| `DAYTONA_*` keys | Sandboxed dev environments | [Daytona → Keys](https://app.daytona.io/dashboard/keys) |

</details>

---

## 🔁 Re-running & cleanup

**Safe to run again any time.** The setup is **idempotent** — re-running finds each agent
by name and **updates it in place** instead of creating a duplicate. Tweak an agent, then:

```bash
bun run setup:pipeline
```

Got leftover duplicates from an early/failed run? Clean them up with:

```bash
bun run archive:duplicates
```

This keeps one agent per name (preferring the IDs in `agents.config.json`) and archives the
rest. Agents with a unique name are never touched.

---

## ❓ FAQ

<details>
<summary><strong>Do I need to keep this running?</strong></summary>

No. It's a one-time setup. Run it, it creates the agents, it stops.
</details>

<details>
<summary><strong>It said "Skipping … not in env" — did something break?</strong></summary>

No, that's normal. It just means an optional key was blank, so that feature was skipped on
purpose.
</details>

<details>
<summary><strong>Where do the agent IDs go?</strong></summary>

Into `src/pipeline/output/agents.config.json` after a successful run.
</details>

<details>
<summary><strong>Which address do emails come from?</strong></summary>

From whatever domain you set in `EMAIL_DOMAIN` (e.g. `noreply@your-domain.com`). It must be
a domain you've verified with Resend.
</details>

---

## 🛠 Troubleshooting

| Message | Meaning | Fix |
| :-- | :-- | :-- |
| `Configuration key ANTHROPIC_API_KEY does not exist` | Key is missing | Ensure `.env` exists and has `ANTHROPIC_API_KEY` filled in |
| `401` / `authentication` error | Key is wrong or expired | Create a fresh key in the Console and paste it again |
| `command not found: bun` | Bun isn't installed | Reinstall Bun (step 1) and reopen your terminal |
| `Skipping … not in env` | An optional key is blank | Safe to ignore — unless you wanted that feature |

> Still stuck? Copy the full error message and share it with whoever set this project up.

---

## 🧩 The 27 agents

<details>
<summary><strong>See all agents, grouped by pipeline stage</strong></summary>

| Stage | Agents |
| :-- | :-- |
| 🧠 Understand the request | Intent · Conversation · Audit |
| 🎨 Look & content | Research · Design · Asset · Video · Animation |
| 🗄️ Data & features | Schema · CMS · Email · Payments · i18n |
| 🏗️ Build the app | CodeWriter |
| ✅ Quality & security checks | QAS · Security · Accessibility · Performance |
| 🚀 Run, fix & ship | RunDev · AutoFix · Testing · Preview · Deploy · Version |
| 🔌 Extras | CustomMCP · KnowledgeBase |
| 🎯 The conductor | Orchestrator (coordinates everything above) |

</details>

---

## 🎨 Component library (shadcn / HeroUI)

The generated site uses a real component library, chosen **per project** by the Design Agent
and written by the CodeWriter:

- **shadcn/ui** (default) — marketing sites, landing pages, content-heavy and highly
  custom/animated designs.
- **HeroUI** — app-like UIs: dashboards, admin panels, SaaS app shells, data-dense tools.

To write correct, current code the CodeWriter is given **live web access** (it reads the
official shadcn/HeroUI docs while generating) and uses the **shadcn CLI** (`npx shadcn add`)
to install real components instead of guessing. It does **not** use the editor's local
shadcn/HeroUI MCP servers or Cursor skills — those are IDE tools and can't run inside the
deployed Anthropic agents, which only support remote URL MCPs and the built-in toolset.

---

## 👩‍💻 For developers

This is a [NestJS](https://nestjs.com/) project.

```bash
bun install                # install dependencies
bun run build              # type-check / compile
bun run setup:pipeline     # provision (or update) the 27 agents  ← main command
bun run archive:duplicates # archive duplicate agents from old runs
bun run start:dev          # run the Nest app in watch mode
bun run test               # run unit tests
bun run smoke              # boot the full DI graph (no network / no API key)
bun audit --audit-level=high  # scan dependencies for known CVEs
```

### Continuous integration

Every push and pull request to `main` runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml),
which fans out into four independent jobs:

| Job | Command | What it guards |
| --- | --- | --- |
| 🔍 **Audit** | `bun audit --audit-level=high` | Fails on high/critical dependency CVEs |
| 🏗 **Build** | `bun run build` | Compiles + type-checks the whole project |
| 🧪 **Test** | `bun run test:ci` | Runs the Jest unit suite |
| 💨 **Smoke** | `bun run smoke` | Boots the 27-agent DI graph — no network, no secrets |

The smoke job catches broken wiring (missing providers, circular deps) without
ever calling the Anthropic API, so it stays fast and needs no credentials.

**Project layout**

```text
src/pipeline/
├── pipeline.service.ts     # orchestrates the whole setup
├── agents/                 # one file per agent (27 total)
├── config/                 # models, tools, and MCP server config
├── vault/ · environment/   # vault + environment provisioning
└── output/                 # generated agents.config.json
doc/instruct.md             # original specification (read-only)
```
