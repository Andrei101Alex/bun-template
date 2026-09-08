# Candidate 1: top-level clean-architecture rings

`src/domain`, `src/application`, `src/infrastructure`, `src/presentation`, as a .NET solution lays out its projects. Application cannot import infrastructure, so every query and vendor sits behind a port in `application/ports/`, and `presentation/composition.ts` plays the DI container by hand. Tests mirror .NET's `*.Tests` projects in a top-level `tests/` that shadows `src/`.

## (a) `POST /feedback`, entrypoint to SQL

| # | File | Role on the way |
| --- | --- | --- |
| 1 | `src/presentation/api/main.ts` | listen |
| 2 | `src/presentation/api/app.ts` | plugin chain, route mounts |
| 3 | `src/presentation/api/plugins/request-id.ts`, `logging.ts`, `rate-limit.ts` | hooks that fire first |
| 4 | `src/presentation/api/routes/feedback.ts` | schema validates, calls `submitFeedback` from composition |
| 5 | `src/presentation/composition.ts` | which use case gets which port implementations |
| 6 | `src/application/feedback/submit-feedback.ts` | the use case |
| 7 | `src/domain/feedback/feedback.ts` | `newFeedback` rule |
| 8 | `src/application/ports/unit-of-work.ts`, `feedback-repository.ts`, `outbox.ts` | the interfaces the use case sees; read to learn what the call means |
| 9 | `src/infrastructure/db/unit-of-work.ts` | the transaction |
| 10 | `src/infrastructure/repositories/feedback-repository.ts` | INSERT feedback |
| 11 | `src/infrastructure/repositories/outbox-repository.ts` | INSERT outbox |
| 12 | `src/infrastructure/db/schema/feedback.ts`, `schema/outbox.ts`, `db/client.ts` | tables and connection |

17 files, all four rings, three of them pure indirection (the ports). The word `feedback` appears in five directories: `domain/feedback`, `application/feedback`, `presentation/api/routes`, `infrastructure/repositories`, `infrastructure/db/schema`. "What does feedback do" is a search across the tree, not a directory.

## (b) New concern: Slack notification when a reply is posted

| Change | File |
| --- | --- |
| new | `src/application/ports/staff-notifier.ts` (interface) |
| new | `src/application/replies/notify-staff-of-reply.ts` (outbox handler) |
| new | `src/infrastructure/slack/slack-staff-notifier.ts` (webhook POST) |
| edit | `src/domain/outbox/message.ts` (add kind `reply.notify-staff`) |
| edit | `src/application/replies/post-reply.ts` (enqueue second message) |
| edit | `src/infrastructure/env/jobs-env.ts` (`SLACK_WEBHOOK_URL`) |
| edit | `src/presentation/composition.ts` (instantiate notifier, apply to handler) |
| edit | `src/presentation/jobs/outbox-consumer.ts` (register kind to handler) |

3 new files, 5 edits, all four rings touched. Placement is decided ring-first ("Slack is infrastructure"), then by feature inside the ring, so the rule gives one answer per file but the feature's Slack story lands in four directories.

## (c) Testing the `replies` nudge rule

- `tests/domain/replies/unanswered.test.ts` imports `src/domain/replies/unanswered.ts` and nothing else. Pure, no preload.
- `tests/application/replies/nudge-unanswered.test.ts` imports `src/application/replies/nudge-unanswered.ts` and `tests/helpers/fakes.ts`: in-memory `FeedbackRepository`, `EmailSender`, `Clock`. No database. The cost is that every port must have a fake kept in step with it.
- Finding the test of X is mechanical: replace `src/` with `tests/`.

## Listing

72 files, 25 directories under `src/`. Each file's first line says what it would hold.

```
1-top-level-rings/
├── drizzle/
│   ├── meta/
│   │   └── _journal.json  # drizzle-kit migration journal
│   └── 0000_feedback_inbox.sql  # generated migration: feedback, replies, outbox, better-auth user/session/account tables
├── src/
│   ├── application/
│   │   ├── feedback/
│   │   │   ├── list-feedback.ts  # listFeedback(deps)(): repo.list() joined with reply counts, for the staff inbox
│   │   │   ├── mark-address-undeliverable.ts  # markAddressUndeliverable(deps)(email): repo.markUndeliverable; idempotent
│   │   │   ├── send-acknowledgement.ts  # sendAcknowledgement(deps)(message): outbox handler for 'feedback.acknowledge': load feedback, emailSender.send(acknowledgementEmail(feedback))
│   │   │   └── submit-feedback.ts  # submitFeedback(deps)(input): newFeedback -> uow.run(repo.insert + outbox.enqueue('feedback.acknowledge')) -> returns Feedback
│   │   ├── ports/
│   │   │   ├── clock.ts  # interface Clock { now(): Date }; the nudge rule is time-based
│   │   │   ├── email-sender.ts  # interface EmailSender { send({ to, subject, text })
│   │   │   ├── feedback-repository.ts  # interface FeedbackRepository { insert, findById, list, markUndeliverable(email), findUnanswered(before)
│   │   │   ├── outbox.ts  # interface Outbox { enqueue(kind, payload, tx?) } and interface OutboxStore { claimBatch, markDone, markFailed, deadLetter
│   │   │   ├── reply-repository.ts  # interface ReplyRepository { insert, countFor(feedbackId), listFor(feedbackId)
│   │   │   └── unit-of-work.ts  # interface UnitOfWork { run(fn) }: one transaction wrapping insert + enqueue
│   │   ├── replies/
│   │   │   ├── deliver-reply.ts  # deliverReply(deps)(message): outbox handler for 'reply.deliver': skip if address undeliverable, else emailSender.send(replyEmail(...))
│   │   │   ├── nudge-unanswered.ts  # nudgeUnanswered(deps)(): feedbackRepo.findUnanswered(clock.now() - 48h) filtered by isUnanswered -> one digest email to STAFF_INBOX via emailSender
│   │   │   └── post-reply.ts  # postReply(deps)(feedbackId, authorId, body): notFound if no feedback -> newReply -> uow.run(insert + enqueue('reply.deliver'))
│   │   └── webhooks/
│   │       └── record-email-bounce.ts  # recordEmailBounce(deps)(event): maps a verified bounce event to markAddressUndeliverable(event.to)
│   ├── domain/
│   │   ├── feedback/
│   │   │   ├── acknowledgement.ts  # acknowledgementEmail(feedback): subject + text for the confirmation sent to the submitter
│   │   │   └── feedback.ts  # Feedback type (id, email, message, emailStatus: 'deliverable'|'undeliverable', createdAt); newFeedback(email, message) trims and rejects blank messages
│   │   ├── outbox/
│   │   │   └── message.ts  # OutboxMessage type and the MessageKind union ('feedback.acknowledge'|'reply.deliver'); attempts, availableAt, deadLetteredAt
│   │   ├── replies/
│   │   │   ├── reply-email.ts  # replyEmail(feedback, reply): subject + text sent to the original submitter
│   │   │   ├── reply.ts  # Reply type (id, feedbackId, authorId, body, createdAt); newReply() rejects blank bodies
│   │   │   └── unanswered.ts  # isUnanswered(feedback, replyCount, now, threshold = 48h): deliverable address, no replies, older than threshold. Pure
│   │   └── errors.ts  # DomainError + ErrorCode ('invalid_input'|'not_found'|'forbidden'|'conflict'|'rate_limited') and the invalidInput()/notFound()/... constructors; no HTTP knowledge
│   ├── infrastructure/
│   │   ├── auth/
│   │   │   └── better-auth.ts  # betterAuth({ database: drizzleAdapter(db), user: { additionalFields: { role } } }); exported auth instance
│   │   ├── clock/
│   │   │   └── system-clock.ts  # implements Clock with new Date()
│   │   ├── db/
│   │   │   ├── schema/
│   │   │   │   ├── auth.ts  # Better Auth tables (user with role column, session, account, verification) via the drizzle adapter
│   │   │   │   ├── feedback.ts  # pgTable feedback: id uuid pk, email text, message text, email_status text, created_at timestamptz
│   │   │   │   ├── index.ts  # re-exports every table so drizzle.config and the client see one schema
│   │   │   │   ├── outbox.ts  # pgTable outbox: id, kind, payload jsonb, attempts, available_at, done_at, dead_lettered_at, last_error
│   │   │   │   └── replies.ts  # pgTable replies: id, feedback_id fk, author_id fk -> user, body, created_at
│   │   │   ├── client.ts  # drizzle(postgres(env.databaseUrl), { schema }); exported db singleton
│   │   │   ├── migrate.ts  # migrate(db, { migrationsFolder: './drizzle' }); run by bun run db:migrate and by the test preload
│   │   │   └── unit-of-work.ts  # implements UnitOfWork with db.transaction; passes tx to repositories
│   │   ├── email/
│   │   │   ├── resend-email-sender.ts  # implements EmailSender with the Resend SDK; from address from env
│   │   │   └── resend-webhook-signature.ts  # verifyResendSignature(rawBody, headers, secret): Svix-style HMAC check; throws forbidden on mismatch
│   │   ├── env/
│   │   │   ├── api-env.ts  # typed env for the api process: PORT, DATABASE_URL, BETTER_AUTH_SECRET, RESEND_API_KEY, RESEND_WEBHOOK_SECRET, CORS_ORIGINS; parsed once, fails at boot
│   │   │   └── jobs-env.ts  # typed env for the jobs process: DATABASE_URL, RESEND_API_KEY, STAFF_INBOX, OUTBOX_BATCH_SIZE, NUDGE_CRON
│   │   ├── error-reporting/
│   │   │   └── reporter.ts  # reportError(error, context): console in dev, Sentry-shaped hook in prod; no-op if DSN unset
│   │   ├── logging/
│   │   │   └── logger.ts  # pino-style structured logger; child(requestId) per request
│   │   └── repositories/
│   │       ├── feedback-repository.ts  # implements FeedbackRepository with drizzle queries on schema.feedback (+ reply count subquery); maps rows to Feedback
│   │       ├── outbox-repository.ts  # implements Outbox + OutboxStore: insert, SELECT ... FOR UPDATE SKIP LOCKED claim, backoff on failure, dead-letter after 5 attempts
│   │       └── reply-repository.ts  # implements ReplyRepository with drizzle queries on schema.replies
│   └── presentation/
│       ├── api/
│       │   ├── plugins/
│       │   │   ├── error-mapping.ts  # onError global: DomainError.code -> status; everything else 500 with generic body
│       │   │   ├── error-reporting.ts  # onError global: forwards non-Domain errors to infrastructure reporter with requestId
│       │   │   ├── logging.ts  # onRequest/onAfterResponse: method, path, status, duration under requestId
│       │   │   ├── rate-limit.ts  # rateLimit({ max, windowMs }) keyed by ip; in-memory store, throws DomainError('rate_limited')
│       │   │   ├── request-id.ts  # derive: X-Request-Id header or crypto.randomUUID(); set on response
│       │   │   └── staff-guard.ts  # staffGuard: resolves session via auth.api.getSession(headers), throws forbidden unless user.role === 'staff'; exposes user in context
│       │   ├── routes/
│       │   │   ├── auth.ts  # mounts Better Auth handler at /auth/*
│       │   │   ├── feedback.ts  # POST /feedback (rateLimit) -> submitFeedback; GET /feedback (staffGuard) -> listFeedback. t.Object schemas inline
│       │   │   ├── health.ts  # GET /health: SELECT 1 through db; { status, db, uptime
│       │   │   ├── replies.ts  # POST /feedback/:id/replies (staffGuard) -> postReply; GET /feedback/:id/replies (staffGuard)
│       │   │   └── webhooks.ts  # POST /webhooks/email: raw body, verifyResendSignature, then recordEmailBounce; always 200 once verified
│       │   ├── app.ts  # buildApp(): new Elysia().use(requestId).use(logging).use(errorMapping).use(errorReporting).use(auth).use(health).use(feedbackRoutes).use(replyRoutes).use(webhookRoutes)
│       │   └── main.ts  # api entrypoint: apiEnv, buildApp().listen(env.port); export type App
│       ├── jobs/
│       │   ├── main.ts  # jobs entrypoint: jobsEnv, migrate check, start outbox consumer loop + schedules; SIGTERM drains
│       │   ├── outbox-consumer.ts  # loop: outboxStore.claimBatch -> handlers[kind](message) -> markDone | markFailed; handlers map built from composition
│       │   └── schedules.ts  # cron table: NUDGE_CRON -> nudgeUnanswered(); each run logged with a job id
│       └── composition.ts  # composition root: instantiates repositories, sender, clock, uow and partially applies every use case (submitFeedback = submitFeedbackUseCase({ feedbackRepo, outbox, uow })). The DI container, by hand
├── tests/
│   ├── application/
│   │   ├── feedback/
│   │   │   └── submit-feedback.test.ts  # submitFeedback with fakes: inserts + enqueues in one uow.run
│   │   └── replies/
│   │       └── nudge-unanswered.test.ts  # nudgeUnanswered with fakes: one digest, none when nothing unanswered
│   ├── domain/
│   │   └── replies/
│   │       └── unanswered.test.ts  # isUnanswered: threshold edge, undeliverable address excluded, replied excluded
│   ├── helpers/
│   │   └── fakes.ts  # in-memory FeedbackRepository, ReplyRepository, EmailSender, Clock implementing the application ports
│   ├── infrastructure/
│   │   └── repositories/
│   │       └── feedback-repository.test.ts  # real drizzle on PGlite: findUnanswered query shape
│   ├── presentation/
│   │   ├── api/
│   │   │   └── feedback.test.ts  # treaty(buildApp()): POST /feedback 201, rate limit 429, GET without session 403
│   │   └── jobs/
│   │       └── outbox-consumer.test.ts  # consumer: retries with backoff, dead-letters after 5
│   └── preload.ts  # fresh PGlite per file, migrate, rebind db client
├── .env.example  # DATABASE_URL, BETTER_AUTH_SECRET, RESEND_API_KEY, RESEND_WEBHOOK_SECRET, CORS_ORIGINS, PORT
├── bunfig.toml  # [test] preload = ["./tests/preload.ts"] where the candidate has one
├── drizzle.config.ts  # drizzle-kit: schema path (see candidate), out = ./drizzle, dialect postgresql, url from DATABASE_URL
├── package.json  # name @repo/api; scripts: dev/start for the api entrypoint, jobs for the jobs entrypoint, test = bun test, db:generate/db:migrate via drizzle-kit
└── tsconfig.json  # extends @repo/typescript-config/library.json
```
