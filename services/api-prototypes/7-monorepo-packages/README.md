# Candidate 7: monorepo, thin service shell

The survey's fourth shape (2 repos: rayriffy/rayriffy-h, FrameBaker). The HTTP service is a thin shell and the structure lives one level up in `packages/`, which this repo already has for `ui` and `typescript-config`. The tree root here stands for the **repo root**, not for `services/api`, because the shape moves most of `services/api` out of it.

Infrastructure is one workspace per concern (`@repo/db`, `@repo/auth`, `@repo/email`, `@repo/outbox`, `@repo/observability`). The domain is one workspace, `@repo/inbox`, holding `feedback`, `replies` and `bounces` as plain functions with no Elysia import. `services/api` holds routes, plugins and an env; `services/jobs` holds the consumer loop and an env. Workspace dependencies in each `package.json` are the import rule: `@repo/inbox` cannot import `elysia` because it does not declare it.

## (a) `POST /feedback`, entrypoint to SQL

| # | File | Role on the way |
| --- | --- | --- |
| 1 | `services/api/src/index.ts` | env, listen |
| 2 | `services/api/src/app.ts` | plugins, auth mount, routes |
| 3 | `services/api/src/plugins/request-id.ts`, `logging.ts`, `error-mapping.ts`, `rate-limit.ts` | hooks |
| 4 | `services/api/src/routes/feedback.ts` | schema validates, calls `submitFeedback` |
| 5 | `packages/inbox/src/feedback/submit-feedback.ts` | the rule and the orchestration |
| 6 | `packages/inbox/src/feedback/repository.ts` | INSERT feedback |
| 7 | `packages/db/src/schema/feedback.ts` | the table |
| 8 | `packages/outbox/src/enqueue.ts` | INSERT outbox |
| 9 | `packages/db/src/client.ts` | transaction and connection |

12 files, the same as the hybrid, across four workspaces (`api`, `inbox`, `db`, `outbox`). The layer is the workspace name, so it is in every import path (`@repo/inbox`, `@repo/db`) as well as the file path.

## (b) New concern: Slack notification when a reply is posted

| Change | File |
| --- | --- |
| new | `packages/slack/package.json`, `tsconfig.json`, `src/notify.ts`, `src/index.ts` (a workspace, mirrors `packages/email`) |
| new | `packages/inbox/src/replies/notify-staff.ts` (outbox handler) |
| edit | `packages/inbox/package.json` (depends on `@repo/slack`), then `bun install` |
| edit | `services/jobs/src/env.ts` (`SLACK_WEBHOOK_URL`) |
| edit | `packages/outbox/src/kinds.ts` (kind union gains `reply.notify-staff`) |
| edit | `packages/inbox/src/replies/post-reply.ts` (enqueue) |
| edit | `packages/inbox/src/jobs.ts` (handler map) |

5 new, 5 edits and an install. The most expensive after the rings. Every answer is still one place, but a vendor costs a workspace: `package.json`, `tsconfig.json`, an `index.ts` barrel and a dependency declaration. The kind union sits in `@repo/outbox`, so `@repo/inbox` edits a package it depends on to add a message; the open point the hybrid exposed is a cross-workspace edit here.

## (c) Testing the `replies` nudge rule

- `packages/inbox/src/replies/unanswered.test.ts` imports `./unanswered`. Pure, no preload, no database modules loaded.
- `packages/inbox/src/replies/nudge-unanswered.test.ts` uses `mock.module("@repo/email")` by package name, no relative path to count, over the PGlite preload in `packages/inbox/tests/preload.ts`, which mocks `@repo/db` the same way. Needs `--isolate`.
- The preload is per workspace: `inbox`, `outbox` and `api` each carry a `tests/preload.ts` and a `bunfig.toml`. A root `bun test` reads only the root `bunfig.toml` (bun test research), so the root `test` script has to be `bun run --filter '*' test`, and "green from the repo root" means every workspace's suite passes in turn.

## What the listing shows that the counts do not

- **The import rule is enforced for free.** `@repo/inbox` declares `@repo/db`, `@repo/outbox`, `@repo/email` and nothing else; an `elysia` import there fails to resolve. No other candidate enforces its direction by a tool.
- **`services/api` nearly disappears.** Eighteen files, thirteen under `src/`, all HTTP: routes, plugins, an env, an app. The destination asks for an architecture of `services/api`; this shape's answer is that the architecture is the workspace graph and `services/api` is one node.
- **Nine `package.json` files** for what the other trees do in one, plus three preloads and three `bunfig.toml`. A second domain is another workspace, and any code it shares with `inbox` needs one more or a dependency between the two.
- **The `App` type crosses workspaces.** `export type App` in `services/api` now references `@repo/inbox` and `@repo/auth` types; the frontends' `treaty<App>` resolves through workspace symlinks, which works today for `@repo/ui` and is not new, but the type graph a frontend typecheck loads grows to five workspaces.

## Listing

84 files, 32 directories, counted from the tree root since the shape has no single `src/`. Each file's first line says what it would hold.

```
7-monorepo-packages/
├── packages/
│   ├── auth/
│   │   ├── src/
│   │   │   ├── auth.ts  # Better Auth instance + drizzle adapter (@repo/db) + role field
│   │   │   ├── index.ts  # exports auth, staffGuard
│   │   │   └── staff-guard.ts  # staffGuard Elysia plugin: session -> role === 'staff' or 403
│   │   ├── package.json  # name @repo/auth; deps @repo/db, better-auth, elysia (peer, for the guard plugin)
│   │   └── tsconfig.json  # extends @repo/typescript-config/library.json
│   ├── db/
│   │   ├── drizzle/
│   │   │   ├── meta/
│   │   │   │   └── _journal.json  # drizzle-kit migration journal
│   │   │   └── 0000_feedback_inbox.sql  # generated migration: feedback, replies, outbox, better-auth user/session/account tables
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── auth.ts  # Better Auth tables
│   │   │   │   ├── feedback.ts  # pgTable feedback
│   │   │   │   ├── index.ts  # aggregates the schema files
│   │   │   │   ├── outbox.ts  # pgTable outbox
│   │   │   │   └── replies.ts  # pgTable replies
│   │   │   ├── client.ts  # drizzle client + withTransaction; DATABASE_URL read here, the one env var a package reads itself
│   │   │   ├── index.ts  # exports db, withTransaction, migrate, schema tables
│   │   │   └── migrate.ts  # programmatic migrate; used by services at boot and by test preloads
│   │   ├── drizzle.config.ts  # drizzle-kit: schema = ./src/schema/index.ts, out = ./drizzle
│   │   ├── package.json  # name @repo/db; exports ./src/index.ts; scripts db:generate/db:migrate
│   │   └── tsconfig.json  # extends @repo/typescript-config/library.json
│   ├── email/
│   │   ├── src/
│   │   │   ├── index.ts  # exports sendEmail, verifyWebhookSignature, EmailMessage type
│   │   │   ├── send.ts  # sendEmail(message) over Resend; RESEND_API_KEY read here
│   │   │   └── webhook-signature.ts  # verifyWebhookSignature(rawBody, headers, secret)
│   │   ├── package.json  # name @repo/email; deps resend
│   │   └── tsconfig.json  # extends @repo/typescript-config/library.json
│   ├── inbox/
│   │   ├── src/
│   │   │   ├── bounces/
│   │   │   │   └── record-bounce.ts  # recordBounce(event) -> markAddressUndeliverable
│   │   │   ├── feedback/
│   │   │   │   ├── acknowledgement-email.ts  # acknowledgementEmail(feedback)
│   │   │   │   ├── find-unanswered.ts  # findUnanswered(before)
│   │   │   │   ├── list-feedback.ts  # listFeedback(): inbox listing with reply counts
│   │   │   │   ├── mark-address-undeliverable.ts  # markAddressUndeliverable(email)
│   │   │   │   ├── repository.ts  # insertFeedback, findFeedbackById, listFeedbackWithReplyCounts, markUndeliverable, findUnanswered: drizzle on @repo/db's feedback table
│   │   │   │   ├── submit-feedback.test.ts  # over PGlite: row + outbox message in one tx; blank throws DomainError
│   │   │   │   └── submit-feedback.ts  # submitFeedback(input): trim/blank rule -> withTransaction(insertFeedback + enqueue('feedback.acknowledge')); plain values in and out, no elysia import anywhere in this package
│   │   │   ├── replies/
│   │   │   │   ├── nudge-unanswered.test.ts  # over PGlite with mock.module('@repo/email')
│   │   │   │   ├── nudge-unanswered.ts  # nudgeUnanswered(now): findUnanswered + isUnanswered -> sendEmail(nudgeDigest) to STAFF_INBOX
│   │   │   │   ├── post-reply.ts  # postReply(feedbackId, authorId, body): findFeedbackById -> insertReply + enqueue('reply.deliver')
│   │   │   │   ├── reply-email.ts  # replyEmail(feedback, reply); nudgeDigestEmail(items)
│   │   │   │   ├── repository.ts  # insertReply, countRepliesFor, listRepliesFor
│   │   │   │   ├── unanswered.test.ts  # isUnanswered edge cases, no I/O
│   │   │   │   └── unanswered.ts  # isUnanswered(feedback, replyCount, now, threshold): pure rule
│   │   │   ├── errors.ts  # DomainError + codes
│   │   │   ├── index.ts  # exports the operations, inboxJobs, inboxSchedules, DomainError
│   │   │   └── jobs.ts  # inboxJobs = { 'feedback.acknowledge': sendAcknowledgement, 'reply.deliver': deliverReply }; inboxSchedules = [{ cron, run: nudgeUnanswered }]
│   │   ├── tests/
│   │   │   └── preload.ts  # PGlite per file, migrate, mock.module('@repo/db')
│   │   ├── bunfig.toml  # [test] preload = ["./tests/preload.ts"]
│   │   ├── package.json  # name @repo/inbox; deps @repo/db, @repo/outbox, @repo/email; scripts test = bun test --isolate
│   │   └── tsconfig.json  # extends @repo/typescript-config/library.json
│   ├── observability/
│   │   ├── src/
│   │   │   ├── error-reporting.ts  # reportError hook
│   │   │   ├── index.ts  # exports logger, reportError
│   │   │   └── logger.ts  # structured logger with child(requestId)
│   │   ├── package.json  # name @repo/observability
│   │   └── tsconfig.json  # extends @repo/typescript-config/library.json
│   ├── outbox/
│   │   ├── src/
│   │   │   ├── consumer.test.ts  # retry + dead-letter over PGlite
│   │   │   ├── consumer.ts  # startOutboxConsumer(handlers): claim SKIP LOCKED, dispatch, backoff, dead-letter
│   │   │   ├── enqueue.ts  # enqueue(kind, payload, tx) on @repo/db's outbox table
│   │   │   ├── index.ts  # exports enqueue, startOutboxConsumer, MessageKind, Handlers type
│   │   │   └── kinds.ts  # MessageKind union + payload types per kind; every producer package edits this file
│   │   ├── tests/
│   │   │   └── preload.ts  # PGlite per file, migrate, mock.module('@repo/db')
│   │   ├── bunfig.toml  # [test] preload = ["./tests/preload.ts"]
│   │   ├── package.json  # name @repo/outbox; deps @repo/db; scripts test = bun test --isolate
│   │   └── tsconfig.json  # extends @repo/typescript-config/library.json
│   ├── typescript-config/  # unchanged, the existing presets
│   └── ui/  # unchanged, the existing UI kit
├── services/
│   ├── api/
│   │   ├── src/
│   │   │   ├── plugins/
│   │   │   │   ├── error-mapping.ts  # DomainError (@repo/inbox) -> status; the one place that knows both
│   │   │   │   ├── error-reporting.ts  # onError -> reportError (@repo/observability)
│   │   │   │   ├── health.ts  # GET /health probing @repo/db
│   │   │   │   ├── logging.ts  # request logging plugin over @repo/observability
│   │   │   │   ├── rate-limit.ts  # rateLimit plugin
│   │   │   │   └── request-id.ts  # request id plugin
│   │   │   ├── routes/
│   │   │   │   ├── email-bounces.ts  # POST /webhooks/email: raw body, verifyWebhookSignature (@repo/email), recordBounce
│   │   │   │   ├── feedback.test.ts  # treaty(buildApp()): 201, 429, 403
│   │   │   │   ├── feedback.ts  # t.Object schemas inline; POST /feedback (rateLimit) -> submitFeedback; GET /feedback (staffGuard from @repo/auth) -> listFeedback
│   │   │   │   └── replies.ts  # POST/GET /feedback/:id/replies (staffGuard) -> postReply, listRepliesFor
│   │   │   ├── app.ts  # buildApp(): cors, swagger, plugins, auth mount (@repo/auth), health, one .use per routes/*
│   │   │   ├── env.ts  # typed env for the api process (PORT, CORS_ORIGINS, BETTER_AUTH_SECRET, RESEND_WEBHOOK_SECRET)
│   │   │   └── index.ts  # reads env, buildApp(), listen; export type App
│   │   ├── tests/
│   │   │   └── preload.ts  # PGlite per file, migrate, mock.module('@repo/db')
│   │   ├── .env.example  # PORT, DATABASE_URL, BETTER_AUTH_SECRET, RESEND_API_KEY, RESEND_WEBHOOK_SECRET, CORS_ORIGINS
│   │   ├── bunfig.toml  # [test] preload = ["./tests/preload.ts"]
│   │   ├── package.json  # name @repo/api; deps @repo/inbox, @repo/auth, @repo/email, @repo/db, @repo/observability, elysia; scripts dev/start, test = bun test --isolate
│   │   └── tsconfig.json  # extends @repo/typescript-config/library.json
│   └── jobs/
│       ├── src/
│       │   ├── env.ts  # typed env for the jobs process (DATABASE_URL, RESEND_API_KEY, STAFF_INBOX, NUDGE_CRON, OUTBOX_BATCH_SIZE)
│       │   ├── index.ts  # reads env, startOutboxConsumer(inboxJobs), startSchedules(inboxSchedules); SIGTERM drains
│       │   └── schedules.ts  # startSchedules(list): cron runner, one log line per run
│       ├── .env.example  # DATABASE_URL, RESEND_API_KEY, STAFF_INBOX, NUDGE_CRON, OUTBOX_BATCH_SIZE
│       ├── package.json  # name @repo/jobs; deps @repo/inbox, @repo/outbox, @repo/observability; scripts start
│       └── tsconfig.json  # extends @repo/typescript-config/library.json
└── package.json  # root: workspaces ["apps/*", "packages/*", "services/*"]; test = bun run --filter '*' test, since a root bun test reads only the root bunfig and no package preload
```
