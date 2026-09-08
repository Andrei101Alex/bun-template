# Candidate 2: rings per feature

`src/features/<name>/{domain,application,infrastructure,presentation}/` plus an `index.ts` per feature that does that feature's composition. Cross-cutting code needs a home too, and the only honest one under this rule is `src/shared/` with its own four rings. Tests sit beside the file they cover, inside the ring.

## (a) `POST /feedback`, entrypoint to SQL

| # | File | Role on the way |
| --- | --- | --- |
| 1 | `src/api.ts` | listen, mounts platform plugins and each feature's `index.ts` |
| 2 | `src/shared/presentation/plugins/request-id.ts`, `logging.ts`, `rate-limit.ts` | hooks |
| 3 | `src/features/feedback/index.ts` | composition for this feature |
| 4 | `src/features/feedback/presentation/routes.ts`, `schemas.ts` | schema validates, calls the wired use case |
| 5 | `src/features/feedback/application/submit-feedback.ts` | the use case |
| 6 | `src/features/feedback/domain/feedback.ts` | `newFeedback` rule |
| 7 | `src/features/feedback/application/ports.ts`, `src/shared/application/ports/outbox.ts`, `unit-of-work.ts` | interfaces |
| 8 | `src/shared/infrastructure/db/unit-of-work.ts` | transaction |
| 9 | `src/features/feedback/infrastructure/feedback-repository.ts`, `schema.ts` | INSERT feedback |
| 10 | `src/shared/infrastructure/outbox/outbox-repository.ts`, `schema.ts`, `src/shared/infrastructure/db/client.ts` | INSERT outbox, connection |

17 files. Everything named feedback is under one directory, but that directory has four subdirectories and an `index.ts`, and the path bounces between `features/feedback/...` and `shared/...` five times.

## (b) New concern: Slack notification when a reply is posted

| Change | File |
| --- | --- |
| new | `src/shared/application/ports/staff-notifier.ts` |
| new | `src/shared/infrastructure/slack/slack-staff-notifier.ts` |
| new | `src/features/replies/application/notify-staff-of-reply.ts` |
| edit | `src/shared/domain/outbox-message.ts` (add kind) |
| edit | `src/shared/infrastructure/env/jobs-env.ts` (`SLACK_WEBHOOK_URL`) |
| edit | `src/features/replies/application/post-reply.ts` (enqueue) |
| edit | `src/features/replies/index.ts` (wire notifier, export handler) |

3 new, 4 edits. The feature side is two files in `replies/`. The vendor side asks the ring question twice: which ring inside `shared/` for the port, which for the adapter. Every cross-cutting concern pays that double question.

## (c) Testing the `replies` nudge rule

- `src/features/replies/domain/unanswered.test.ts` imports `./unanswered`. Pure.
- `src/features/replies/application/nudge-unanswered.test.ts` imports `./nudge-unanswered` and `../../../../tests/helpers/fakes.ts`. The fakes implement `feedback`'s port from inside `replies`' test, a cross-feature import the test needs and the code does not.
- Colocated, so the test is next to its subject, but five levels deep.

## Listing

77 files, 33 directories under `src/`. Each file's first line says what it would hold.

```
2-rings-per-feature/
├── drizzle/
│   ├── meta/
│   │   └── _journal.json  # drizzle-kit migration journal
│   └── 0000_feedback_inbox.sql  # generated migration: feedback, replies, outbox, better-auth user/session/account tables
├── src/
│   ├── features/
│   │   ├── email-bounces/
│   │   │   ├── application/
│   │   │   │   └── record-bounce.ts  # recordBounce(deps)(event) -> feedback.markAddressUndeliverable
│   │   │   ├── domain/
│   │   │   │   └── bounce.ts  # BounceEvent type (to, reason, at); fromProviderPayload()
│   │   │   ├── infrastructure/
│   │   │   │   └── resend-signature.ts  # verifyResendSignature(rawBody, headers, secret)
│   │   │   ├── presentation/
│   │   │   │   └── routes.ts  # POST /webhooks/email: verify, map, recordBounce
│   │   │   └── index.ts  # feature composition; exports { routes
│   │   ├── feedback/
│   │   │   ├── application/
│   │   │   │   ├── find-unanswered.ts  # findUnanswered(deps)(before): exported for the replies feature's nudge
│   │   │   │   ├── list-feedback.ts  # listFeedback(deps)(): inbox listing with reply counts
│   │   │   │   ├── mark-address-undeliverable.ts  # markAddressUndeliverable(deps)(email); exported for the email-bounces feature
│   │   │   │   ├── ports.ts  # FeedbackRepository interface (insert, findById, list, markUndeliverable, findUnanswered)
│   │   │   │   ├── send-acknowledgement.ts  # outbox handler 'feedback.acknowledge' -> emailSender.send(acknowledgementEmail)
│   │   │   │   ├── submit-feedback.test.ts  # submitFeedback with a fake repository + fake outbox
│   │   │   │   └── submit-feedback.ts  # submitFeedback(deps)(input): newFeedback -> uow.run(insert + outbox.enqueue('feedback.acknowledge'))
│   │   │   ├── domain/
│   │   │   │   ├── acknowledgement.ts  # acknowledgementEmail(feedback): subject + text
│   │   │   │   ├── errors.ts  # feedbackNotFound(id) built on shared DomainError
│   │   │   │   └── feedback.ts  # Feedback type; newFeedback(email, message) trims, rejects blank
│   │   │   ├── infrastructure/
│   │   │   │   ├── feedback-repository.ts  # drizzle implementation of FeedbackRepository
│   │   │   │   └── schema.ts  # pgTable feedback
│   │   │   ├── presentation/
│   │   │   │   ├── routes.test.ts  # treaty(app) over PGlite: 201, 429, 403
│   │   │   │   ├── routes.ts  # POST /feedback (rateLimit) -> submitFeedback; GET /feedback (staffGuard) -> listFeedback
│   │   │   │   └── schemas.ts  # t.Object request/response models for the feedback routes
│   │   │   └── index.ts  # feature composition: wires infrastructure into application, exports { routes, outboxHandlers, schedules
│   │   └── replies/
│   │       ├── application/
│   │       │   ├── deliver-reply.ts  # outbox handler 'reply.deliver': skip undeliverable, send replyEmail
│   │       │   ├── nudge-unanswered.test.ts  # nudgeUnanswered with fakes
│   │       │   ├── nudge-unanswered.ts  # nudgeUnanswered(deps)(): feedback.findUnanswered + isUnanswered -> staff digest
│   │       │   ├── ports.ts  # ReplyRepository interface (insert, countFor, listFor)
│   │       │   └── post-reply.ts  # postReply(deps)(feedbackId, authorId, body): feedback.findById via feedback's use case -> insert + enqueue('reply.deliver')
│   │       ├── domain/
│   │       │   ├── reply-email.ts  # replyEmail(feedback, reply)
│   │       │   ├── reply.ts  # Reply type; newReply rejects blank
│   │       │   ├── unanswered.test.ts  # isUnanswered edge cases
│   │       │   └── unanswered.ts  # isUnanswered(feedback, replyCount, now, threshold): pure rule
│   │       ├── infrastructure/
│   │       │   ├── reply-repository.ts  # drizzle implementation of ReplyRepository
│   │       │   └── schema.ts  # pgTable replies
│   │       ├── presentation/
│   │       │   ├── routes.ts  # POST/GET /feedback/:id/replies (staffGuard)
│   │       │   ├── schedules.ts  # NUDGE_CRON -> nudgeUnanswered
│   │       │   └── schemas.ts  # t.Object models for replies
│   │       └── index.ts  # feature composition: wires infrastructure + feedback's exported use cases; exports { routes, outboxHandlers, schedules
│   ├── shared/
│   │   ├── application/
│   │   │   └── ports/
│   │   │       ├── clock.ts  # Clock interface
│   │   │       ├── email-sender.ts  # EmailSender interface
│   │   │       ├── outbox.ts  # Outbox + OutboxStore interfaces
│   │   │       └── unit-of-work.ts  # UnitOfWork interface
│   │   ├── domain/
│   │   │   ├── errors.ts  # DomainError + codes + constructors
│   │   │   └── outbox-message.ts  # OutboxMessage + MessageKind union
│   │   ├── infrastructure/
│   │   │   ├── auth/
│   │   │   │   ├── better-auth.ts  # auth instance + drizzle adapter + role field
│   │   │   │   └── schema.ts  # Better Auth tables
│   │   │   ├── clock/
│   │   │   │   └── system-clock.ts  # SystemClock
│   │   │   ├── db/
│   │   │   │   ├── client.ts  # drizzle client singleton
│   │   │   │   ├── migrate.ts  # programmatic migrate
│   │   │   │   ├── schema.ts  # aggregates every feature's infrastructure/schema.ts + outbox + auth tables for drizzle-kit
│   │   │   │   └── unit-of-work.ts  # db.transaction UnitOfWork
│   │   │   ├── email/
│   │   │   │   └── resend-email-sender.ts  # Resend EmailSender
│   │   │   ├── env/
│   │   │   │   ├── api-env.ts  # typed api env
│   │   │   │   └── jobs-env.ts  # typed jobs env
│   │   │   ├── error-reporting/
│   │   │   │   └── reporter.ts  # reportError hook
│   │   │   ├── logging/
│   │   │   │   └── logger.ts  # structured logger
│   │   │   └── outbox/
│   │   │       ├── consumer.test.ts  # retry + dead-letter
│   │   │       ├── consumer.ts  # consumer loop taking a handlers map
│   │   │       ├── outbox-repository.ts  # Outbox + OutboxStore on drizzle: SKIP LOCKED claim, backoff, dead-letter
│   │   │       └── schema.ts  # pgTable outbox
│   │   └── presentation/
│   │       ├── plugins/
│   │       │   ├── error-mapping.ts  # DomainError -> status
│   │       │   ├── error-reporting.ts  # onError -> reporter
│   │       │   ├── logging.ts  # request logging plugin
│   │       │   ├── rate-limit.ts  # rateLimit plugin
│   │       │   ├── request-id.ts  # request id plugin
│   │       │   └── staff-guard.ts  # staffGuard plugin
│   │       └── routes/
│   │           ├── auth.ts  # mount Better Auth at /auth/*
│   │           └── health.ts  # GET /health probing db
│   ├── api.ts  # api entrypoint: apiEnv, new Elysia().use(platform plugins).use(feedbackModule).use(repliesModule).use(emailBouncesModule).listen(); export type App
│   └── jobs.ts  # jobs entrypoint: jobsEnv, outbox consumer with handlers collected from each feature's index, schedules from each feature's index
├── tests/
│   ├── helpers/
│   │   └── fakes.ts  # in-memory port fakes shared by feature tests
│   └── preload.ts  # PGlite per file + migrate
├── .env.example  # DATABASE_URL, BETTER_AUTH_SECRET, RESEND_API_KEY, RESEND_WEBHOOK_SECRET, CORS_ORIGINS, PORT
├── bunfig.toml  # [test] preload = ["./tests/preload.ts"] where the candidate has one
├── drizzle.config.ts  # drizzle-kit: schema path (see candidate), out = ./drizzle, dialect postgresql, url from DATABASE_URL
├── package.json  # name @repo/api; scripts: dev/start for the api entrypoint, jobs for the jobs entrypoint, test = bun test, db:generate/db:migrate via drizzle-kit
└── tsconfig.json  # extends @repo/typescript-config/library.json
```
