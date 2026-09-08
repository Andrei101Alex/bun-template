# PROTOTYPE: four candidate `services/api` trees

Throwaway. Nothing here runs, nothing here is imported, and no line of it is meant to reach `main`. It exists to answer one question for [Four candidate services/api trees for the feedback inbox](https://github.com/Andrei101Alex/bun-template/issues/5), a ticket on the [Opinionated services/api architecture](https://github.com/Andrei101Alex/bun-template/issues/3) map:

> What does each candidate layering look like as a real directory listing for the same code, so the layering can be decided on what a listing shows rather than on principle?

Each candidate directory holds the same code as stub files. A stub's first line names what the real file would hold. Each candidate's `README.md` carries the three traces the ticket asked for and an annotated listing of its tree.

| Candidate | Shape |
| --- | --- |
| [`1-top-level-rings/`](./1-top-level-rings/README.md) | `src/{domain,application,infrastructure,presentation}`, as a .NET solution |
| [`2-rings-per-feature/`](./2-rings-per-feature/README.md) | the same four rings repeated inside each `src/features/<name>/`, and inside `src/shared/` |
| [`3-elysia-flat-module/`](./3-elysia-flat-module/README.md) | one flat directory per feature (`routes`, `model`, `handlers`, `repository`, `table`, `emails`, `jobs`), flat `src/shared/` |
| [`4-hybrid/`](./4-hybrid/README.md) | `src/features/<name>/{http,core,data,jobs}`, `src/platform/`, `src/entrypoints/{api,jobs}` |

## The code every tree holds

The customer feedback inbox from the map, plus every cross-cutting concern in the production skeleton.

**Features**

- `feedback`: public `POST /feedback` behind a rate limit, the `feedback` table, an acknowledgement email sent through the outbox, staff `GET /feedback`, and `markAddressUndeliverable` for the bounce webhook to call.
- `replies`: staff `POST /feedback/:id/replies`, the `replies` table, the reply delivered to the submitter through the outbox and the email port, the pure `isUnanswered` rule (deliverable address, no replies, older than 48h), and a scheduled nudge job emailing staff a digest.
- `email-bounces`: the email provider's bounce webhook, signature-verified, mapped to `markAddressUndeliverable`.

**Cross-cutting**

Drizzle client, schema aggregate, programmatic migrate, `drizzle.config.ts` and a `drizzle/` migrations folder. Better Auth instance with a `role` field, mounted at `/auth/*`, and a `staffGuard`. Outbox table, `enqueue`, and a consumer with claim, retry, backoff and dead-letter. Rate limit plugin. Request id and request logging. Error mapping (`DomainError` to status) and an error-reporting hook. Health check probing the database. Email port with a Resend implementation and webhook signature verification. Typed env per entrypoint. Tests, with a PGlite preload.

## The three traces

Each candidate README works the same three questions so the answers line up:

- **(a)** the files a `POST /feedback` request passes through from entrypoint to SQL
- **(b)** where a brand-new concern lands: an outbound Slack notification when a reply is posted
- **(c)** how a test of `replies`' nudge rule imports what it needs

## Side by side

| | 1 top-level rings | 2 rings per feature | 3 flat module | 4 hybrid |
| --- | --- | --- | --- | --- |
| Files under `src/` + tests | 72 | 77 | 43 | 66 |
| Directories under `src/` | 25 | 33 | 8 | 25 |
| (a) files on the request path | 17 | 17 | 10 | 12 |
| (a) directories the path bounces between | 4 rings, feature name in 5 places | `features/feedback` and `shared`, 5 hops | `features/feedback` and `shared`, 2 hops | `entrypoints`, `platform`, `features/feedback`, 3 hops |
| (b) new files / edits | 3 / 5 | 3 / 4 | 1 / 4 | 2 / 4 |
| (b) placement question | ring first, then feature; four dirs touched | ring inside `shared`, ring inside feature | one flat `shared/` file, feature filename | `platform/<vendor>`, feature `core/`, feature `jobs/` |
| (c) nudge test needs | fakes for every port, no db | fakes, cross-feature import | PGlite + `mock.module`, rule shares file with I/O | PGlite + `mock.module`, rule in its own file |
| Layer visible in the path | yes, at the top | yes, inside the feature | filename only | yes, inside the feature and in `platform` |
| Interfaces required by the rule | yes (ports) | yes (ports) | no | no |
| Home for cross-cutting | `infrastructure/` + `presentation/plugins/` | `shared/` with four rings | flat `shared/` | `platform/` by concern |
| Second HTTP mount would go | `presentation/<mount>/` | new `src/<mount>.ts` | new `src/<mount>.ts` | `entrypoints/<mount>/` |

Counts come from the stubs, so they measure the shape, not real code. Two readings the counts don't carry: candidate 3's `shared/` is the only directory in any tree that a new concern can land in without a sub-decision, and also the only one that has no order once it passes a dozen files; candidates 1 and 2 need port interfaces to keep their ring rule honest, which the map's standing preference on injection and the .NET research both argue against.
