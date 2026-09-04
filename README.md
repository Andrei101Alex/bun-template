# Acme

> ⚠️ **This is a template.** It's a starter monorepo — the npm scope is a generic `@repo/*` and the brand is a placeholder, **Acme**. See [**Using this template**](#using-this-template) to start a new project from it, then delete this note and that section once it's yours.

A TypeScript monorepo managed with [Bun workspaces](https://bun.sh/docs/install/workspaces). It contains two frontends, a backend service, and a shared UI kit — all wired together with end-to-end type safety.

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
| Lint / format | [Biome](https://biomejs.dev)                                          |

## Repository structure

```
my-app/
├── package.json              # workspace root: scripts + shared devDeps (biome, typescript)
├── biome.json                # single lint/format config for the whole repo
├── bunfig.toml               # bun install config (hoisted linker)
│
├── apps/
│   ├── dashboard/            # @repo/dashboard — Vite SPA (port 5173)
│   └── website/              # @repo/website  — Next.js site (port 3000)
│
├── services/
│   └── api/                  # @repo/api — Elysia backend (port 3001)
│
└── packages/
    ├── ui/                   # @repo/ui — shadcn components + Storybook (port 6006)
    └── typescript-config/    # @repo/typescript-config — shared tsconfig presets
```

Every internal package is namespaced under `@repo/*` and referenced via `workspace:*`, so imports always resolve to the local source — there is no publish/build step between packages.

### Packages at a glance

| Package                      | What it is                                                                 | Consumed by                        |
| ---------------------------- | ------------------------------------------------------------------------- | ---------------------------------- |
| `@repo/api`                | Elysia server. Exports `type App` (the shape of every route) for Eden.    | `dashboard`, `website` (type only) |
| `@repo/ui`                 | shadcn components, the Tailwind v4 theme (`globals.css`), `cn()` helper, Storybook stories. | `dashboard`, `website`             |
| `@repo/typescript-config`  | Base `tsconfig` presets (`base`, `react-vite`, `nextjs`, `bun`).          | every package                      |
| `@repo/dashboard`          | Internal admin/app UI (Vite SPA).                                         | —                                  |
| `@repo/website`            | Public marketing site (Next.js).                                         | —                                  |

## How it works

Three mechanisms make the pieces fit together:

### 1. Bun workspaces link everything locally

`bun install` at the root reads the `workspaces` globs in the root `package.json` and symlinks each `@repo/*` package into `node_modules`. Because packages depend on each other with `workspace:*`, a change in one package is immediately visible to its consumers — **no rebuild or republish is needed**.

### 2. Eden Treaty gives end-to-end types (no codegen)

`services/api` exports its type at the bottom of `src/index.ts`:

```ts
export type App = typeof app;
```

Each frontend imports **only that type** and wraps it with Eden:

```ts
// apps/dashboard/src/lib/api.ts
import { treaty } from "@elysiajs/eden";
import type { App } from "@repo/api";

export const api = treaty<App>(import.meta.env.VITE_API_URL ?? "http://localhost:3001");
```

Now `api.greeting({ name }).get()` is fully typed against the real route definition. Add, rename, or change a route in the API and the frontends get type errors immediately — the contract is the source code itself, so there is nothing to regenerate.

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

## Prerequisites

- **Bun** ≥ 1.4 ([install](https://bun.sh/docs/installation))
- **Node** ≥ 20 (Next.js/tooling expect a Node runtime to be present)

## Getting started

```bash
# 1. Install all workspace dependencies (from the repo root)
bun install

# 2. (optional) create env files from the examples
cp services/api/.env.example      services/api/.env
cp apps/dashboard/.env.example    apps/dashboard/.env
cp apps/website/.env.example      apps/website/.env

# 3. Start everything at once
bun run dev
```

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

- The API type (`type App`) is what the frontends consume. Changing a route updates the types the frontends see **immediately** — expect red squiggles in `dashboard`/`website` if you break a contract they use.
- `bun run --filter @repo/api dev` runs Elysia with `--watch`, so the server restarts on save.
- **To run:** the API. Also run any frontend that calls it if you want to exercise the request path live.

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
bun run check        # Biome lint + format check (use `check:fix` to auto-fix)
```

Both are also cheap to run per-package via `--filter` while iterating.

## Command reference

All commands are run from the repo root unless noted.

| Command                                    | What it does                                                        |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `bun install`                              | Install deps and link all workspaces.                               |
| `bun run dev`                              | Run api + website + dashboard in parallel.                          |
| `bun run build`                            | Build every workspace for production.                               |
| `bun run typecheck`                        | Typecheck every workspace (`tsc --noEmit`).                         |
| `bun run check`                            | Biome lint + format check across the repo.                          |
| `bun run check:fix`                        | Apply Biome's safe fixes and format.                                |
| `bun run format`                           | Format only.                                                        |
| `bun run --filter <pkg> <script>`          | Run a script in one workspace, e.g. `--filter @repo/api dev`.     |
| `bun run --filter @repo/ui storybook`    | Start Storybook on :6006.                                           |
| `cd packages/ui && bunx shadcn@latest add <c>` | Add a shadcn component to the shared UI kit.                    |

### Ports

| Port | Service                    |
| ---- | -------------------------- |
| 3000 | Website (Next.js)          |
| 3001 | API (Elysia) + `/docs`     |
| 5173 | Dashboard (Vite)           |
| 6006 | Storybook                  |
