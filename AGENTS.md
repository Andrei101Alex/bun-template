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

Three cross-cutting mechanisms are the things to understand before editing:

### Eden Treaty is the API contract (no codegen)
`services/api/src/index.ts` ends with `export type App = typeof app`. Frontends import **only that type** and wrap it with `treaty<App>(url)` (see `apps/*/src/**/lib/api.ts`). Route calls like `api.greeting({ name }).get()` are typed directly against the Elysia route definitions. Changing/renaming/removing a route surfaces as type errors in the frontends immediately — the contract is the source, so there is nothing to regenerate. Base URLs come from `VITE_API_URL` / `NEXT_PUBLIC_API_URL`.

### Tailwind theme lives once in `@repo/ui`
The Tailwind v4 entry point and all design tokens are in `packages/ui/src/styles/globals.css`. Each app re-imports it and adds `@source "../../../packages/ui/src"` (path differs per app depth) so Tailwind scans the shared package for class names. Dashboard compiles via `@tailwindcss/vite`; website via `@tailwindcss/postcss`. **Do not** define a second theme or a `tailwind.config` in the apps.

### shadcn components use package-name imports
Components in `packages/ui` import helpers by package name — `import { cn } from "@repo/ui/lib/utils"` — **not** a relative `@/` alias. This is what lets the same source resolve from any consumer (both apps + Storybook). Keep this convention when adding components. Add components with `cd packages/ui && bunx shadcn@latest add <component>`; they become importable as `@repo/ui/components/<component>`.

## Conventions & gotchas

- **Typecheck is per-package, not `tsc -b`.** Each package has its own `tsconfig.json` extending a `@repo/typescript-config` preset; there is no composite solution. App/library presets set `declaration: false` on purpose (packages ship source, not `.d.ts`) — re-enabling it resurfaces TS2742/TS4023 portability errors.
- **Dashboard routes are file-based.** Adding a file under `apps/dashboard/src/routes/` regenerates `src/routeTree.gen.ts` automatically while `dev` runs; outside dev, run `bun run --filter @repo/dashboard generate-routes`. `routeTree.gen.ts` is generated (gitignored) — don't hand-edit it.
- **Next.js consumes UI source directly** via `transpilePackages: ["@repo/ui"]` in `apps/website/next.config.ts`. New workspace deps that ship TS source must be added there too.
- **Biome** is the only lint/format tool, configured once at the root `biome.json` (Tailwind at-rules are enabled via the CSS parser option). No ESLint/Prettier.
