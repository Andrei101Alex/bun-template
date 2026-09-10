# services/api

Rules for `services/api/src/**` and the backend packages `@repo/{db,auth,email,jobs,observability,errors}`. Look a kind of thing up in the placement table before creating, moving or renaming a file.

## Shape

`src` holds exactly three directories: `entrypoints/` are processes, `features/` is the product, `plugins/` is what runs around a request. A store, a vendor, a runtime or a process facility has an outside, so it is a `@repo/*` package under `packages/`. Everything else belongs to one feature and is reached through its `service.ts`. There is no `shared/`.

```
services/api/
  AGENTS.md  CLAUDE.md -> AGENTS.md
  bunfig.toml  .env.test
  scripts/check-imports.ts
  tests/preload.ts
  src/
    entrypoints/
      api/   main.ts  app.ts  env.ts
      jobs/  main.ts  env.ts
    features/
      health/    routes.ts
      auth/      routes.ts
      feedback/  routes.ts  model.ts  service.ts  repository.ts  emails.ts  jobs.ts
    plugins/
      error-mapping.ts  error-reporting.ts  request-id.ts  request-logging.ts  staff-guard.ts
packages/
  db/  auth/  email/  jobs/  observability/  errors/
```

Built today: the api entry point, `features/health/`, `features/auth/`, `features/feedback/` (`routes` `model` `service` `repository`), `plugins/` less `rate-limit`, `@repo/errors`, `@repo/observability`, `@repo/auth`, `@repo/email`, `@repo/db` with the `feedback` and auth tables and their migrations, and the test runner. The rest of this file is the rule those pieces arrive under.

## Placement table

One row per kind of thing, naming its one legal home. A feature creates a file only when it has that kind of thing: skip a file rather than fake it.

| Kind | Home | Filename | Note |
| --- | --- | --- | --- |
| Route | `src/features/{feature}/` | `routes.ts` | Elysia plugin, guards, response shaping, declared refusal statuses. One to five lines per handler: destructure, call one service operation, return. |
| Schema, exported type, message kind | `src/features/{feature}/` | `model.ts` | `t.Object` schemas, `defineMessage(...)` per outbox kind the feature enqueues. Imports nothing else of the feature. |
| Rule and orchestration | `src/features/{feature}/` | `service.ts` | One exported function per operation, named as the product names it. Rules inline beside the orchestration. The only feature file that sends email or enqueues. |
| Query | `src/features/{feature}/` | `repository.ts` | Every query on the feature's tables. Imports `db` and tables from `@repo/db`, operators from `drizzle-orm`. No interface. |
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

`entrypoints/api/app.ts` exports `buildApp()`, returning the composed Elysia instance, and `App`, the type Eden Treaty gives the frontends. `buildApp()` mounts, in order, the plugins that run around a request (`request-id`, `request-logging`, `error-reporting`, `error-mapping`, reporting first because the first `onError` hook to answer ends the chain), `cors` and `swagger` inline, then one `.use` per feature, and declares the 422 and 500 responses once. `main.ts` parses the process env and calls `.listen`. A test builds the app from `buildApp()`, so nothing here binds a port.

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

**The clock.** A rule that depends on time takes a required `now: Date` parameter (`nudgeUnanswered(now)`, `isUnanswered(feedback, replyCount, now)`). An edge file reads the clock, writing `new Date()` inline, and the schedule runner passes `run(now)`. A repository takes a computed cutoff. Row timestamps are Drizzle `defaultNow()` defaults. A forgotten `now` is a type error; a clock read in a `service` or `repository` file is a `check` failure. A test at those layers is an edge, so it may build the `now` it passes in.

**Vendors.** A vendor is reached by importing its package: `import { sendEmail } from "@repo/email"`. Email and the clock are the whole list of things a test cannot run, so nothing else is passed in for a test's sake, nothing rides on Elysia's context, and no `service.ts` function receives the context.

**Outbox handlers.** `jobs.ts` stays thin: `handlers = { [acknowledge.kind]: ({ feedbackId }) => sendAcknowledgement(feedbackId) }`. The service gains one operation per outbox kind, which loads the row, builds the message from `emails.ts` and sends it. A schedule is `{ name, cron, run: (now) => nudgeUnanswered(now) }`.

## Packages

Each package is one concern with an outside, laid out like `@repo/ui`: `package.json` with `exports` for `"."` and, when a double ships, `"./testing"`; `tsconfig.json` on the library preset; source under `src/`. A package imports packages only; the workspace graph is what enforces that.

| Package | Exports from `"."` | `./testing` | Env |
| --- | --- | --- | --- |
| `@repo/db` | `db`, `withTransaction`, `migrate`, `checkConnection`, every table | `migrateTestDatabase()` | `DATABASE_URL`; a `pglite:` scheme picks PGlite (`pglite://memory`, `pglite://<dir>`), a `postgres:` or `postgresql:` one picks postgres.js, and any other scheme is refused at boot |
| `@repo/errors` | `DomainError`, `Kind`, the helper per kind, `isDomainError` | none | none |
| `@repo/observability` | `logger`, `reportError` | `reportedErrors()`, `resetReportedErrors()` | `LOG_LEVEL`: a pino level or `silent` |
| `@repo/email` | `sendEmail`, `EmailMessage`, `verifyWebhookSignature` | `sentEmails()`, `resetSentEmails()` | `EMAIL_PROVIDER`: `memory` or `resend`, anything else refused at boot; `RESEND_API_KEY` and `EMAIL_FROM` required only when it is `resend` |
| `@repo/auth` | `auth` (the Better Auth instance), `isStaff(session)`, `STAFF_ROLE` | `signUpUser()`, `signUpStaff()` | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` |
| `@repo/jobs` | `defineMessage`, `handle`, `enqueue`, `startOutboxConsumer`, `runOutboxOnce`, `startSchedules`, `replayDeadLetter` | `pendingMessages(kind?)` | polling constants are code |

`@repo/auth` runs Better Auth's `admin` plugin, whose `role` column is what `isStaff` reads, and its `twoFactor` plugin. Its tables belong to `@repo/db` like every other table: `bun run --filter @repo/auth generate-schema` writes `packages/db/src/schema/auth.ts` through the Better Auth CLI, and that file is generated output, never edited by hand. `@repo/errors` imports nothing. `@repo/db` owns `drizzle.config.ts` and `drizzle/`, and its tables are the only `pgTable`s in the repo; `bun run --filter @repo/db generate` writes a migration and `migrate` applies one, so nothing migrates at boot. A repository types its executor as the exported `Database` or `Transaction`, which name no driver, so one query runs on PGlite and on Postgres alike. `@repo/jobs` holds no message kind and ships a replay script: `bun run --filter @repo/jobs replay 42`.

## Plugins

`src/plugins/` holds only code that runs around a request: hooks, guards, derived values. One Elysia instance per file, `name` equal to the filename. `request-id` derives a child logger; `request-logging` writes a line per request; `error-reporting` sends faults to `reportError`; `error-mapping` owns the status table, the envelope writer and `errorBody`; `rate-limit` counts per process and sets `Retry-After`; `staff-guard` applies `isStaff`. Health, the auth mount and the docs are features or entry-point wiring, not plugins.

## Import direction

1. A package imports packages. `plugins/` imports packages and `elysia`. A feature imports packages, `plugins/` (from `routes.ts` only) and, from its own `service.ts`, another feature's `service.ts`. An entry point imports anything.
2. Inside a feature, the matrix above. The spine is `routes -> service -> repository -> @repo/db`.
3. `plugins/` never imports `features/`, and is imported from `routes.ts` and `entrypoints/` only.
4. `elysia` is imported from `routes.ts`, `model.ts`, `plugins/` and `entrypoints/` only.
5. A `service` or `repository` file takes `now: Date`; the clock is read in an edge file or in a test.

`scripts/check-imports.ts` enforces all five on every `bun run check`, judging the resolved path so every spelling of an import is caught, and printing the file, the import and the rule. A test file inherits its subject's layer, and may import its subject and reach another feature's `service.ts` for a fixture.

## Failures

A failure is a *refusal* (a rule, a guard or a missing row says no), a *schema failure* (Elysia's `t.Object` said no), or a *fault* (anything else). All three leave the api as one envelope, `{ code, message, details? }`, written by `plugins/error-mapping.ts`; the request id is in the `x-request-id` header, never in the body.

| Kind | Status | Thrown by |
| --- | --- | --- |
| `invalid` | 422 | a rule a schema cannot express (blank after trim) |
| `unauthenticated` | 401 | `staff-guard` with no session; `email-bounces` on a bad signature |
| `forbidden` | 403 | `staff-guard` with a non-staff session |
| `not_found` | 404 | a service asked for a row that is not there |
| `conflict` | 409 | a rule refusing the current state |
| `rate_limited` | 429 | `rate-limit`, which sets `Retry-After` first |
| `unavailable` | 503 | `health` when the database probe fails |

- A service refuses by throwing `DomainError` from `@repo/errors` through the helper for its kind: `throw conflict("address_undeliverable", "This address bounced")`. `kind` picks the status; `code` is the feature's own word and what a client branches on; `message` is for a developer. A service never names a status.
- A refusal that carries a value the client renders is a discriminated union from the service, mapped in `routes.ts` with `status(409, { code, message, details })` so Treaty carries the literal type. A code and a message alone is always a throw. Example: `features/replies/`.
- Guards refuse the same way: `plugins/staff-guard.ts`, `plugins/rate-limit.ts`, the signature check in `features/email-bounces/routes.ts`.
- A schema failure maps to 422 `{ code: "validation", message, details: [{ path, message }] }`; the input is never echoed. Elysia's `NOT_FOUND` and `PARSE` map to `not_found` 404 and `unparseable_body` 400.
- A fault is 500 `{ code: "internal", message: "Internal server error" }`, reported through `reportError` with the request id. Refusals and schema failures are logged at warn and never reported.
- `routes.ts` declares each refusal it can answer in `response`, with `errorBody` from `plugins/error-mapping.ts`: `response: { 201: feedback, 404: errorBody, 409: errorBody }`. 422 and 500 are declared once in `buildApp()`.
- Under the outbox consumer a `DomainError` is permanent: the row is dead-lettered at once with kind, code and message; anything else retries. A vendor package throws `DomainError` for a deterministic rejection and lets a 5xx or a network error propagate.
- The bounce webhook answers 401 to a bad signature, 200 to an event it does not handle or an address it does not know, 500 when recording fails so the provider retries.

## Tests

`X.test.ts` sits beside `X.ts`, in the service and in every package. A route test drives the whole app through Eden Treaty typed with `App`, built from `buildApp()`, and asserts `error.status` and `error.value.code` on a refusal. The database is PGlite in memory running the same `drizzle/` migrations, one instance per test file. Doubles are chosen by env, so the production import path is the one under test and no test reaches for `mock.module`; a test reads what happened through the package's `./testing` subpath: `sentEmails()`, `pendingMessages(kind?)`, `reportedErrors()`. Fixtures go through the owning feature's service, and an old row is reached through a rule's `now` parameter rather than by writing a timestamp. A test that needs a signed-in caller takes one from `@repo/auth/testing`: `signUpUser()` and `signUpStaff()` sign a fresh user up through Better Auth's own API and hand back `{ userId, headers }`, so a route test passes `headers` to Treaty and no test writes an auth row of its own. Promotion goes through the adapter on `auth.$context` rather than `auth.api.setRole`, because `role` is not a sign-up input and `setRole` wants a caller who is already an admin: there is no public route to the first one. A test may import what its subject may import, plus `bun:test` and any `@repo/*/testing`. Repositories have no tests of their own, and `@repo/db` carries none.

The runner is `bun run test` from the root, which runs each workspace's `bun test --isolate`. A workspace with tests carries a committed `.env.test` holding fakes only, and a `bunfig.toml` naming `tests/preload.ts` when its tests need the database or a reset hook: `@repo/email`'s are pure and carry neither. The preload awaits `migrateTestDatabase()` and registers the global `beforeEach` that resets the doubles: `resetReportedErrors()`, `resetSentEmails()`, truncating `outbox`. A bare root `bun test` reads the root `bunfig.toml` instead, so it loads neither and is unsupported.

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
