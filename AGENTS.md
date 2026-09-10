# Repository guidance

## Commands

Run from the repo root unless noted. This is a **Bun workspaces** monorepo — always `bun install` at the root, never inside a package.

| Command | Purpose |
| --- | --- |
| `bun install` | Install deps and symlink all `@repo/*` workspaces. |
| `bun run dev` | Run api + website + dashboard in parallel. |
| `bun run build` | Build every workspace. |
| `bun run typecheck` | Per-package `tsc --noEmit` across all workspaces. |
| `bun run test` | Runs each workspace's own `test` (`bun test --isolate`). PGlite in memory backs the database, so a test run needs no Postgres. |
| `bun run check` / `check:fix` | Biome lint + format check / auto-fix. `check` then runs each workspace's own `check` (the api's import rules). |
| `bun run --filter @repo/<pkg> <script>` | Run one workspace's script (e.g. `--filter @repo/api dev`). |
| `bun run --filter @repo/ui storybook` | Storybook on :6006 (not part of `bun run dev`). |

Ports: website `3000`, api `3001` (+ `/docs`), dashboard `5173`, storybook `6006`.

Before committing, run `bun run typecheck`, `bun run check` and `bun run test`.

## Architecture

Two frontends (`apps/dashboard` Vite SPA, `apps/website` Next.js) and one backend (`services/api` Elysia) share a UI kit (`packages/ui`) and tsconfig presets (`packages/typescript-config`). All internal packages are `@repo/*`, depended on via `workspace:*`, so **imports resolve to local source with no build/publish step between packages** — a change in one package is live for its consumers.

Four cross-cutting mechanisms are the things to understand before editing:

### Eden Treaty is the API contract (no codegen)
`services/api/src/entrypoints/api/app.ts` exports `buildApp()` and `export type App = ReturnType<typeof buildApp>`. Frontends import **only that type** and wrap it with `treaty<App>(url)` (see `apps/*/src/**/lib/api.ts`). Route calls like `api.health.get()` are typed directly against the Elysia route definitions. Changing/renaming/removing a route surfaces as type errors in the frontends immediately — the contract is the source, so there is nothing to regenerate. Base URLs come from `VITE_API_URL` / `NEXT_PUBLIC_API_URL`.

### Tailwind theme lives once in `@repo/ui`
The Tailwind v4 entry point and all design tokens are in `packages/ui/src/styles/globals.css`. Each app re-imports it and adds `@source "../../../packages/ui/src"` (path differs per app depth) so Tailwind scans the shared package for class names. Dashboard compiles via `@tailwindcss/vite`; website via `@tailwindcss/postcss`. **Do not** define a second theme or a `tailwind.config` in the apps.

### shadcn components use package-name imports
Components in `packages/ui` import helpers by package name — `import { cn } from "@repo/ui/lib/utils"` — **not** a relative `@/` alias. This is what lets the same source resolve from any consumer (both apps + Storybook). Keep this convention when adding components. Add components with `cd packages/ui && bunx shadcn@latest add <component>`; they become importable as `@repo/ui/components/<component>`.

### Backend code has one legal home per kind of thing

`services/api/src` holds exactly three directories: `entrypoints/` (one per process), `features/` (the product), `plugins/` (what runs around a request). Infrastructure with an outside is a `@repo/*` package under `packages/`; there is no `shared/`. A feature is a flat directory of up to six named files (`routes.ts`, `model.ts`, `service.ts`, `repository.ts`, `emails.ts`, `jobs.ts`), created only as it needs them. Dependencies run one way: `routes -> service -> repository -> @repo/db`. `bun run check` fails on an import that breaks this.

Before creating, moving or renaming a file under `services/api/` or in `packages/{db,auth,email,jobs,observability,errors}`, read `services/api/AGENTS.md`: it names the one legal home for every kind of thing.

## Conventions & gotchas

- **Typecheck is per-package, not `tsc -b`.** Each package has its own `tsconfig.json` extending a `@repo/typescript-config` preset; there is no composite solution. App/library presets set `declaration: false` on purpose (packages ship source, not `.d.ts`) — re-enabling it resurfaces TS2742/TS4023 portability errors.
- **Dashboard routes are file-based.** Adding a file under `apps/dashboard/src/routes/` regenerates `src/routeTree.gen.ts` automatically while `dev` runs; outside dev, run `bun run --filter @repo/dashboard generate-routes`. `routeTree.gen.ts` is generated (gitignored) — don't hand-edit it.
- **Next.js consumes UI source directly** via `transpilePackages: ["@repo/ui"]` in `apps/website/next.config.ts`. New workspace deps that ship TS source must be added there too.
- **A bare root `bun test` is unsupported.** It reads the root `bunfig.toml` only, so it loads no preload and no `.env.test`. The first test to touch the database then fails on a missing `DATABASE_URL`. Run `bun run test`, or `bun run --filter @repo/api test` for one workspace.
- **Biome** is the only lint/format tool, configured once at the root `biome.json` (Tailwind at-rules are enabled via the CSS parser option). No ESLint/Prettier.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, driven through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, each label named after its role (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
