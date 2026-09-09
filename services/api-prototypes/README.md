# PROTOTYPE: seven candidate `services/api` trees

Throwaway. Nothing here runs, nothing here is imported, and no line of it is meant to reach `main`. It exists to answer two questions on the [Opinionated services/api architecture](https://github.com/Andrei101Alex/bun-template/issues/3) map. First, from [Four candidate services/api trees for the feedback inbox](https://github.com/Andrei101Alex/bun-template/issues/5):

> What does each candidate layering look like as a real directory listing for the same code, so the layering can be decided on what a listing shows rather than on principle?

Then, from [Candidate services/api trees drawn from the survey](https://github.com/Andrei101Alex/bun-template/issues/18), once [the survey of Bun and Elysia services](https://github.com/Andrei101Alex/bun-template/issues/17) had named the shapes real repositories use:

> What do the two or three shapes the survey found most common look like as real directory listings for the same code, beside the existing candidates?

Candidates 1 to 4 answer the first question; 5 to 7 answer the second. The survey's third shape, full clean-architecture layering, is already candidates 1 and 2, so there is no fifth copy of it. Candidates 1 and 2 stay in the table for the record; the layering decision is between 3, 4, 5, 6 and 7.

Each candidate directory holds the same code as stub files. A stub's first line names what the real file would hold. Each candidate's `README.md` carries the three traces the ticket asked for and an annotated listing of its tree.

| Candidate | Shape |
| --- | --- |
| [`1-top-level-rings/`](./1-top-level-rings/README.md) | `src/{domain,application,infrastructure,presentation}`, as a .NET solution |
| [`2-rings-per-feature/`](./2-rings-per-feature/README.md) | the same four rings repeated inside each `src/features/<name>/`, and inside `src/shared/` |
| [`3-elysia-flat-module/`](./3-elysia-flat-module/README.md) | one flat directory per feature (`routes`, `model`, `handlers`, `repository`, `table`, `emails`, `jobs`), flat `src/shared/` |
| [`4-hybrid/`](./4-hybrid/README.md) | `src/features/<name>/{http,core,data,jobs}`, `src/platform/`, `src/entrypoints/{api,jobs}` |
| [`5-colocated-module/`](./5-colocated-module/README.md) | survey shape 1 (4 repos): `src/modules/<name>/index.ts` with route, rule and query in one file, `service.ts` only once earned, no repository; `src/common/{config,db,logger,middleware}`; `src/jobs/` keyed by job; flat `tests/` |
| [`6-layer-first/`](./6-layer-first/README.md) | survey shape 2 (2 repos, both Hono): `src/{routes,controllers,services,models,tables,middlewares,config,factories,jobs}`, one file per feature per directory; `tests/integration/` mirrors `controllers/` |
| [`7-monorepo-packages/`](./7-monorepo-packages/README.md) | survey shape 4 (2 repos): `services/api` and `services/jobs` are thin shells; `packages/{db,auth,email,outbox,observability}` per concern and `packages/inbox` for the domain; the tree root stands for the repo root |

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

| | 1 top-level rings | 2 rings per feature | 3 flat module | 4 hybrid | 5 colocated module | 6 layer-first | 7 monorepo packages |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Files under `src/` + tests | 72 | 77 | 43 | 66 | 42 | 57 | 84 (whole tree) |
| Directories under `src/` | 25 | 33 | 8 | 25 | 14 | 10 | 32 (whole tree) |
| (a) files on the request path | 17 | 17 | 10 | 12 | 9 | 14 | 12 |
| (a) directories the path bounces between | 4 rings, feature name in 5 places | `features/feedback` and `shared`, 5 hops | `features/feedback` and `shared`, 2 hops | `entrypoints`, `platform`, `features/feedback`, 3 hops | `modules/feedback` and `common`, 2 hops | 8 directories, feature name in 5 places | 4 workspaces |
| (b) new files / edits | 3 / 5 | 3 / 4 | 1 / 4 | 2 / 4 | 2 / 4 | 2 / 4 | 5 / 5 + install |
| (b) placement question | ring first, then feature; four dirs touched | ring inside `shared`, ring inside feature | one flat `shared/` file, feature filename | `platform/<vendor>`, feature `core/`, feature `jobs/` | loose `common/` file, `jobs/` file; enqueue goes in `service.ts` or `index.ts` by module age | one directory per kind, none; vendor sits beside rules in `services/` | a workspace per vendor; kind union in a package the domain depends on |
| (c) nudge test needs | fakes for every port, no db | fakes, cross-feature import | PGlite + `mock.module`, rule shares file with I/O | PGlite + `mock.module`, rule in its own file | PGlite + `mock.module`, rule shares file with queries and sends | PGlite + `mock.module`, rule shares file; `tests/unit/` added since the mirror has no slot | pure test imports one file; `mock.module("@repo/email")`; preload per workspace |
| Layer visible in the path | yes, at the top | yes, inside the feature | filename only | yes, inside the feature and in `platform` | no; `index.ts` or `service.ts` | yes, at the top and in the filename | yes, as the workspace name |
| Interfaces required by the rule | yes (ports) | yes (ports) | no | no | no | no | no |
| One legal home per kind of thing | yes | yes | yes, filename | yes | no: rule and query move with module age; queries in 5 files | yes, by directory | yes, by workspace and file |
| Import direction enforced by | prose | prose | prose | prose | prose | prose | `package.json` dependencies |
| Home for cross-cutting | `infrastructure/` + `presentation/plugins/` | `shared/` with four rings | flat `shared/` | `platform/` by concern | `common/` with 4 buckets + 5 loose files | `config/`, `middlewares/`, `services/` | a workspace per concern |
| Second HTTP mount would go | `presentation/<mount>/` | new `src/<mount>.ts` | new `src/<mount>.ts` | `entrypoints/<mount>/` | new `src/<mount>.ts` | new `src/<mount>.ts` + factory | `services/<mount>/` |
| Matches a shape the survey found | rare (3 repos, pushed back on) | rare | close to shape 1 fully split, plus a repository no repo had | not seen; closest to shape 1 + `common/` buckets | shape 1, 4 repos | shape 2, 2 repos, Hono only | shape 4, 2 repos |

Counts come from the stubs, so they measure the shape, not real code. Readings the counts don't carry:

- Candidate 3's `shared/` is the only directory in any tree that a new concern can land in without a sub-decision, and also the only one that has no order once it passes a dozen files. Candidate 5's `common/` fixes half of that with four buckets and leaves five files loose.
- Candidates 1 and 2 need port interfaces to keep their ring rule honest, which the map's standing preference on injection and the .NET research both argue against.
- Candidate 5, the shape most repositories use, is the one tree that cannot fill a placement table: "split when earned" means a rule or a query has two legal homes depending on the module's age, and with no repository file, what touches a table is a grep across five files.
- Candidate 6 is the one tree whose placement table is its directory list, and the one where a feature has no directory to list or delete.
- Candidate 7 is the one tree that enforces import direction by a tool, and the one where `services/api` stops being where the architecture lives.
- Candidate 4, the hybrid, matches no surveyed shape exactly. It is candidate 5's `modules/` fully split by layer, with candidate 5's `common/` buckets extended to every concern.
