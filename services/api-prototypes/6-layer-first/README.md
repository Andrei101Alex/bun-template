# Candidate 6: layer-first controller/service/model/route

The survey's second shape (2 repos, both Hono: Joker666/hono-starter, OultimoCoder/cloudflare-planetscale-hono-boilerplate), in the vocabulary Elysia's own best-practice page uses. One top-level directory per kind of thing: `routes/`, `controllers/`, `services/`, `models/`, `tables/`, `middlewares/`, `config/`, `factories/`, and `jobs/` for the background handlers. One file per feature per directory, suffixed by kind (`feedback.controller.ts`). No repository layer; a service queries the ORM directly, and the table definitions sit apart in `tables/`. Tests in `tests/integration/` mirror `controllers/`.

Elysia's page folds route and controller into one (the Elysia instance is the controller). Both surveyed repos keep them apart, so the tree does; merging them would remove one file and one directory from every trace below.

## (a) `POST /feedback`, entrypoint to SQL

| # | File | Role on the way |
| --- | --- | --- |
| 1 | `src/index.ts` | env, listen |
| 2 | `src/factories/app.factory.ts` | middlewares, auth mount, routes |
| 3 | `src/middlewares/request-id.middleware.ts`, `logging.middleware.ts`, `error-handler.middleware.ts`, `rate-limit.middleware.ts` | hooks |
| 4 | `src/routes/index.ts`, `src/routes/feedback.route.ts` | path, schema reference, guard, controller reference |
| 5 | `src/controllers/feedback.controller.ts` | body to plain values, response shaping |
| 6 | `src/models/feedback.model.ts` | schema validates |
| 7 | `src/services/feedback.service.ts` | the rule, INSERT feedback |
| 8 | `src/tables/feedback.table.ts` | the table |
| 9 | `src/services/outbox.service.ts` | INSERT outbox |
| 10 | `src/config/db.ts` | transaction and connection |

14 files across 8 directories. Longer than everything but the rings, and `feedback` is named in five directories (`routes`, `controllers`, `models`, `services`, `tables`). The layer is in the path and in the filename at every step, and no directory is "the feedback feature".

## (b) New concern: Slack notification when a reply is posted

| Change | File |
| --- | --- |
| new | `src/services/slack.service.ts` (webhook call, mirrors `services/email.service.ts`) |
| new | `src/jobs/notify-staff.job.ts` (outbox handler) |
| edit | `src/config/env.ts` (`SLACK_WEBHOOK_URL`) |
| edit | `src/models/outbox.model.ts` (kind union gains `reply.notify-staff`) |
| edit | `src/services/replies.service.ts` (`postReply` enqueues) |
| edit | `src/jobs/index.ts` (handler map) |

2 new, 4 edits. Every new file has exactly one directory by its kind, with no sub-decision. This is the shape whose placement table is its directory list. The cost is that `services/` holds `slack.service.ts`, `email.service.ts`, `outbox.service.ts`, `feedback.service.ts` and `replies.service.ts` side by side, with nothing in the path separating a vendor from a rule from infrastructure.

## (c) Testing the `replies` nudge rule

- `tests/integration/` mirrors `controllers/`, and the nudge rule has no controller, so the surveyed layout has no slot for it. The tree adds `tests/unit/`, which neither surveyed repo has.
- `tests/unit/replies.service.test.ts` imports `../../src/services/replies.service`, which imports `config/db`, `email.service` and `outbox.service`, so the pure rule test needs the PGlite preload and `mock.module("../../src/services/email.service")`, and the suite runs with `--isolate`.
- Rule and I/O share a file, as in candidates 3 and 5.

## What the listing shows that the counts do not

- **Adding a feature touches six directories and the mirror.** A new feature is a `route`, a `controller`, a `model`, a `service`, a `table`, usually a `job`, and a `tests/integration/` file. Nothing is created that a listing of one directory reveals.
- **A feature has no directory to delete.** Removing `replies` is a hunt across six directories; a feature-first tree removes one.
- **The vendor question is unanswered.** `services/` is where business logic and third-party clients both land. The two surveyed repos have `config/` for connection objects, which is why `config/db.ts` and `config/auth.ts` sit there, but a vendor call with logic in it (`email.service.ts`) has no better home.
- **`jobs/` is an addition.** Neither surveyed repo shows a jobs directory; the one FrameBaker keeps is keyed by job. Here it follows the layer-first rule and is keyed by job too, so a feature's background work sits apart from its service.

## Listing

57 files, 10 directories under `src/`. Each file's first line says what it would hold.

```
6-layer-first/
├── drizzle/
│   ├── meta/
│   │   └── _journal.json  # drizzle-kit migration journal
│   └── 0000_feedback_inbox.sql  # generated migration: feedback, replies, outbox, better-auth user/session/account tables
├── src/
│   ├── config/
│   │   ├── auth.ts  # Better Auth instance + drizzle adapter + role field
│   │   ├── db.ts  # drizzle client + withTransaction; imports tables/index
│   │   ├── env.ts  # typed env: one object, api and jobs keys side by side
│   │   ├── error-reporting.ts  # reportError hook
│   │   ├── logger.ts  # structured logger with requestId child
│   │   └── migrate.ts  # programmatic migrate
│   ├── controllers/
│   │   ├── email-bounces.controller.ts  # receive(ctx): raw body, emailService.verifyWebhookSignature, feedbackService.markAddressUndeliverable
│   │   ├── feedback.controller.ts  # submit(ctx): body -> feedbackService.submitFeedback -> 201 shape; list(ctx): feedbackService.listFeedback
│   │   ├── health.controller.ts  # check(): SELECT 1 via config/db
│   │   └── replies.controller.ts  # create(ctx): params + body -> repliesService.postReply; list(ctx): repliesService.listRepliesFor
│   ├── factories/
│   │   └── app.factory.ts  # createApp(): cors, swagger, middlewares in order, auth mount, routes/index; export type App = ReturnType
│   ├── jobs/
│   │   ├── acknowledge.job.ts  # outbox handler 'feedback.acknowledge': feedbackService.findById -> emailService.send(acknowledgement)
│   │   ├── deliver-reply.job.ts  # outbox handler 'reply.deliver': skip undeliverable, emailService.send(replyEmail)
│   │   ├── index.ts  # handlers = { 'feedback.acknowledge': acknowledge, 'reply.deliver': deliverReply }; schedules = [nudge]
│   │   └── nudge.job.ts  # schedule { cron: env.NUDGE_CRON, run: repliesService.nudgeUnanswered }
│   ├── middlewares/
│   │   ├── error-handler.middleware.ts  # onError: DomainError -> status, else reportError + 500
│   │   ├── logging.middleware.ts  # request logging plugin
│   │   ├── rate-limit.middleware.ts  # rateLimit plugin
│   │   ├── request-id.middleware.ts  # request id plugin
│   │   └── staff-guard.middleware.ts  # staffGuard plugin
│   ├── models/
│   │   ├── email-bounce.model.ts  # t.Object for the provider's bounce event
│   │   ├── errors.ts  # DomainError base class
│   │   ├── feedback.model.ts  # t.Object SubmitFeedbackBody, FeedbackResponse; Feedback domain type; DomainError codes for feedback
│   │   ├── outbox.model.ts  # MessageKind union + payload types per kind
│   │   └── reply.model.ts  # t.Object CreateReplyBody, ReplyResponse; Reply domain type
│   ├── routes/
│   │   ├── auth.route.ts  # all('/auth/*', auth.handler)
│   │   ├── email-bounces.route.ts  # POST /webhooks/email -> emailBouncesController.receive
│   │   ├── feedback.route.ts  # new Elysia().post('/feedback', feedbackController.submit, { body: SubmitFeedbackBody, beforeHandle: rateLimit }).get('/feedback', feedbackController.list, { beforeHandle: staffGuard })
│   │   ├── health.route.ts  # GET /health -> healthController.check
│   │   ├── index.ts  # registerRoutes(app): one .use per route file
│   │   └── replies.route.ts  # POST/GET /feedback/:id/replies -> repliesController, staffGuard
│   ├── services/
│   │   ├── email.service.ts  # Resend client, send(message), verifyWebhookSignature(rawBody, headers, secret)
│   │   ├── feedback.service.ts  # submitFeedback(input): trim/blank rule -> withTransaction(db.insert(feedbackTable) + outboxService.enqueue('feedback.acknowledge')); listFeedback() with reply counts inline; findById; markAddressUndeliverable(email); findUnanswered(before); acknowledgementEmail template
│   │   ├── outbox.service.ts  # enqueue(kind, payload, tx); runConsumer(handlers): claim SKIP LOCKED, dispatch, backoff, dead-letter
│   │   └── replies.service.ts  # postReply(feedbackId, authorId, body): feedbackService.findById -> db.insert(repliesTable) + enqueue('reply.deliver'); listRepliesFor; isUnanswered(feedback, replyCount, now) pure rule; nudgeUnanswered(now): feedbackService.findUnanswered + isUnanswered -> emailService.send(digest); replyEmail + nudgeDigestEmail templates
│   ├── tables/
│   │   ├── auth.table.ts  # Better Auth tables
│   │   ├── feedback.table.ts  # pgTable feedback
│   │   ├── index.ts  # aggregates tables for drizzle-kit and the client
│   │   ├── outbox.table.ts  # pgTable outbox
│   │   └── replies.table.ts  # pgTable replies
│   ├── index.ts  # api entrypoint: env, createApp(), listen
│   └── jobs.ts  # jobs entrypoint: outboxService.runConsumer(handlers); schedule(schedules); SIGTERM drains
├── tests/
│   ├── fixtures/
│   │   └── feedback.ts  # insertFeedback rows for tests
│   ├── integration/
│   │   ├── email-bounces.controller.test.ts  # 401 bad signature; good signature marks undeliverable
│   │   ├── feedback.controller.test.ts  # treaty(createApp()): 201, 400, 429, 403
│   │   └── replies.controller.test.ts  # POST reply 201 + outbox message; 403 without staff
│   ├── mocks/
│   │   └── email.service.ts  # capturing send(); installed with mock.module('../../src/services/email.service')
│   ├── unit/
│   │   ├── outbox.service.test.ts  # consumer retry + dead-letter
│   │   └── replies.service.test.ts  # isUnanswered edge cases; nudgeUnanswered over PGlite with the email mock. No controller to mirror, so this directory is added to the surveyed layout
│   └── preload.ts  # PGlite per file, migrate, mock.module('../src/config/db')
├── .env.example  # DATABASE_URL, BETTER_AUTH_SECRET, RESEND_API_KEY, RESEND_WEBHOOK_SECRET, CORS_ORIGINS, PORT, STAFF_INBOX, NUDGE_CRON
├── bunfig.toml  # [test] preload = ["./tests/preload.ts"]
├── drizzle.config.ts  # drizzle-kit: schema = ./src/tables/index.ts, out = ./drizzle, dialect postgresql, url from DATABASE_URL
├── package.json  # name @repo/api; scripts: dev/start = src/index.ts, jobs = src/jobs.ts, test = bun test --isolate, db:generate/db:migrate via drizzle-kit
└── tsconfig.json  # extends @repo/typescript-config/library.json
```
