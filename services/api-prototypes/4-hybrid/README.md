# Candidate 4: hybrid

`src/features/<name>/{http,core,data,jobs}/`, `src/platform/` for cross-cutting concerns, `src/entrypoints/{api,jobs}/` for the two processes with a typed env each. A feature omits a layer directory it has no files for (`email-bounces` has no `data/` or `jobs/`). Tests sit beside the file they cover, inside the layer directory.

## (a) `POST /feedback`, entrypoint to SQL

| # | File | Role on the way |
| --- | --- | --- |
| 1 | `src/entrypoints/api/main.ts` | env, listen |
| 2 | `src/entrypoints/api/app.ts` | platform plugins, one `.use` per feature |
| 3 | `src/platform/http/request-id.ts`, `logging.ts`, `rate-limit.ts` | hooks |
| 4 | `src/features/feedback/http/routes.ts`, `schemas.ts` | schema validates, calls `submitFeedback` |
| 5 | `src/features/feedback/core/submit-feedback.ts` | the rule and the orchestration |
| 6 | `src/features/feedback/data/repository.ts`, `table.ts` | INSERT feedback |
| 7 | `src/platform/outbox/enqueue.ts` | INSERT outbox |
| 8 | `src/platform/db/client.ts` | transaction and connection |

12 files. Two more than the flat module (the entrypoint split and the plugin files). The path names the layer at every step: `features/feedback/http`, `core`, `data`, `platform/outbox`.

## (b) New concern: Slack notification when a reply is posted

| Change | File |
| --- | --- |
| new | `src/platform/slack/notify.ts` (port function type plus webhook implementation, mirrors `platform/email/send.ts`) |
| new | `src/features/replies/jobs/notify-staff.ts` (outbox handler) |
| edit | `src/entrypoints/jobs/env.ts` (`SLACK_WEBHOOK_URL`) |
| edit | `src/platform/outbox/enqueue.ts` (kind union gains `reply.notify-staff`) |
| edit | `src/features/replies/core/post-reply.ts` (enqueue) |
| edit | `src/features/replies/jobs/index.ts` (add to the feature's handler map) |

2 new, 4 edits. Each answer is one directory: a vendor goes in `platform/<vendor>/`, the decision to notify in the feature's `core/`, the asynchronous handler in the feature's `jobs/`, the variable in the entrypoint that reads it. Open point visible here: the kind union is central in `platform/outbox/enqueue.ts`, so every new message kind edits platform. Deriving kinds from the registry would remove that edit but makes `core` depend on `entrypoints`.

## (c) Testing the `replies` nudge rule

- `src/features/replies/core/unanswered.test.ts` imports `./unanswered`. Pure, no preload, no database modules loaded.
- `src/features/replies/core/nudge-unanswered.test.ts` imports `./nudge-unanswered`, seeds through `../../feedback/core/submit-feedback`, and uses `mock.module("../../../platform/email/send")` for the sender over the PGlite preload. Needs `--isolate`, same as candidate 3.
- Rule and orchestration are separate files, so the pure test never touches the database.

## Listing

66 files, 25 directories under `src/`. Each file's first line says what it would hold.

```
4-hybrid/
├── drizzle/
│   ├── meta/
│   │   └── _journal.json  # drizzle-kit migration journal
│   └── 0000_feedback_inbox.sql  # generated migration: feedback, replies, outbox, better-auth user/session/account tables
├── src/
│   ├── entrypoints/
│   │   ├── api/
│   │   │   ├── app.ts  # buildApp(): platform http plugins, auth mount, health, then one .use per features/*/http/routes
│   │   │   ├── env.ts  # typed env for the api process (PORT, DATABASE_URL, BETTER_AUTH_SECRET, RESEND_*, CORS_ORIGINS)
│   │   │   └── main.ts  # reads env, buildApp(), listen; export type App
│   │   └── jobs/
│   │       ├── env.ts  # typed env for the jobs process (DATABASE_URL, RESEND_API_KEY, STAFF_INBOX, NUDGE_CRON, OUTBOX_BATCH_SIZE)
│   │       ├── main.ts  # reads env, startOutboxConsumer(handlers), startSchedules(schedules); SIGTERM drains
│   │       └── registry.ts  # handlers = { ...feedbackJobs, ...repliesJobs }; schedules = [...repliesSchedules]: the one place kinds meet handlers
│   ├── features/
│   │   ├── email-bounces/
│   │   │   ├── core/
│   │   │   │   └── record-bounce.ts  # recordBounce(event) -> markAddressUndeliverable (feedback core)
│   │   │   └── http/
│   │   │       └── routes.ts  # POST /webhooks/email: raw body, verifyWebhookSignature (platform/email), recordBounce
│   │   ├── feedback/
│   │   │   ├── core/
│   │   │   │   ├── acknowledgement-email.ts  # acknowledgementEmail(feedback)
│   │   │   │   ├── find-unanswered.ts  # findUnanswered(before); imported by replies
│   │   │   │   ├── list-feedback.ts  # listFeedback(): inbox listing with reply counts
│   │   │   │   ├── mark-address-undeliverable.ts  # markAddressUndeliverable(email); imported by email-bounces
│   │   │   │   ├── submit-feedback.test.ts  # over PGlite: row + outbox message in one tx; blank throws
│   │   │   │   └── submit-feedback.ts  # submitFeedback(input): trim/blank rule -> withTransaction(insertFeedback + enqueue('feedback.acknowledge'))
│   │   │   ├── data/
│   │   │   │   ├── repository.test.ts  # findUnanswered query shape on PGlite
│   │   │   │   ├── repository.ts  # insertFeedback, findFeedbackById, listFeedbackWithReplyCounts, markUndeliverable, findUnanswered
│   │   │   │   └── table.ts  # pgTable feedback
│   │   │   ├── http/
│   │   │   │   ├── routes.test.ts  # treaty(buildApp()): 201, 429, 403
│   │   │   │   ├── routes.ts  # POST /feedback (rateLimit) -> submitFeedback; GET /feedback (staffGuard) -> listFeedback
│   │   │   │   └── schemas.ts  # t.Object request/response models
│   │   │   └── jobs/
│   │   │       ├── index.ts  # export const feedbackJobs = { 'feedback.acknowledge': sendAcknowledgement
│   │   │       └── send-acknowledgement.ts  # outbox handler 'feedback.acknowledge'
│   │   └── replies/
│   │       ├── core/
│   │       │   ├── nudge-unanswered.test.ts  # over PGlite with platform/email stubbed via mock.module
│   │       │   ├── nudge-unanswered.ts  # nudgeUnanswered(now): findUnanswered (feedback core) + isUnanswered -> sendEmail(nudgeDigest) to STAFF_INBOX
│   │       │   ├── post-reply.ts  # postReply(feedbackId, authorId, body): findFeedbackById (feedback core) -> insertReply + enqueue('reply.deliver')
│   │       │   ├── reply-email.ts  # replyEmail(feedback, reply); nudgeDigestEmail(items)
│   │       │   ├── unanswered.test.ts  # isUnanswered edge cases, no I/O
│   │       │   └── unanswered.ts  # isUnanswered(feedback, replyCount, now, threshold): pure rule
│   │       ├── data/
│   │       │   ├── repository.ts  # insertReply, countRepliesFor, listRepliesFor
│   │       │   └── table.ts  # pgTable replies
│   │       ├── http/
│   │       │   ├── routes.ts  # POST/GET /feedback/:id/replies (staffGuard)
│   │       │   └── schemas.ts  # t.Object models
│   │       └── jobs/
│   │           ├── deliver-reply.ts  # outbox handler 'reply.deliver'
│   │           ├── index.ts  # export const repliesJobs = { 'reply.deliver': deliverReply }; export const repliesSchedules = [nudgeSchedule]
│   │           └── nudge-schedule.ts  # schedule { cron: env.nudgeCron, run: nudgeUnanswered
│   └── platform/
│       ├── auth/
│       │   ├── auth.ts  # Better Auth instance + drizzle adapter + role field
│       │   ├── routes.ts  # mount Better Auth handler at /auth/*
│       │   ├── staff-guard.ts  # staffGuard plugin
│       │   └── table.ts  # Better Auth tables
│       ├── db/
│       │   ├── client.ts  # drizzle client + withTransaction
│       │   ├── migrate.ts  # programmatic migrate
│       │   └── schema.ts  # aggregates features/*/data/table.ts + platform/outbox/table.ts + platform/auth/table.ts for drizzle-kit
│       ├── email/
│       │   ├── send.ts  # sendEmail port (function type) + Resend implementation; from address from env
│       │   └── webhook-signature.ts  # verifyWebhookSignature(rawBody, headers, secret)
│       ├── http/
│       │   ├── error-mapping.ts  # DomainError -> status
│       │   ├── error-reporting.ts  # onError -> reporter
│       │   ├── health.ts  # GET /health probing db
│       │   ├── logging.ts  # request logging plugin
│       │   ├── rate-limit.ts  # rateLimit plugin
│       │   └── request-id.ts  # request id plugin
│       ├── outbox/
│       │   ├── consumer.test.ts  # retry + dead-letter
│       │   ├── consumer.ts  # startOutboxConsumer(handlers): claim SKIP LOCKED, dispatch, backoff, dead-letter
│       │   ├── enqueue.ts  # enqueue(kind, payload, tx); MessageKind union
│       │   └── table.ts  # pgTable outbox
│       ├── schedules/
│       │   └── start.ts  # startSchedules(list): cron runner, one log line per run
│       ├── error-reporting.ts  # reportError hook
│       ├── errors.ts  # DomainError + codes
│       └── logger.ts  # structured logger
├── tests/
│   └── preload.ts  # PGlite per file, migrate, mock.module('../src/platform/db/client')
├── .env.example  # DATABASE_URL, BETTER_AUTH_SECRET, RESEND_API_KEY, RESEND_WEBHOOK_SECRET, CORS_ORIGINS, PORT
├── bunfig.toml  # [test] preload = ["./tests/preload.ts"] where the candidate has one
├── drizzle.config.ts  # drizzle-kit: schema path (see candidate), out = ./drizzle, dialect postgresql, url from DATABASE_URL
├── package.json  # name @repo/api; scripts: dev/start for the api entrypoint, jobs for the jobs entrypoint, test = bun test, db:generate/db:migrate via drizzle-kit
└── tsconfig.json  # extends @repo/typescript-config/library.json
```
