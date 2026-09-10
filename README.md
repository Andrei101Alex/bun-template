# Acme

> ⚠️ **This is a template.** It's a starter monorepo — the npm scope is a generic `@repo/*` and the brand is a placeholder, **Acme**. See [**Using this template**](#using-this-template) to start a new project from it, then delete this note and that section once it's yours.

A TypeScript monorepo managed with [Bun workspaces](https://bun.sh/docs/install/workspaces). It contains two frontends, a backend service with its own set of infrastructure packages, and a shared UI kit — all wired together with end-to-end type safety.

## Using this template

Start a new project in one of two ways:

**GitHub — "Use this template"**
On the repository page click **Use this template → Create a new repository**. You get a fresh repo (no git history) with every file below.

**`bun create` — from the terminal**

```bash
bun create Andrei101Alex/bun-template my-app
cd my-app
```

`bun create` copies the template's contents into `my-app/` (no git history), installs dependencies, then runs a short setup prompt that **offers to rebrand the template** — accept it to name your project, or decline to keep the `@repo/*` / **Acme** defaults. (In a non-interactive shell the prompt is skipped.)

### Rebrand it (optional)

Everything runs **as-is** — the internal scope is `@repo/*` and the placeholder brand is **Acme**. If you didn't rebrand at the `bun create` prompt (or you started from GitHub's "Use this template"), do it anytime with:

```bash
bun install              # required first, so the script can run
bun run rename my-shop   # → scope @my-shop/*, brand "My Shop", root name "my-shop"
```

It performs two safe token swaps plus the root package name:

| From | To | Where |
| --- | --- | --- |
| `@repo/*` | `@my-shop/*` | every `package.json`, import, tsconfig path, `components.json` alias |
| `Acme` | `My Shop` | titles, headings, API text |
| root `package.json` `"name"` | `my-shop` | workspace root |

Options: `--display "My Shop"` for a custom brand, `--scope <scope>` to override the derived scope, `--dry-run` to preview without writing. When done, delete the `scripts/` folder (`rename.ts` + `setup.ts`) and this **Using this template** section.

## Contents

- [Using this template](#using-this-template)
- [Stack](#stack)
- [Repository structure](#repository-structure)
- [How it works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Developing](#developing)
- [Command reference](#command-reference)

## Stack

| Area          | Tech                                                                  |
| ------------- | --------------------------------------------------------------------- |
| Package manager / runtime | [Bun](https://bun.sh) 1.4+ with workspaces                |
| Dashboard     | [Vite](https://vite.dev) SPA · [TanStack Router](https://tanstack.com/router) (file-based) · [TanStack Query](https://tanstack.com/query) |
| Website       | [Next.js](https://nextjs.org) 16 (App Router, RSC)                     |
| API           | [Elysia](https://elysiajs.com) on Bun                                  |
| Shared UI     | [shadcn/ui](https://ui.shadcn.com) · [Tailwind CSS v4](https://tailwindcss.com) · [Storybook](https://storybook.js.org) |
| Type-safe API client | [Eden Treaty](https://elysiajs.com/eden/overview.html)          |
| Database      | [Drizzle ORM](https://orm.drizzle.team) on [PGlite](https://pglite.dev) (embedded) or Postgres |
| Auth          | [Better Auth](https://better-auth.com) - sessions, admin roles, 2FA   |
| Email         | One `sendEmail` over an in-memory double or [Resend](https://resend.com) |
| Background work | Transactional outbox + [croner](https://croner.56k.guru) schedules  |
| Logging       | [pino](https://getpino.io)                                            |
| Tests         | `bun test`, backed by PGlite in memory                                |
| Lint / format | [Biome](https://biomejs.dev)                                          |

## Repository structure

```
my-app/
├── package.json              # workspace root: scripts + shared devDeps (biome, typescript)
├── biome.json                # single lint/format config for the whole repo
├── bunfig.toml               # bun install config (hoisted linker)
│
├── AGENTS.md                 # repo guidance for coding agents (CLAUDE.md symlinks to it)
│
├── apps/
│   ├── dashboard/            # @repo/dashboard - Vite SPA (port 5173)
│   └── website/              # @repo/website  - Next.js site (port 3000)
│
├── services/
│   └── api/                  # @repo/api - Elysia backend (port 3001)
│       ├── AGENTS.md         # where each kind of backend file goes
│       ├── scripts/          # check-imports.ts - the workspace's own `check`
│       ├── tests/            # flow tests + the test preload
│       └── src/
│           ├── entrypoints/  # one directory per process
│           │   ├── api/      # main.ts · app.ts (buildApp, type App) · env.ts
│           │   └── jobs/     # main.ts · env.ts - outbox consumer + schedules
│           ├── features/     # the product: health, auth, feedback, replies, email-bounces
│           └── plugins/      # what runs around a request: request id, logging,
│                             # error reporting/mapping, rate limit, staff guard
│
└── packages/
    ├── db/                   # @repo/db - Drizzle schema, migrations, connection
    ├── auth/                 # @repo/auth - the Better Auth instance
    ├── email/                # @repo/email - sendEmail + bounce signature verification
    ├── jobs/                 # @repo/jobs - outbox consumer, dead letters, schedules
    ├── observability/        # @repo/observability - logger, reportError
    ├── errors/               # @repo/errors - DomainError and its kinds
    ├── ui/                   # @repo/ui - shadcn components + Storybook (port 6006)
    └── typescript-config/    # @repo/typescript-config - shared tsconfig presets
```

Every internal package is namespaced under `@repo/*` and referenced via `workspace:*`, so imports always resolve to the local source — there is no publish/build step between packages.

### Packages at a glance

| Package                      | What it is                                                                 | Consumed by                        |
| ---------------------------- | ------------------------------------------------------------------------- | ---------------------------------- |
| `@repo/api`                | Elysia server, two processes: the api entry point and the jobs entry point. Exports `type App` (the shape of every route) for Eden. | `dashboard`, `website` (type only) |
| `@repo/db`                 | Every `pgTable` in the repo, the migrations, and the connection. `DATABASE_URL` picks PGlite or Postgres; `migrate` is a script, never boot. | `api`, `auth`, `jobs`              |
| `@repo/auth`               | The Better Auth instance, `isStaff(session)`, and the CLI that generates the auth tables into `@repo/db`. | `api`                              |
| `@repo/email`              | `sendEmail` over an in-memory or Resend provider, chosen by env, plus bounce-webhook signature verification. | `api`                              |
| `@repo/jobs`               | The transactional outbox: `enqueue`, the consumer, dead letters and replay, and cron schedules. | `api`                              |
| `@repo/observability`      | The pino `logger` and `reportError`.                                      | `api`, `jobs`                      |
| `@repo/errors`             | `DomainError` and the seven refusal kinds a status is derived from. Imports nothing. | `api`, `email`, `jobs`             |
| `@repo/ui`                 | shadcn components, the Tailwind v4 theme (`globals.css`), `cn()` helper, Storybook stories. | `dashboard`, `website`             |
| `@repo/typescript-config`  | Base `tsconfig` presets (`base`, `react-vite`, `nextjs`, `bun`).          | every package                      |
| `@repo/dashboard`          | Internal admin/app UI (Vite SPA).                                         | —                                  |
| `@repo/website`            | Public marketing site (Next.js).                                         | —                                  |

## How it works

Four mechanisms make the pieces fit together:

### 1. Bun workspaces link everything locally

`bun install` at the root reads the `workspaces` globs in the root `package.json` and symlinks each `@repo/*` package into `node_modules`. Because packages depend on each other with `workspace:*`, a change in one package is immediately visible to its consumers — **no rebuild or republish is needed**.

### 2. Eden Treaty gives end-to-end types (no codegen)

`services/api` exports its type from its api entry point, `src/entrypoints/api/app.ts`:

```ts
export type App = ReturnType<typeof buildApp>;
```

Each frontend imports **only that type** and wraps it with Eden:

```ts
// apps/dashboard/src/lib/api.ts
import { treaty } from "@elysiajs/eden";
import type { App } from "@repo/api";

export const api = treaty<App>(import.meta.env.VITE_API_URL ?? "http://localhost:3001");
```

Now `api.health.get()` is fully typed against the real route definition. Add, rename, or change a route in the API and the frontends get type errors immediately — the contract is the source code itself, so there is nothing to regenerate.

### 3. One Tailwind theme, shared by both apps

The design tokens and Tailwind entry point live once, in `packages/ui/src/styles/globals.css`. Each app imports it and tells Tailwind to also scan the shared package for class names:

```css
/* apps/dashboard/src/styles.css and apps/website/src/app/globals.css */
@import "@repo/ui/globals.css";
@source "../../../packages/ui/src"; /* so Tailwind sees classes used inside @repo/ui */
```

The dashboard compiles Tailwind with the `@tailwindcss/vite` plugin; the website uses `@tailwindcss/postcss`. Both produce identical styling because the theme is defined in a single place.

### shadcn component imports

Components inside `@repo/ui` import their own helpers by the **package name**, not a relative `@/` alias:

```ts
import { cn } from "@repo/ui/lib/utils";
```

This is what lets the same source file resolve correctly whether it's used from the dashboard, the website, or Storybook.

### 4. The backend has one home per kind of thing

`services/api/src` holds exactly three directories, and nothing else:

- **`entrypoints/`** is one directory per process. `api/` composes the Elysia app (`buildApp()` in `app.ts`) and listens (`main.ts`); `jobs/` merges every feature's outbox handlers and schedules and runs them. Each parses its own env at boot, so a missing value fails there rather than on the request that needed it.
- **`features/`** is the product, in the product's own words. A feature is a flat directory of up to six named files, `routes.ts`, `model.ts`, `service.ts`, `repository.ts`, `emails.ts` and `jobs.ts`, each created only when the feature has that kind of thing. Dependencies run one way: `routes -> service -> repository -> @repo/db`.
- **`plugins/`** is what runs around a request: the request id, request logging, error reporting and mapping, the rate limit, the staff guard. One Elysia instance per file.

Anything with an outside is a `@repo/*` package under `packages/` instead: a store, a vendor, a runtime, a process facility. There is no `shared/`.

`bun run check` runs Biome and then `services/api/scripts/check-imports.ts`, which fails on an import that crosses any of those lines. The full set of rules, one row per kind of thing, is in [`services/api/AGENTS.md`](services/api/AGENTS.md).

The example domain is a **feedback inbox**. The public posts feedback; staff read it and reply. The acknowledgement and the reply both go out through the outbox in `@repo/jobs`. The service enqueues each one in the transaction that writes the row, so a submission that is stored is a mail that will be sent. A daily schedule emails staff a digest of submissions unanswered for 48 hours, and the provider's bounce webhook marks an address undeliverable so nobody replies to it again. Delete `features/feedback/`, `features/replies/`, `features/email-bounces/` and their tables when you start your own product. `features/health/` and `features/auth/` are the two worth keeping.

## Prerequisites

- **Bun** ≥ 1.4 ([install](https://bun.sh/docs/installation))
- **Node** ≥ 20 (Next.js/tooling expect a Node runtime to be present)
- **Postgres** is optional. `DATABASE_URL` defaults to [PGlite](https://pglite.dev), an embedded Postgres that runs inside the Bun process and keeps its data in a directory. Tests always use PGlite in memory. Point `DATABASE_URL` at `postgres://...` when you want a real server.

## Getting started

```bash
# 1. Install all workspace dependencies (from the repo root)
bun install

# 2. Check that the repo is green (needs no env of its own)
bun run typecheck && bun run check && bun run test

# 3. Create env files from the examples
cp services/api/.env.example      services/api/.env
cp packages/db/.env.example       packages/db/.env
cp packages/jobs/.env.example     packages/jobs/.env
cp apps/dashboard/.env.example    apps/dashboard/.env
cp apps/website/.env.example      apps/website/.env

# 4. Create the dev database (a `.data/` directory at the repo root)
bun run --filter @repo/db migrate

# 5. Start everything at once
bun run dev
```

Step 2 needs no `.env`. Each workspace with tests carries a committed `.env.test` holding fakes only, and a test run puts PGlite in memory behind the database. A fresh clone is green on all three before you configure anything.

### What the env files hold

Every value in `services/api/.env.example` is a working local default, so the copy in step 3 runs as-is:

| Variable | Default | Fetch a real one when |
| --- | --- | --- |
| `PORT`, `CORS_ORIGINS` | 3001, the two dev servers | you move a frontend off its default port |
| `DATABASE_URL` | `pglite://../../.data`, the repo-root dev database | you want a real Postgres server |
| `LOG_LEVEL` | `info` | never; `silent` is what test runs use |
| `EMAIL_PROVIDER` | `memory`, which keeps sent mail in the process | you want mail actually delivered: set `resend`, then `RESEND_API_KEY` (resend.com, API Keys) and `EMAIL_FROM` |
| `EMAIL_WEBHOOK_SECRET` | a local placeholder | you point the provider's bounce webhook at a deployed api: take the secret from its webhook settings |
| `BETTER_AUTH_SECRET` | a local dev string | you deploy anywhere shared: `openssl rand -base64 32`, and rotating it signs everyone out |
| `BETTER_AUTH_URL` | `http://localhost:3001` | the api answers on another origin |
| `STAFF_DIGEST_EMAIL` | `staff@example.com` | you want the unanswered-feedback digest to reach someone |

`packages/db/.env` and `packages/jobs/.env` exist only for the scripts those workspaces run against the database (`migrate`, `replay`); a PGlite path is relative to the workspace it is read from, and all three point at the same repo-root `.data/`. The two frontends hold one variable each, the api's base URL, and fall back to `http://localhost:3001` with no file at all.

Migrations never run at boot, so step 4 is what creates the tables. Re-run it after adding one.

`bun run dev` launches all workspaces in parallel:

| Service   | URL                     |
| --------- | ----------------------- |
| Website   | http://localhost:3000   |
| API       | http://localhost:3001   |
| API docs  | http://localhost:3001/docs |
| Dashboard | http://localhost:5173   |

Storybook is not part of `bun run dev` — start it on demand:

```bash
bun run --filter @repo/ui storybook   # http://localhost:6006
```

The jobs process is not part of `bun run dev` either. It is a second process over the same code, and no HTTP request needs it running. Start it when you want the acknowledgement mails and the daily digest to go out:

```bash
bun run --filter @repo/api jobs
```

To run a single workspace instead of everything, use `--filter`:

```bash
bun run --filter @repo/api dev
bun run --filter @repo/dashboard dev
```

## Developing

The golden rule: **changes to a package are picked up live by its consumers** because everything is symlinked source. What you need to have _running_ depends on which package you touch.

### Editing `@repo/ui` (shared components)

- Both the dashboard and website import from here, so a component change reflects in **both apps** on save (HMR).
- The fastest feedback loop is **Storybook** (`bun run --filter @repo/ui storybook`) — you can build and preview a component in isolation without running an app.
- New Tailwind classes are compiled by each app on the fly thanks to the `@source` directive; no extra step.
- **To run:** Storybook, and/or whichever app(s) you want to see the change in.
- **Add a shadcn component:**
  ```bash
  cd packages/ui
  bunx shadcn@latest add <component>   # e.g. dialog, dropdown-menu, badge
  ```
  It lands in `packages/ui/src/components/` and is instantly importable as `@repo/ui/components/<component>`.

### Editing `@repo/api` (backend)

- Read [`services/api/AGENTS.md`](services/api/AGENTS.md) before you add a file. It names the one legal home for each kind of thing: route, schema, rule, query, email, job, plugin, table, migration, test. `bun run check` enforces the import direction behind that table.
- The API type (`type App`) is what the frontends consume. Changing a route updates the types the frontends see **immediately** — expect red squiggles in `dashboard`/`website` if you break a contract they use.
- `bun run --filter @repo/api dev` runs Elysia with `--watch`, so the server restarts on save.
- **To run:** the API. Also run any frontend that calls it if you want to exercise the request path live, and the jobs process (`bun run --filter @repo/api jobs`) if you are working on an outbox handler or a schedule.
- Tests are `bun run --filter @repo/api test`. A route test drives the whole app in process through Eden Treaty, on PGlite in memory, and reads what happened through each package's `testing` subpath (`sentEmails()`, `pendingMessages()`, `reportedErrors()`). Nothing is mocked and no local service is needed.

### Editing the backend packages (`db`, `auth`, `email`, `jobs`, `observability`, `errors`)

- **Adding a table:** write it under `packages/db/src/schema/`, export it from `schema/index.ts`, then `bun run --filter @repo/db generate` to write the migration and `bun run --filter @repo/db migrate` to apply it to your dev database. Nothing migrates at boot.
- **Auth tables are generated:** `bun run --filter @repo/auth generate-schema` writes `packages/db/src/schema/auth.ts` through the Better Auth CLI. Never edit that file by hand.
- **A dead-lettered outbox message** is replayed by id: `bun run --filter @repo/jobs replay 42`.
- Each package picks its in-memory double from its own env at boot, so the import path under test is the production one. That is why a test reads results through `@repo/<pkg>/testing` instead of `mock.module`.

### Editing `apps/dashboard` (Vite SPA)

- **To run:** the dashboard (`bun run --filter @repo/dashboard dev`) plus the API if the page fetches data.
- Routes are **file-based**: add a file under `src/routes/` and the route tree (`src/routeTree.gen.ts`) regenerates automatically while the dev server runs. Outside of dev, regenerate manually with `bun run --filter @repo/dashboard generate-routes`.

### Editing `apps/website` (Next.js)

- **To run:** the website (`bun run --filter @repo/website dev`) plus the API for pages that fetch data (the home page fetches server-side in an RSC).
- `@repo/ui` is listed in `transpilePackages` in `next.config.ts`, which is what lets Next.js consume the package's TypeScript source directly.

### Editing `@repo/typescript-config`

- Changes to a preset affect **every package** that extends it. Re-run typechecks after changing a preset (`bun run typecheck`). Restart TS servers / dev servers to pick up compiler-option changes.

### Before you commit

Run the repo-wide gates from the root:

```bash
bun run typecheck    # per-package `tsc --noEmit`
bun run check        # Biome, then each workspace's own check (the api's import rules)
bun run test         # each workspace's `bun test --isolate`, on PGlite in memory
```

All three are also cheap to run per-package via `--filter` while iterating. A bare `bun test` at the root is unsupported: it reads the root `bunfig.toml` only, so it loads no preload and no `.env.test`, and the first test to touch the database fails on a missing `DATABASE_URL`.

## Command reference

All commands are run from the repo root unless noted.

| Command                                    | What it does                                                        |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `bun install`                              | Install deps and link all workspaces.                               |
| `bun run dev`                              | Run api + website + dashboard in parallel.                          |
| `bun run build`                            | Build every workspace for production.                               |
| `bun run typecheck`                        | Typecheck every workspace (`tsc --noEmit`).                         |
| `bun run test`                             | Run every workspace's tests (`bun test --isolate`). Needs no Postgres. |
| `bun run check`                            | Biome lint + format check across the repo.                          |
| `bun run check:fix`                        | Apply Biome's safe fixes and format.                                |
| `bun run format`                           | Format only.                                                        |
| `bun run --filter <pkg> <script>`          | Run a script in one workspace, e.g. `--filter @repo/api dev`.     |
| `bun run --filter @repo/ui storybook`    | Start Storybook on :6006.                                           |
| `cd packages/ui && bunx shadcn@latest add <c>` | Add a shadcn component to the shared UI kit.                    |
| `bun run --filter @repo/api jobs`          | Run the jobs process: outbox consumer + schedules.                  |
| `bun run --filter @repo/db generate`       | Write a migration for the current schema (drizzle-kit).             |
| `bun run --filter @repo/db migrate`        | Apply pending migrations to the database in that workspace's `.env`. |
| `bun run --filter @repo/auth generate-schema` | Regenerate `packages/db/src/schema/auth.ts` from Better Auth.     |
| `bun run --filter @repo/jobs replay <id>`  | Make one dead-lettered outbox message available again.              |

### Ports

| Port | Service                    |
| ---- | -------------------------- |
| 3000 | Website (Next.js)          |
| 3001 | API (Elysia) + `/docs`     |
| 5173 | Dashboard (Vite)           |
| 6006 | Storybook                  |
