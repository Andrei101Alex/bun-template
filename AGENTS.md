# Repository guidance

## Commands

Run from the repo root unless noted. This is a **Bun workspaces** monorepo — always `bun install` at the root, never inside a package.

| Command | Purpose |
| --- | --- |
| `bun install` | Install deps and symlink all `@repo/*` workspaces. |
| `bun run dev` | Run api + website + dashboard in parallel. |
| `bun run build` | Build every workspace. |
| `bun run typecheck` | Per-package `tsc --noEmit` across all workspaces. |
| `bun run check` / `check:fix` | Biome lint + format check / auto-fix. |
| `bun run --filter @repo/<pkg> <script>` | Run one workspace's script (e.g. `--filter @repo/api dev`). |
| `bun run --filter @repo/ui storybook` | Storybook on :6006 (not part of `bun run dev`). |

Ports: website `3000`, api `3001` (+ `/docs`), dashboard `5173`, storybook `6006`.

There is **no test suite** yet — no test runner is configured.

Before committing, run `bun run typecheck` and `bun run check`.

## Architecture

Two frontends (`apps/dashboard` Vite SPA, `apps/website` Next.js) and one backend (`services/api` Elysia) share a UI kit (`packages/ui`) and tsconfig presets (`packages/typescript-config`). All internal packages are `@repo/*`, depended on via `workspace:*`, so **imports resolve to local source with no build/publish step between packages** — a change in one package is live for its consumers.

Four cross-cutting mechanisms are the things to understand before editing:

### Eden Treaty is the API contract (no codegen)
`services/api/src/index.ts` ends with `export type App = typeof app`. Frontends import **only that type** and wrap it with `treaty<App>(url)` (see `apps/*/src/**/lib/api.ts`). Route calls like `api.greeting({ name }).get()` are typed directly against the Elysia route definitions. Changing/renaming/removing a route surfaces as type errors in the frontends immediately — the contract is the source, so there is nothing to regenerate. Base URLs come from `VITE_API_URL` / `NEXT_PUBLIC_API_URL`.

### Tailwind theme lives once in `@repo/ui`
The Tailwind v4 entry point and all design tokens are in `packages/ui/src/styles/globals.css`. Each app re-imports it and adds `@source "../../../packages/ui/src"` (path differs per app depth) so Tailwind scans the shared package for class names. Dashboard compiles via `@tailwindcss/vite`; website via `@tailwindcss/postcss`. **Do not** define a second theme or a `tailwind.config` in the apps.

### shadcn components use package-name imports
Components in `packages/ui` import helpers by package name — `import { cn } from "@repo/ui/lib/utils"` — **not** a relative `@/` alias. This is what lets the same source resolve from any consumer (both apps + Storybook). Keep this convention when adding components. Add components with `cd packages/ui && bunx shadcn@latest add <component>`; they become importable as `@repo/ui/components/<component>`.

### API code is feature-first, layered inside each feature
`services/api/src` has exactly two top-level directories. `shared/` is infrastructure only (config, errors, HTTP plumbing, and a database client when one arrives); `features/<name>/` is everything else. `index.ts` is wiring: middleware, then one `.use` per feature. Nothing else belongs in it, and nothing new belongs at `src/` level.

A feature holds up to three files, always these names:

| File | Owns | Never contains |
| --- | --- | --- |
| `routes.ts` | The Elysia plugin, `t.Object` schemas, auth guards, response shaping. One to five lines per handler: destructure, call a handler function, return. | SQL, business rules, third-party calls |
| `handlers.ts` | The business logic, one exported function per operation, named as the product names it (`uploadDocument`, `reviewClaim`). Takes plain values, returns plain values. | `Request`, `Headers`, `set`, status codes, any `elysia` import |
| `repository.ts` | Every query touching the feature's tables. Returns domain shapes, not rows or query builders. | Business rules, authorisation |

Dependencies run one way: `routes → handlers → repository → db`. A feature may import another feature's `handlers.ts`, never its repository or its routes. `import ... from "elysia"` inside `handlers.ts` means the layering broke.

Skip a file rather than fake it. `features/health` is routes-only because it has no rules; a read-through route with no logic may call its repository directly, and gains a `handlers.ts` the moment a rule or a second caller appears. When one file grows too long it becomes a directory of the same name (`handlers/` with a file per operation plus an `index.ts`); the three names never change.

**No repository interfaces.** Export plain functions that import the shared client directly. One implementation means the seam is hypothetical, and the indirection buys nothing — the repository earns its place by making "what touches this table" a one-directory answer. Inject only what a test cannot run: an LLM, a payment provider, an email sender. Your own repositories and your own database get imported.

**Failures.** `handlers.ts` throws a `DomainError` from `shared/errors.ts` and says nothing about status codes; `shared/http.ts` maps code to status once, which is what keeps route bodies short. When the frontend has to branch and render something specific (a quota refusal carrying the limit), return a discriminated union from the handler instead and let the route map it, so Eden Treaty carries the refusal into the client's types.

Read `features/greeting/` for the full pattern.

## Conventions & gotchas

- **Typecheck is per-package, not `tsc -b`.** Each package has its own `tsconfig.json` extending a `@repo/typescript-config` preset; there is no composite solution. App/library presets set `declaration: false` on purpose (packages ship source, not `.d.ts`) — re-enabling it resurfaces TS2742/TS4023 portability errors.
- **Dashboard routes are file-based.** Adding a file under `apps/dashboard/src/routes/` regenerates `src/routeTree.gen.ts` automatically while `dev` runs; outside dev, run `bun run --filter @repo/dashboard generate-routes`. `routeTree.gen.ts` is generated (gitignored) — don't hand-edit it.
- **Next.js consumes UI source directly** via `transpilePackages: ["@repo/ui"]` in `apps/website/next.config.ts`. New workspace deps that ship TS source must be added there too.
- **Biome** is the only lint/format tool, configured once at the root `biome.json` (Tailwind at-rules are enabled via the CSS parser option). No ESLint/Prettier.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, driven through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, each label named after its role (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
