# Candidate 3: Elysia flat module

One directory per feature holding `routes`, `model`, `handlers`, `repository`, `table`, `emails`, `jobs`, close to the template today. Cross-cutting code is a flat `src/shared/`. Layers are named by filename only; the two top-level directories say feature or not-feature. Tests sit beside the file they cover.

## (a) `POST /feedback`, entrypoint to SQL

| # | File | Role on the way |
| --- | --- | --- |
| 1 | `src/index.ts` | wiring and listen |
| 2 | `src/shared/http.ts`, `src/shared/rate-limit.ts` | request id, logging, error mapping, rate limit hooks |
| 3 | `src/features/feedback/routes.ts`, `model.ts` | schema validates, calls `submitFeedback` |
| 4 | `src/features/feedback/handlers.ts` | the rule and the orchestration |
| 5 | `src/features/feedback/repository.ts`, `table.ts` | INSERT feedback |
| 6 | `src/shared/outbox.ts` | INSERT outbox |
| 7 | `src/shared/db.ts` | transaction and connection |

10 files. The shortest path of the four. Everything named feedback is seven files in one flat directory. The layer is in the filename, not the path, so a listing of `features/` shows the shape and a listing of any one feature shows every layer at once.

## (b) New concern: Slack notification when a reply is posted

| Change | File |
| --- | --- |
| new | `src/shared/slack.ts` (port function type plus webhook implementation, mirrors `shared/email.ts`) |
| edit | `src/shared/env.ts` (`SLACK_WEBHOOK_URL`) |
| edit | `src/shared/outbox.ts` (kind union gains `reply.notify-staff`) |
| edit | `src/features/replies/handlers.ts` (`postReply` enqueues) |
| edit | `src/features/replies/jobs.ts` (handler for the kind) |

1 new, 4 edits. Cheapest of the four. The cost shows in `shared/`: twelve files with no order among them (db, email, slack, auth, outbox, logger, http, rate-limit, env, errors, schema, migrate), vendors next to Elysia plumbing, and `shared/http.ts` accreting every lifecycle hook. `env.ts` is one object for both processes, so the jobs process boots with the api's variables required.

## (c) Testing the `replies` nudge rule

- `src/features/replies/handlers.test.ts` imports `./handlers`. `isUnanswered` is tested directly. `nudgeUnanswered` needs `mock.module("../../shared/email")` to capture sends and the PGlite preload for `shared/db`.
- Because `mock.module` leaks across files, the suite needs `--isolate`.
- The pure rule and the orchestration share a file, so testing the pure rule still imports the database-connected modules.

## Listing

43 files, 8 directories under `src/`. Each file's first line says what it would hold.

```
3-elysia-flat-module/
├── drizzle/
│   ├── meta/
│   │   └── _journal.json  # drizzle-kit migration journal
│   └── 0000_feedback_inbox.sql  # generated migration: feedback, replies, outbox, better-auth user/session/account tables
├── src/
│   ├── features/
│   │   ├── auth/
│   │   │   └── routes.ts  # mount Better Auth handler at /auth/*
│   │   ├── email-bounces/
│   │   │   ├── handlers.ts  # recordBounce(event) -> feedback handlers' markAddressUndeliverable
│   │   │   └── routes.ts  # POST /webhooks/email: raw body, verifyWebhookSignature (shared/email), then recordBounce
│   │   ├── feedback/
│   │   │   ├── emails.ts  # acknowledgementEmail(feedback)
│   │   │   ├── handlers.test.ts  # submitFeedback over PGlite: row + outbox message in one tx; blank message throws invalid_input
│   │   │   ├── handlers.ts  # submitFeedback(input): trim/blank rule -> withTransaction(insertFeedback + enqueue('feedback.acknowledge')); listFeedback(); markAddressUndeliverable(email); findUnanswered(before)
│   │   │   ├── jobs.ts  # outbox handler 'feedback.acknowledge': findFeedbackById -> sendEmail(acknowledgementEmail)
│   │   │   ├── model.ts  # t.Object schemas: SubmitFeedbackBody, FeedbackResponse; exported types
│   │   │   ├── repository.ts  # insertFeedback, findFeedbackById, listFeedbackWithReplyCounts, markUndeliverable, findUnanswered: drizzle on feedbackTable
│   │   │   ├── routes.test.ts  # treaty(app): 201, 429, 403
│   │   │   ├── routes.ts  # POST /feedback (rateLimit) -> submitFeedback; GET /feedback (staffGuard) -> listFeedback
│   │   │   └── table.ts  # pgTable feedback
│   │   ├── health/
│   │   │   └── routes.ts  # GET /health: SELECT 1 via shared/db
│   │   └── replies/
│   │       ├── emails.ts  # replyEmail(feedback, reply); nudgeDigestEmail(items)
│   │       ├── handlers.test.ts  # isUnanswered edge cases; nudgeUnanswered over PGlite with the email port stubbed
│   │       ├── handlers.ts  # postReply(feedbackId, authorId, body): feedback handlers' findFeedbackById -> insert + enqueue('reply.deliver'); nudgeUnanswered(now): findUnanswered + isUnanswered -> staff digest; isUnanswered(feedback, replyCount, now) pure rule exported
│   │       ├── jobs.ts  # outbox handler 'reply.deliver' (skip undeliverable, sendEmail); schedule NUDGE_CRON -> nudgeUnanswered
│   │       ├── model.ts  # t.Object schemas for replies
│   │       ├── repository.ts  # insertReply, countRepliesFor, listRepliesFor
│   │       ├── routes.ts  # POST/GET /feedback/:id/replies (staffGuard)
│   │       └── table.ts  # pgTable replies
│   ├── shared/
│   │   ├── auth.ts  # Better Auth instance + drizzle adapter + staffGuard plugin
│   │   ├── db.ts  # drizzle client + withTransaction; imports schema
│   │   ├── email.ts  # sendEmail port (function type) + Resend implementation + verifyWebhookSignature; swap by module import in tests
│   │   ├── env.ts  # typed env: one object, api and jobs keys side by side; each entrypoint reads the slice it needs
│   │   ├── error-reporting.ts  # reportError hook
│   │   ├── errors.ts  # DomainError + codes
│   │   ├── http.ts  # errorMapping plugin + requestId + request logging hooks + errorReporting hook (one file, all Elysia lifecycle plumbing)
│   │   ├── logger.ts  # structured logger with requestId child
│   │   ├── migrate.ts  # programmatic migrate
│   │   ├── outbox.ts  # outboxTable, enqueue(kind, payload, tx), runOutboxConsumer(handlers): claim, dispatch, retry, dead-letter
│   │   ├── rate-limit.ts  # rateLimit plugin
│   │   └── schema.ts  # aggregates features/*/table.ts + outbox + auth tables for drizzle-kit
│   ├── index.ts  # api entrypoint + wiring: cors, swagger, requestId, logging, errorMapping, errorReporting, then one .use per feature; listen; export type App
│   └── jobs.ts  # jobs entrypoint: runOutboxConsumer({ ...feedbackJobs.handlers, ...repliesJobs.handlers }); schedule(repliesJobs.schedules)
├── tests/
│   └── preload.ts  # PGlite per file, migrate, mock.module('../src/shared/db')
├── .env.example  # DATABASE_URL, BETTER_AUTH_SECRET, RESEND_API_KEY, RESEND_WEBHOOK_SECRET, CORS_ORIGINS, PORT
├── bunfig.toml  # [test] preload = ["./tests/preload.ts"] where the candidate has one
├── drizzle.config.ts  # drizzle-kit: schema path (see candidate), out = ./drizzle, dialect postgresql, url from DATABASE_URL
├── package.json  # name @repo/api; scripts: dev/start for the api entrypoint, jobs for the jobs entrypoint, test = bun test, db:generate/db:migrate via drizzle-kit
└── tsconfig.json  # extends @repo/typescript-config/library.json
```
