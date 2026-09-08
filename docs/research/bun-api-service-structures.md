# How Bun and Elysia API services are structured in practice

Research for issue #17 (wayfinder map #3), surveying real Elysia/Hono repositories to check this
template's `features/<name>/{routes,handlers,repository}.ts` shape against what production and
well-starred services actually do.

## Short answer

Across eight Elysia repositories and three Hono repositories inspected directly (trees pulled via
`gh api .../git/trees`), no single layout dominates, but the same two or three shapes keep
recurring and none of them is the .NET-style domain/application/infrastructure split by default.
The most common shape, seen in four repositories
([techfusionid/elysia-production-template](https://github.com/techfusionid/elysia-production-template),
[taotao7/FrameBaker](https://github.com/taotao7/FrameBaker),
[syhner/elysia-kickstart](https://github.com/syhner/elysia-kickstart),
[jellydn/elysia-demo-app](https://github.com/jellydn/elysia-demo-app)), is a feature/module
directory (`modules/<name>/`, `api/<name>.ts`, `routes/<name>/`) that colocates the route and its
logic in one file, splitting out a `service.ts` only once a module earns it - the same "skip a
file rather than fake it" instinct this repo's `AGENTS.md` already states explicitly. A second
recurring shape, seen only on the Hono side here
([Joker666/hono-starter](https://github.com/Joker666/hono-starter),
[OultimoCoder/cloudflare-planetscale-hono-boilerplate](https://github.com/OultimoCoder/cloudflare-planetscale-hono-boilerplate)),
is a controller/service/model/route split with one file per concern per feature - closer to what
Elysia's own best-practice page recommends in vocabulary, but adopted here by Hono projects rather
than Elysia ones. A third, rarer shape is full clean-architecture/DDD layering
(domain/usecase/infrastructure/presentation, repository interfaces, a DI container) - one Hono
example found in this pass ([dyaksa/hono-clean-architecture](https://github.com/dyaksa/hono-clean-architecture)),
adding to the two Elysia clean-architecture templates the earlier research already catalogued.
The remaining repositories were either too thin to generalize from (a single health route, a
three-function API with no DB) or monorepos where the HTTP service itself is a thin shell and the
real structure lives one level up in `packages/`, which is itself a recurring shape worth naming.
Neither Elysia's own scaffolding tools (`elysiajs/elf`, `kravetsone/create-elysiajs`) nor Bun's own
`bun create`/`bun init` templates impose any business-logic layering at all - they scaffold
integrations (auth, Redis, S3, Drizzle/Prisma) as flat files and leave feature organization
entirely to the developer, which lines up with Elysia's maintainer closing a NestJS-style
architecture request as "not planned" and pointing back at the same best-practice page.

## Repositories inspected

| Repo | Stars | Kind | Src shape |
| --- | --- | --- | --- |
| [techfusionid/elysia-production-template](https://github.com/techfusionid/elysia-production-template) | 32 | Elysia template, explicitly "production-ready" | `src/modules/<name>/index.ts` (+`service.ts`, `schemas.ts` once needed), `src/common/{config,db,logger,middleware}` |
| [taotao7/FrameBaker](https://github.com/taotao7/FrameBaker) | 152 | Elysia + React monorepo (turborepo), real product | `apps/server/src/api/<resource>.ts` one file per resource; `apps/server/src/jobs/` for background work; `packages/shared`, `packages/database` |
| [syhner/elysia-kickstart](https://github.com/syhner/elysia-kickstart) | 139 | Elysia + HTMX boilerplate | `src/app/api/<feature>/index.ts`, `src/db/schemas/*.ts` separate from routes, `src/util/elysia.ts` |
| [jellydn/elysia-demo-app](https://github.com/jellydn/elysia-demo-app) | 112 | "Real-world example", Bun+Docker+Fly.io | `server/routes/health/index.ts` only - one route, too thin to generalize |
| [rayriffy/rayriffy-h](https://github.com/rayriffy/rayriffy-h) | 127 | Self-hosted manga reader, real production traffic | Turborepo: `adapter/<source>`, `packages/{commons,database,execute}`, `server/src/{index,image,bytebin}.ts` - server itself is a thin shell |
| [rayriffy/thai-lotto-api](https://github.com/rayriffy/thai-lotto-api) | 106 | Real production API (Thai lottery results) | Flat: `src/functions/{getList,getLotto}.ts`, `src/index.ts`, `src/models.ts` - no DB, too small to show a layering choice |
| [saasyland/saasyland.com](https://github.com/saasyland/saasyland.com) | 436 | Advertises itself as an Elysia-based SaaS starter | Tree is pure Next.js App Router + Prisma + server actions (`src/actions/*.ts`) - **no Elysia code is actually present in the tree**; the README's Elysia claim does not match what's checked in |
| [elysiajs/elf](https://github.com/elysiajs/elf) | - | Official Elysia scaffolding CLI | Generates plugin snippets (`add/{cors,jwt,static,...}`) and per-integration auth templates (`generate/auth/{drizzle,prisma}`) - scaffolds integrations, not a business-layer convention |
| [kravetsone/create-elysiajs](https://github.com/kravetsone/create-elysiajs) | 161 | Community Elysia scaffolding CLI | Generated app gets flat `services/{auth,jobify,locks,posthog,redis,s3}.ts` - one file per third-party integration, again no feature/domain convention |
| [dyaksa/hono-clean-architecture](https://github.com/dyaksa/hono-clean-architecture) | 39 | Hono clean-architecture template | `src/domain/{entities,repositories}` (repo interfaces), `src/infrastructure/{db/repositories,http}`, `src/presentation/{controller,routes,middleware}`, `src/usecase/*.ts`, `src/container.ts` (DI wiring) |
| [Joker666/hono-starter](https://github.com/Joker666/hono-starter) | 190 | Hono production starter (Node, Drizzle, MySQL) | `src/{controllers,services,routes,models,tables,config,middlewares,factories}` - controller/service/model/route split, DB schema (`tables/`) kept separate from domain `models/` |
| [OultimoCoder/cloudflare-planetscale-hono-boilerplate](https://github.com/OultimoCoder/cloudflare-planetscale-hono-boilerplate) | 238 | Hono on Cloudflare Workers, production-oriented | `src/{controllers,services,models,routes,middlewares,factories}` plus `src/durable-objects/rate-limiter.do.ts` (rate limiting as a Workers Durable Object); `tests/integration/` mirrors `src/controllers/` exactly |

## Where business logic lands

Business logic placement splits along the same lines as the overall shape:

- **Colocated in the module file, or a sibling `service.ts`.** techfusionid keeps `posts/service.ts` next to `posts/index.ts` (the route) once the module has enough logic to warrant it, but `health/index.ts` and `auth/index.ts` stay route-only - the same "skip a file rather than fake it" pattern this repo's `AGENTS.md` codifies. FrameBaker goes further and never splits at all: `apps/server/src/api/projects.ts` is route registration and logic in one file for every resource.
- **A dedicated `services/` directory, one file per feature, separate from `controllers/`.** Both Hono repos in this pattern ([Joker666/hono-starter](https://github.com/Joker666/hono-starter), [OultimoCoder/cloudflare-planetscale-hono-boilerplate](https://github.com/OultimoCoder/cloudflare-planetscale-hono-boilerplate)) put logic in `src/services/<name>.service.ts`, called from `src/controllers/<name>.controller.ts`. This is architecturally the closest match to this repo's `handlers.ts`, except neither repo has a distinct repository layer beneath the service - the service talks to the ORM directly.
- **A `usecase/` layer, one function per operation, sitting between `presentation/controller` and `infrastructure`.** Only in the one full clean-architecture repo, [dyaksa/hono-clean-architecture](https://github.com/dyaksa/hono-clean-architecture) - matches the earlier .NET-mapping research's finding that this layer is what collapses into `handlers.ts` once there's no DI container forcing a seam.

## Where the DB schema and queries live

| Repo | Schema location | Query location |
| --- | --- | --- |
| techfusionid | `src/common/db/schema/*.ts` (Drizzle) | Inline in `src/modules/<name>/service.ts` - no repository file |
| FrameBaker | `apps/server/src/db.ts` (single file) | Inline in each `src/api/<resource>.ts` |
| elysia-kickstart | `src/db/schemas/{auth,todo}.ts` | Inline in `src/app/api/<feature>/index.ts` and `src/lib/db.ts` |
| dyaksa/hono-clean-architecture | `src/infrastructure/db/schema/*.ts` | `src/infrastructure/db/repositories/*.repository.ts`, behind a `src/domain/repositories/*.repository.ts` interface |
| Joker666/hono-starter | `src/tables/*.table.ts` (kept apart from `src/models/*.model.ts`, which are domain shapes) | Inline in `src/services/*.service.ts` |
| OultimoCoder/cloudflare-planetscale-hono-boilerplate | `src/models/*.model.ts` (also doubles as ORM model) | Inline in `src/services/*.service.ts` |

None of the Hono or Elysia repos here separate "queries" into their own file the way this
template's `repository.ts` does; where a query layer exists at all (dyaksa only), it's behind an
interface for DI purposes, not for the "what touches this table is one place" reason this repo's
`AGENTS.md` gives for skipping interfaces.

## Cross-cutting code and second processes

- **Config/env/logging/middleware** consistently gets its own top-level bucket regardless of shape:
  `src/common/{config,logger,middleware}` in techfusionid, `src/{config,middlewares}` in both Hono
  controller/service repos, and generated as flat `services/{redis,posthog,...}.ts` files by
  [kravetsone/create-elysiajs](https://github.com/kravetsone/create-elysiajs)'s scaffold.
- **Rate limiting as platform infrastructure, not application code.** OultimoCoder implements it as
  a Cloudflare Workers Durable Object (`src/durable-objects/rate-limiter.do.ts`) rather than
  in-process middleware, because Workers has no long-lived process to hold counters in memory -
  worth noting as a platform-forced placement decision, not a stylistic one.
  [rayriffy/elysia-rate-limit](https://github.com/rayriffy/elysia-rate-limit) (239 stars, the
  most-starred Elysia rate-limit plugin) is the in-process alternative when a long-running server
  is available.
- **Second processes (jobs/workers).** Only one repo here shows this clearly: FrameBaker runs
  background work in-process via `apps/server/src/jobs/{run,extract,generateApi,imageLayers,matting}.ts`
  plus a `queue.ts`, not as a separate deployable - a job runner colocated with the HTTP server.
  Joker666/hono-starter's own description advertises BullMQ, but no queue/worker file is visible
  in its tree; this is flagged as an evidence gap rather than a confirmed shape; it's possible the
  integration lives inside a service file not distinguishable from the tree listing alone. No
  repository in this survey runs a genuinely separate worker process or cron deployable - every
  example that does background work at all does it inside the same server.

## Test layout

Only two of the eight Elysia-ecosystem repos and one Hono repo had a test suite substantial enough
to say anything about layout:

- **techfusionid/elysia-production-template**: flat `tests/<module>.test.ts`, one file per module,
  matching module names (`auth.test.ts`, `posts.test.ts`, `health.test.ts`).
- **jellydn/elysia-demo-app**: colocated, `server/index.test.ts` next to `server/index.ts`.
- **OultimoCoder/cloudflare-planetscale-hono-boilerplate**: `tests/integration/` mirrors
  `src/controllers/` exactly, including the `oauth/` subfolder per provider, plus separate
  `tests/fixtures/` and `tests/mocks/` directories. This is the most structured test layout found
  in this pass and the only one that mirrors source depth rather than staying flat.

FrameBaker's `tests/` directory sits at the monorepo root and is organized by behavior
(`animation-editing.test.ts`, `character-binding.test.ts`) rather than mirroring `apps/server/src`,
because it's testing shared logic (`packages/shared`) more than the server's routes.

## Regret and pushback recorded in issues

- [elysiajs/elysia#595](https://github.com/elysiajs/elysia/issues/595), "Revolutionizing ElysiaJS:
  Proposing a Scalability Boost by Emulating Spring Boot or NestJS Structure," asked for
  modules/DTOs/controllers/services/DI baked into the framework. Elysia's creator (SaltyAom) closed
  it as "not planned," writing "Elysia is design to be non-agnostic design that you can use any
  design you want yourself" and pointing back at the
  [best-practice page](https://elysiajs.com/essential/best-practice) rather than adding structure.
  A commenter (nxy7) coming from NestJS agreed the ideas were appealing but noted Elysia's TS-magic
  constraints make DI awkward, and asked instead for an official example app with
  logging/authentication - i.e. a worked example, not a framework feature.
- This complements the earlier-found [honojs/hono#4121](https://github.com/honojs/hono/issues/4121)
  (a maintainer thread reporting the same regret over DDD-style layering on Hono) - both framework
  authors land in the same place: no imposed layering, defer to a documented convention instead.
- No restructure/refactor-architecture issues or changelog entries were found in any of the eleven
  repos surveyed here (searched via `gh api search/issues` on each org/repo for "restructure",
  "refactor architecture", "folder structure"); most of these repos are small enough, or new
  enough, that a structural regret would show up as a rewrite rather than a discussion.

## The recurring shapes, with counts

Across the 8 Elysia-ecosystem repos plus 3 Hono repos inspected in this pass (11 total, plus the 2
Elysia clean-architecture templates and the Hono issue already catalogued by the earlier
.NET-mapping research):

1. **Feature/module-per-domain, route and logic colocated in one file or folder, splitting a
   `service.ts` only once a module needs it** - 4 repos (techfusionid, FrameBaker, elysia-kickstart,
   jellydn, the last two too thin to be sure they'd hold the pattern at scale). This is the shape
   closest to this template's own `features/<name>/` convention, though none of these four also
   split out a `repository.ts` - queries stay inline in the route/service file in all four.
2. **Controller/service/model/route, one file per concern per feature, DB schema kept in a
   sibling `tables/`or `models/` file rather than a `repository.ts`** - 2 repos, both Hono
   (Joker666/hono-starter, OultimoCoder/cloudflare-planetscale-hono-boilerplate). This is the
   vocabulary Elysia's own best-practice page recommends, but every example actually using it that
   was found in this pass is a Hono project, not an Elysia one.
3. **Full clean-architecture/DDD layering** (domain/usecase/infrastructure/presentation, repository
   interfaces, DI container) - 1 repo here (dyaksa/hono-clean-architecture), plus the 2 Elysia
   templates the earlier research already found (aymaneallaoui/clean-architecture-elysia,
   lukas-andre/bun-elysia-clean-architecture-example) = 3 total across both surveys. Consistently
   the rarest shape, and the one both framework maintainers have pushed back on in their own issue
   trackers.
4. **Monorepo where the HTTP service is a thin shell and the real structure is one level up, in
   `packages/`** - 2 repos (rayriffy/rayriffy-h, FrameBaker again, which straddles this and shape 1).
   Notable because it's structurally close to this template's own `apps/` + `packages/` split,
   just applied to a single backend service's internals rather than a full-stack monorepo.
5. **Too flat or too small to say anything** - thai-lotto-api (3 files, no DB) and saasyland.com
   (claims Elysia in its README and description but the checked-in tree is pure Next.js with no
   Elysia code at all - flagged as a mismatched example rather than a data point).

## Open questions

- Whether Joker666/hono-starter's advertised BullMQ integration lives in a file this tree listing
  didn't distinguish (e.g. inside a `.service.ts`) or was removed after the description was
  written - the repo's tree shows no `queue`/`worker`/`bullmq` file by name.
- Whether any Elysia repository at a materially larger scale than the ones found here (all under
  500 stars) exists publicly; the framework is young enough (created 2022) that "well-starred
  production service with years of structural history" mostly doesn't exist yet - every repo
  surveyed is a starter/template or a small real product, not a large team's long-lived service.
  This limits how much "recurring shape" evidence can be trusted as a converged industry norm
  versus a snapshot of what's popular right now.
- No second-process (dedicated worker/cron deployable, as opposed to in-process job running) was
  found in any repo surveyed. Whether that's because Elysia/Hono services at this scale simply
  don't need one yet, or because it's handled by an entirely separate, unrelated repository not
  discoverable from the API service's own tree, is unresolved by this pass.
