# services/api

Rules for `services/api/src/**` and the backend packages `@repo/{db,auth,email,jobs,observability,errors}`. Look a kind of thing up in the placement table before creating, moving or renaming a file.

## Shape

`src` holds exactly three directories: `entrypoints/` are processes, `features/` is the product, `plugins/` is what runs around a request. A store, a vendor, a runtime or a process facility has an outside, so it is a `@repo/*` package under `packages/`. Everything else belongs to one feature and is reached through its `service.ts`. There is no `shared/`.

```
services/api/
  AGENTS.md  CLAUDE.md -> AGENTS.md
  scripts/check-imports.ts
  src/
    entrypoints/
      api/   main.ts  app.ts  env.ts
      jobs/  main.ts  env.ts
    features/
      health/    routes.ts
      feedback/  routes.ts  model.ts  service.ts  repository.ts  emails.ts  jobs.ts
    plugins/
      error-mapping.ts  request-id.ts  staff-guard.ts
packages/
  db/  auth/  email/  jobs/  observability/  errors/
```

Built today: the api entry point, `features/health/`, `plugins/error-mapping.ts`, `@repo/errors`. The rest of this file is the rule those pieces arrive under.

## Placement table

One row per kind of thing, naming its one legal home. A feature creates a file only when it has that kind of thing: skip a file rather than fake it.

| Kind | Home | Filename | Note |
| --- | --- | --- | --- |
| Route | `src/features/{feature}/` | `routes.ts` | Elysia plugin, guards, response shaping, declared refusal statuses. One to five lines per handler: destructure, call one service operation, return. |
| Schema, exported type, message kind | `src/features/{feature}/` | `model.ts` | `t.Object` schemas, `defineMessage(...)` per outbox kind the feature enqueues. Imports nothing else of the feature. |
| Rule and orchestration | `src/features/{feature}/` | `service.ts` | One exported function per operation, named as the product names it. Rules inline beside the orchestration. The only feature file that sends email or enqueues. |
| Query | `src/features/{feature}/` | `repository.ts` | Every query on the feature's tables. Imports `db` and tables from `@repo/db`. No interface. |
| Email content | `src/features/{feature}/` | `emails.ts` | Pure. Builds an `EmailMessage`; imports only that type from `@repo/email`. |
| Outbox handler, schedule | `src/features/{feature}/` | `jobs.ts` | Exports `handlers` and `schedules`, either omitted when absent. Thin like a route: one service call each. |
| Routes-only feature | `src/features/{feature}/` | `routes.ts` alone | `health/`, `auth/`. Gains a `service.ts` the moment a rule or a second caller appears. |
| Elysia hook, guard, derived value | `src/plugins/` | `{name}.ts` | One Elysia instance per file; the filename is the plugin `name`. A new hook is a new file. |
| HTTP entry point | `src/entrypoints/api/` | `main.ts`, `app.ts`, `env.ts` | `app.ts` exports `buildApp()` and `App`; `main.ts` parses env and listens; `cors` and `swagger` inline in `app.ts`. |
| Jobs entry point | `src/entrypoints/jobs/` | `main.ts`, `env.ts` | Merges every feature `jobs.ts` into `startOutboxConsumer(handlers)` and `startSchedules(schedules)`. |
| Second HTTP mount | `src/entrypoints/{mount}/` | as `api/` | Shares `features/` and `plugins/`. |
| Env schema, per process | `src/entrypoints/{mount}/` | `env.ts` | TypeBox `Type.Object` + `Value.Parse`. Holds only what the process reads; imports each package's env so boot fails early. |
| Env schema, per package | `packages/{pkg}/src/` | `env.ts` | Same shape; the package parses its own env. |
| Table | `packages/db/src/schema/` | `{name}.ts` | Every `pgTable`, auth and outbox tables included. Aggregated in `schema/index.ts`. |
| Migration | `packages/db/drizzle/` | drizzle-kit output | `drizzle.config.ts` at `packages/db/`. Run by script, never at boot. |
| Store, vendor, runtime, process facility | `packages/{db,auth,email,jobs,observability,errors}/` | `src/index.ts`, `src/testing.ts` | `exports` with `"."` and, when a double ships, `"./testing"`, laid out like `@repo/ui`. A seventh package is a deliberate act with an ADR. |
| In-memory double | `packages/{pkg}/src/` | `memory.ts` beside the vendor file | Chosen by the package's env at boot; a test's handle on it is the `./testing` subpath. |
| Test | beside its subject | `X.test.ts` next to `X.ts` | In the service and in every package. `.test.ts`. |
| Flow test | `services/api/tests/` | `{flow}.test.ts` | Only for a test with no single subject. |
| Test preload | `services/api/tests/`, `packages/{pkg}/tests/` | `preload.ts` | Named by the workspace's `bunfig.toml`. Awaits the migration, registers a global `beforeEach` resetting the doubles. Sets no env. |
| Test env | each workspace with tests | `.env.test` | Committed, fakes only. |
| Import check | `services/api/scripts/` | `check-imports.ts` | The workspace `check`, chained from the root `check` after Biome. |
| ADR | `docs/adr/` | `000N-slug.md` | One per hard-to-reverse decision. |

## Entry points

`entrypoints/api/app.ts` exports `buildApp()`, returning the composed Elysia instance, and `App`, the type Eden Treaty gives the frontends. `buildApp()` mounts, in order, the plugins that run around a request (`request-id`, `request-logging`, `error-mapping`, `error-reporting`), `cors` and `swagger` inline, then one `.use` per feature, and declares the 422 and 500 responses once. `main.ts` parses the process env and calls `.listen`. A test builds the app from `buildApp()`, so nothing here binds a port.

`entrypoints/jobs/main.ts` imports each feature's `jobs.ts`, merges `handlers` and `schedules`, and calls `startOutboxConsumer(handlers)` and `startSchedules(schedules)` from `@repo/jobs`. A duplicate kind, or a declared kind with no handler, fails at boot.

An entry point imports anything. Nothing imports an entry point but a route test.

## Features

A feature is a flat directory of up to six files, the names in the table, and nothing else. A file that outgrows itself becomes a directory of the same name with an `index.ts` (`service/` with a file per operation); the layer is the first path segment after the feature name, so `service/nudge.ts` is still `service`.

| From | May import within the feature |
| --- | --- |
| `routes` | `service`, `model` |
| `service` | `repository`, `model`, `emails`, another feature's `service` |
| `repository` | `model` |
| `jobs` | `service`, `model` |
| `emails` | `model` |
| `model` | nothing of the feature |

`repository` and `emails` belong to `service` alone. A cross-feature import runs from one `service.ts` to another and nothing else crosses that boundary, which is what earns a routes-only feature its first `service.ts` the moment it calls into a neighbour.

**Edge file** names `routes.ts` and `jobs.ts` together: the two places a feature reads the request, the message, or the clock.

**The clock.** A rule that depends on time takes a required `now: Date` parameter (`nudgeUnanswered(now)`, `isUnanswered(feedback, replyCount, now)`). An edge file reads the clock, writing `new Date()` inline, and the schedule runner passes `run(now)`. A repository takes a computed cutoff. Row timestamps are Drizzle `defaultNow()` defaults. A forgotten `now` is a type error; a clock read in a `service` or `repository` file is a `check` failure.

**Vendors.** A vendor is reached by importing its package: `import { sendEmail } from "@repo/email"`. Email and the clock are the whole list of things a test cannot run, so nothing else is passed in for a test's sake, nothing rides on Elysia's context, and no `service.ts` function receives the context.

**Outbox handlers.** `jobs.ts` stays thin: `handlers = { [acknowledge.kind]: ({ feedbackId }) => sendAcknowledgement(feedbackId) }`. The service gains one operation per outbox kind, which loads the row, builds the message from `emails.ts` and sends it. A schedule is `{ name, cron, run: (now) => nudgeUnanswered(now) }`.

## Packages

Each package is one concern with an outside, laid out like `@repo/ui`: `package.json` with `exports` for `"."` and, when a double ships, `"./testing"`; `tsconfig.json` on the library preset; source under `src/`. A package imports packages only; the workspace graph is what enforces that.

| Package | Exports from `"."` | `./testing` | Env |
| --- | --- | --- | --- |
| `@repo/db` | `db`, `withTransaction`, `migrate`, `checkConnection`, every table | `migrateTestDatabase()` | `DATABASE_URL`; a `pglite:` scheme picks PGlite, anything else the Postgres driver |
| `@repo/errors` | `DomainError`, `Kind`, the helper per kind, `isDomainError` | none | none |
| `@repo/observability` | `logger`, `reportError` | the reported-errors handle and its reset | log level |
| `@repo/email` | `sendEmail`, `EmailMessage`, `verifyWebhookSignature` | `sentEmails()`, `resetSentEmails()` | `EMAIL_PROVIDER`: `memory` or `resend` |
| `@repo/auth` | the Better Auth instance, `isStaff(session)` | a staff-session helper | Better Auth secret and URL |
| `@repo/jobs` | `defineMessage`, `handle`, `enqueue`, `startOutboxConsumer`, `runOutboxOnce`, `startSchedules`, `replayDeadLetter` | `pendingMessages(kind?)` | polling constants are code |

`@repo/errors` imports nothing. `@repo/db` owns `drizzle.config.ts` and `drizzle/`, and its tables are the only `pgTable`s in the repo. `@repo/jobs` holds no message kind and ships a replay script: `bun run --filter @repo/jobs replay 42`.

## Plugins

`src/plugins/` holds only code that runs around a request: hooks, guards, derived values. One Elysia instance per file, `name` equal to the filename. `request-id` derives a child logger; `request-logging` writes a line per request; `error-mapping` owns the status table, the envelope writer and `errorBody`; `error-reporting` sends faults to `reportError`; `rate-limit` counts per process and sets `Retry-After`; `staff-guard` applies `isStaff`. Health, the auth mount and the docs are features or entry-point wiring, not plugins.

## Import direction

1. A package imports packages. `plugins/` imports packages and `elysia`. A feature imports packages, `plugins/` (from `routes.ts` only) and, from its own `service.ts`, another feature's `service.ts`. An entry point imports anything.
2. Inside a feature, the matrix above. The spine is `routes -> service -> repository -> @repo/db`.
3. `plugins/` never imports `features/`, and is imported from `routes.ts` and `entrypoints/` only.
4. `elysia` is imported from `routes.ts`, `model.ts`, `plugins/` and `entrypoints/` only.
5. A `service` or `repository` file takes `now: Date`; the clock is read in an edge file.

`scripts/check-imports.ts` enforces all five on every `bun run check`, judging the resolved path so every spelling of an import is caught, and printing the file, the import and the rule. A test file inherits its subject's layer, and may reach another feature's `service.ts` for a fixture.

## Failures

A service refuses by throwing a `DomainError` from `@repo/errors` and names no status; `plugins/error-mapping.ts` maps the code to a status once, which is what keeps route bodies short. When the frontend has to branch and render something specific, say a quota refusal carrying the limit, the service returns a discriminated union instead and `routes.ts` maps it with `status()`, so Eden Treaty carries the refusal into the client's types.

The kind-and-code envelope, `errorBody`, and the mapping of Elysia's `VALIDATION`, `NOT_FOUND` and `PARSE` replace this paragraph when `@repo/errors` reaches its final form.

## Tests

Not built yet; this is the layout the runner arrives under. `X.test.ts` sits beside `X.ts`, in the service and in every package. A route test drives the whole app through Eden Treaty typed with `App`, built from `buildApp()`, and asserts `error.status` and `error.value.code` on a refusal. The database is PGlite in memory running the same `drizzle/` migrations, one instance per test file. Doubles are chosen by env, so the production import path is the one under test and no test reaches for `mock.module`; a test reads what happened through the package's `./testing` subpath: `sentEmails()`, `pendingMessages(kind?)`, the reported-errors handle. Fixtures go through the owning feature's service, and an old row is reached through a rule's `now` parameter rather than by writing a timestamp. A test may import what its subject may import, plus `bun:test` and any `@repo/*/testing`. Repositories have no tests of their own.

## Vocabulary

- **Feature.** A directory under `features/`, the product's own language.
- **Service.** `service.ts`, the feature's rules and orchestration. Also the deployable, `services/api`; the file is what this word means here.
- **Plugin.** An Elysia instance under `plugins/` that runs around a request.
- **Package.** A `@repo/*` workspace under `packages/`, one concern with an outside.
- **Entry point.** A directory under `entrypoints/`, one process.
- **Edge file.** `routes.ts` or `jobs.ts`, where the request, the message and the clock are read.
- **Outbox.** The table in `@repo/db` and the at-least-once delivery mechanism over it. The package is `jobs`.
- **Message.** A row in the outbox: a `kind` and a TypeBox-checked payload, declared with `defineMessage` in the owning feature's `model.ts`.
- **Kind.** The string naming a message type (`feedback.acknowledge`). Also the closed set a `DomainError` picks its status from; the context says which.
- **Lease.** The 60-second claim a consumer takes on a message. A crashed consumer's row is retaken when the lease lapses.
- **Dead letter.** A message flagged `dead_lettered_at`, skipped by the claim, replayable by id.
- **Handler.** An Elysia route function, or an outbox message handler. A rule is not a handler.
- **Jobs.** The package, the entry point and the feature file; never the outbox itself.

Words this codebase does not use: `shared`, `utils`, `helpers`, `manager`, `controller`, `use case`, `repository interface`.

## Why

The hard-to-reverse decisions behind this file are in `docs/adr/`.
