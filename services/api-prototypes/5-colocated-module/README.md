# Candidate 5: colocated module

The survey's most common shape (4 repos: techfusionid/elysia-production-template, FrameBaker, elysia-kickstart, elysia-demo-app). One directory per feature under `src/modules/`, whose `index.ts` is the Elysia instance with the routes, the validation schemas, the rules and the queries in one file. A `service.ts` is split out only once a module earns it: `replies` has one because of the nudge rule and the job, `feedback` does not. No repository file anywhere; queries are inline where they are used. Cross-cutting code is `src/common/` with the survey's four buckets (`config`, `db`, `logger`, `middleware`) plus loose files for the rest. Background work is a top-level `src/jobs/` keyed by job, not by feature. Tests are flat, one file per module.

Not the same tree as candidate 3. Candidate 3 is this shape after every module has earned every split (`routes`, `model`, `handlers`, `emails`, `jobs`), plus a `repository.ts` none of the four surveyed repos has. A `feedback` listing is one file here and seven there.

## (a) `POST /feedback`, entrypoint to SQL

| # | File | Role on the way |
| --- | --- | --- |
| 1 | `src/index.ts` | wiring and listen |
| 2 | `src/common/middleware/request-id.ts`, `logging.ts`, `error-handler.ts`, `rate-limit.ts` | hooks |
| 3 | `src/modules/feedback/index.ts` | schema validates, rule runs, INSERT feedback, all in the route body |
| 4 | `src/common/db/schema/feedback.ts` | the table |
| 5 | `src/common/outbox.ts` | INSERT outbox |
| 6 | `src/common/db/client.ts` | transaction and connection |

9 files. The shortest path of any tree, one under candidate 3, because route, rule and query are one file. The path bounces between `modules/feedback` and `common` twice. Nothing in the path names a layer. The file is `index.ts`, and only opening it says what it holds.

## (b) New concern: Slack notification when a reply is posted

| Change | File |
| --- | --- |
| new | `src/common/slack.ts` (webhook call, mirrors `common/email.ts`) |
| new | `src/jobs/notify-staff.ts` (outbox handler) |
| edit | `src/common/config/env.ts` (`SLACK_WEBHOOK_URL`) |
| edit | `src/common/outbox.ts` (kind union gains `reply.notify-staff`) |
| edit | `src/modules/replies/service.ts` (`postReply` enqueues) |
| edit | `src/jobs/run.ts` (handler map) |

2 new, 4 edits, the same count as the hybrid. Two placement questions come up that no rule answers. `common/slack.ts` lands as a loose file beside `auth.ts`, `email.ts`, `outbox.ts` because the survey's four buckets do not cover vendors, and the handler lands in `jobs/` beside handlers for other features because `jobs/` is keyed by job. Had the reply been posted from `feedback` rather than `replies`, the enqueue would go into `modules/feedback/index.ts`, a route file, since that module has no `service.ts`.

## (c) Testing the `replies` nudge rule

- `tests/replies.test.ts` imports `../src/modules/replies/service`. `isUnanswered` is tested directly, but `service.ts` also holds the queries and the email sends, so the pure test loads `common/db/client` and needs the PGlite preload.
- `nudgeUnanswered` needs `mock.module("../src/common/email")`, so the suite runs with `--isolate`.
- The test path says which module, not which layer or which operation. Four test files cover the tree; `tests/replies.test.ts` covers a route, a rule, a job and a query.

## What the listing shows that the counts do not

- **Two legal homes for the same kind of thing.** The rule and the query for `feedback` live in `index.ts`; for `replies` they live in `service.ts`. The placement depends on how old the module is. A placement table cannot name one directory and filename for "rule" or "query" under this shape.
- **What touches the `feedback` table is a grep.** `modules/feedback/index.ts`, `modules/replies/service.ts`, `modules/email-bounces/index.ts`, `jobs/acknowledge.ts` and `jobs/deliver-reply.ts` all query it. Five files in three directories.
- **`common/` has a partial order.** The survey's `config`, `db`, `logger`, `middleware` buckets take 14 of the 19 files; the other five (`auth`, `email`, `errors`, `error-reporting`, `outbox`) are loose. That is more order than candidate 3's `shared/` and less than the hybrid's `platform/`.
- **A feature's story spans two top-level directories**, `modules/<name>/` and `jobs/`, because the surveyed repos with background work (FrameBaker) key jobs by job.

## Listing

42 files, 14 directories under `src/`. Each file's first line says what it would hold.

```
5-colocated-module/
├── drizzle/
│   ├── meta/
│   │   └── _journal.json  # drizzle-kit migration journal
│   └── 0000_feedback_inbox.sql  # generated migration: feedback, replies, outbox, better-auth user/session/account tables
├── src/
│   ├── common/
│   │   ├── config/
│   │   │   └── env.ts  # typed env: one object, api and jobs keys side by side (PORT, DATABASE_URL, BETTER_AUTH_SECRET, RESEND_*, CORS_ORIGINS, STAFF_INBOX, NUDGE_CRON)
│   │   ├── db/
│   │   │   ├── schema/
│   │   │   │   ├── auth.ts  # Better Auth user/session/account tables
│   │   │   │   ├── feedback.ts  # pgTable feedback
│   │   │   │   ├── index.ts  # aggregates the schema files for drizzle-kit and the client
│   │   │   │   ├── outbox.ts  # pgTable outbox
│   │   │   │   └── replies.ts  # pgTable replies
│   │   │   ├── client.ts  # drizzle client + withTransaction; imports schema
│   │   │   └── migrate.ts  # programmatic migrate
│   │   ├── logger/
│   │   │   └── index.ts  # structured logger with requestId child
│   │   ├── middleware/
│   │   │   ├── error-handler.ts  # onError: DomainError -> status, everything else -> reportError + 500
│   │   │   ├── logging.ts  # request logging plugin
│   │   │   ├── rate-limit.ts  # rateLimit plugin
│   │   │   ├── request-id.ts  # request id plugin
│   │   │   └── staff-guard.ts  # staffGuard plugin: session via Better Auth, role === 'staff'
│   │   ├── auth.ts  # Better Auth instance + drizzle adapter + role field
│   │   ├── email.ts  # sendEmail (Resend) + verifyWebhookSignature(rawBody, headers, secret)
│   │   ├── error-reporting.ts  # reportError hook
│   │   ├── errors.ts  # DomainError + codes
│   │   └── outbox.ts  # enqueue(kind, payload, tx) with the MessageKind union; runOutboxConsumer(handlers): claim SKIP LOCKED, dispatch, backoff, dead-letter
│   ├── jobs/
│   │   ├── acknowledge.ts  # outbox handler 'feedback.acknowledge': SELECT feedback inline, acknowledgement template inline, sendEmail
│   │   ├── deliver-reply.ts  # outbox handler 'reply.deliver': SELECT feedback + reply inline, skip undeliverable, sendEmail(replyEmail from modules/replies/service)
│   │   ├── nudge.ts  # schedule { cron: env.NUDGE_CRON, run: nudgeUnanswered (modules/replies/service) }
│   │   └── run.ts  # jobs entrypoint: runOutboxConsumer({ 'feedback.acknowledge': acknowledge, 'reply.deliver': deliverReply }); schedule([nudge]); SIGTERM drains
│   ├── modules/
│   │   ├── auth/
│   │   │   └── index.ts  # new Elysia().all('/auth/*', auth.handler)
│   │   ├── email-bounces/
│   │   │   └── index.ts  # POST /webhooks/email: raw body, verifyWebhookSignature (common/email), UPDATE feedback SET undeliverable inline
│   │   ├── feedback/
│   │   │   └── index.ts  # new Elysia(): POST /feedback (rateLimit) with t.Object body inline, trim/blank rule inline, withTransaction(db.insert(feedback) + enqueue('feedback.acknowledge')); GET /feedback (staffGuard) with the reply-count query inline. No service.ts: the module has not earned one
│   │   ├── health/
│   │   │   └── index.ts  # GET /health: SELECT 1 via common/db
│   │   └── replies/
│   │       ├── index.ts  # new Elysia(): POST /feedback/:id/replies (staffGuard) with body schema inline -> postReply; GET /feedback/:id/replies -> listRepliesFor
│   │       └── service.ts  # earned split: postReply(feedbackId, authorId, body): SELECT feedback inline -> INSERT reply + enqueue('reply.deliver'); listRepliesFor(id); isUnanswered(feedback, replyCount, now) pure rule; nudgeUnanswered(now): the unanswered query inline + isUnanswered -> sendEmail(digest to STAFF_INBOX); replyEmail and nudgeDigestEmail templates
│   └── index.ts  # api entrypoint + wiring: cors, swagger, requestId, logging, errorHandler, then .use per modules/*; listen; export type App
├── tests/
│   ├── email-bounces.test.ts  # bad signature 401; good signature marks the address undeliverable
│   ├── feedback.test.ts  # treaty(app): POST 201 inserts row + outbox message; blank body 400; 429 after the limit; GET 403 without staff session
│   ├── outbox.test.ts  # consumer retry + dead-letter over PGlite
│   ├── preload.ts  # PGlite per file, migrate, mock.module('../src/common/db/client')
│   └── replies.test.ts  # isUnanswered edge cases; nudgeUnanswered over PGlite with mock.module('../src/common/email'); POST reply 201 + outbox message
├── .env.example  # DATABASE_URL, BETTER_AUTH_SECRET, RESEND_API_KEY, RESEND_WEBHOOK_SECRET, CORS_ORIGINS, PORT, STAFF_INBOX, NUDGE_CRON
├── bunfig.toml  # [test] preload = ["./tests/preload.ts"]
├── drizzle.config.ts  # drizzle-kit: schema = ./src/common/db/schema/index.ts, out = ./drizzle, dialect postgresql, url from DATABASE_URL
├── package.json  # name @repo/api; scripts: dev/start = src/index.ts, jobs = src/jobs/run.ts, test = bun test --isolate, db:generate/db:migrate via drizzle-kit
└── tsconfig.json  # extends @repo/typescript-config/library.json
```
