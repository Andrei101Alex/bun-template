# How bun test discovers, preloads and isolates tests

Research for issue #4 (wayfinder map #3), deciding a test layout for `services/api`.

## Short answer

- Discovery: recurses from cwd, matches `*.test.*`/`*_test.*`/`*.spec.*`/`*_spec.*` (js/jsx/ts/tsx/mjs/cjs/mts/cts), skips `node_modules` and dot-dirs. No special meaning for `__tests__/` - confirmed by experiment, a bare `.ts` file inside `__tests__/` is not picked up.
- Monorepo: `bun test` from repo root recurses into every workspace package (confirmed by experiment) - no `--filter` needed to include all packages, but `--filter @repo/api` (or running from that dir) narrows to one.
- Config: `bunfig.toml` is read from cwd, not repo root. A `services/api/bunfig.toml` is honored only when bun test runs with that directory as cwd - true both for `cd services/api && bun test` and for `bun run --filter @repo/api test` (confirmed by experiment). Running `bun test` from repo root ignores package-level bunfig.toml entirely.
- Isolation: default is one process, one shared global, sequential files - a `mock.module()` call in one file leaks into the next file (confirmed by experiment). `--isolate` resets globals/module registry per file, re-running `--preload` scripts each time; `--parallel` spreads files over worker processes and implies `--isolate`.
- A `beforeAll`/preload script's own top-level code runs once per whole run by default, once per file under `--isolate`/`--parallel` (confirmed by experiment).
- PGlite instantiates fast enough that per-test-file (or even per-test) instances are the documented recommendation, not a shared singleton.
- Drizzle ships `drizzle-orm/pglite/migrator` so a generated `drizzle/` folder can be applied programmatically before tests run.
- Elysia's `app.handle(new Request(...))` and Eden's `treaty(app)` both work against the in-memory `app` instance with no `.listen()`; treaty additionally needs the `App` type for compile-time typing of the calls.

## 1. Discovery

| Fact | Detail | Source |
|---|---|---|
| Default extensions | `*.test.{js,jsx,ts,tsx,mjs,cjs,mts,cts}`, `*_test.{...}`, `*.spec.{...}`, `*_spec.{...}` | [bun.com/docs/test/discovery](https://bun.com/docs/test/discovery) |
| Exclusions | ignores `node_modules`, hidden (dot) directories, and non-JS-like extensions | [bun.com/docs/test/discovery](https://bun.com/docs/test/discovery) |
| `__tests__/` | not mentioned anywhere in the discovery docs as a special directory | [bun.com/docs/test/discovery](https://bun.com/docs/test/discovery) - confirmed empirically: a file `packages/b/__tests__/bare.ts` (no `.test`/`.spec` suffix) was not run in a `bun test` pass that found the other 2 matching files |
| Path/name filter | positional args are **substring** matches against file paths, not globs; `./` or `/` prefix forces an exact path match | [bun.com/docs/test/discovery](https://bun.com/docs/test/discovery) |
| `--test-name-pattern` | regex match against "the test name prefixed with the labels of all its parent `describe` blocks, separated by spaces" | [bun.com/docs/test/discovery](https://bun.com/docs/test/discovery) |
| `root` bunfig key | `[test] root = "src"` restricts the scan starting point | [bun.com/docs/runtime/bunfig](https://bun.com/docs/runtime/bunfig) |
| Monorepo recursion | not documented anywhere in Bun's docs | discovery, writing and bunfig pages are all silent on workspaces |

Experiment (in `/private/tmp/bun-exp`, a scratch Bun workspace with `packages/a` and `packages/b`, outside this repo): `bun test` run from the workspace root picked up both `packages/a/foo.test.ts` and `packages/b/foo.spec.ts` (2 files, no `--filter`), and did not pick up `packages/b/__tests__/bare.ts`. So a root-level `bun test` **does** recurse into every package under `apps/*`, `services/*`, `packages/*` on its own; `bun run --filter @repo/api test` instead narrows the cwd to that one package before bun test runs there (see Configuration below), so it only sees that package's files, plus whatever root-level `preload`/`bunfig.toml` is in scope for that cwd.

## 2. Configuration

`[test]` keys documented in [bun.com/docs/runtime/bunfig](https://bun.com/docs/runtime/bunfig) (some cross-checked against [bun.com/docs/test/coverage](https://bun.com/docs/test/coverage)):

| Key | Default | Meaning |
|---|---|---|
| `root` | `.` | starting directory for the test scan |
| `preload` | none | scripts to run before any test file (test-only variant of the top-level `preload`) |
| `pathIgnorePatterns` | none | glob(s) excluded from discovery |
| `smol` | none | test-only variant of top-level `smol` |
| `coverage` | `false` | always enable coverage |
| `coverageThreshold` | none | number (0-1) or `{ lines, functions, ... }` object |
| `coverageSkipTestFiles` | docs conflict: bunfig page says default `false`, coverage page says default `true` - unresolved, flagged in Open Questions | |
| `coverageIgnoreSourcemaps` | `false` | report against transpiled output instead of source |
| `coveragePathIgnorePatterns` | none | glob(s) excluded from coverage |
| `coverageReporter` | `["text"]` | `"text"` and/or `"lcov"` |
| `coverageDir` | `"coverage"` | output directory |
| `randomize` | `false` | randomize test order |
| `seed` | none | seed for `randomize` |
| `rerunEach` | `0` | re-run each file N extra times |
| `retry` | `0` | default per-test retry count |
| `concurrentTestGlob` | none | files matching this glob run all their tests concurrently |
| `onlyFailures` | `false` | only print failed tests |
| `reporter` | - | `dots`/`junit` sub-config |

Source: [bun.com/docs/runtime/bunfig](https://bun.com/docs/runtime/bunfig).

**bunfig.toml resolution (docs silent, confirmed by experiment).** The docs state only that a project-level `bunfig.toml` belongs "in your project root, alongside your `package.json`" and that `bun run` "only loads the local project's `bunfig.toml`" ([bun.com/docs/runtime/bunfig](https://bun.com/docs/runtime/bunfig)) - "local" is not defined further (cwd vs workspace root) and workspaces are not discussed at all.

Experiment: put `packages/a/bunfig.toml` with `[test] preload = "./setup.ts"` (setup.ts just logs a line):
- `cd packages/a && bun test` -> preload ran (log line printed once).
- `bun test` from the workspace root -> preload did **not** run, no log line, package-level `bunfig.toml` was silently ignored.
- `bun run --filter pkg-a test` from the workspace root (script = `"test": "bun test"`) -> preload **did** run, because `--filter` changes the process cwd to the package directory before running its script, so the package's own `bunfig.toml` is then "local" to that invocation.

Conclusion for this repo: a `services/api/bunfig.toml` with `[test] preload = "./test/setup.ts"` is honored by both `bun run --filter @repo/api test` and by anyone running `bun test` directly from inside `services/api/`, and is invisible to a plain `bun test` run from the repo root or from any other workspace. That is exactly "one preload file per package, without leaking into other workspaces" - no extra wiring needed beyond putting the `bunfig.toml` in the package directory.

## 3. Isolation

| Fact | Detail | Source |
|---|---|---|
| Default process model | "the test runner runs all tests in a single process: it loads all `--preload` scripts... then runs every file in one shared global" | [bun.com/docs/test](https://bun.com/docs/test) |
| Default file order | sequential, in one process, one shared module registry - "fine for suites whose files don't leak state into each other" | [bun.com/docs/test/parallel](https://bun.com/docs/test/parallel) |
| `--isolate` | fresh `globalThis` per file in the same process; clears ESM+CJS module registries; closes sockets/servers/watchers/subprocesses, cancels timers, restores fake timers; re-runs `--preload` scripts in the new global each time; keeps a process-level transpiled-source/bytecode cache so re-imported shared deps aren't re-parsed | [bun.com/docs/test/parallel](https://bun.com/docs/test/parallel) |
| `--parallel[=N]` | distributes files across up to N worker processes (default = CPU count); implies `--isolate` (opt out with `--parallel --no-isolate`); each worker gets `BUN_TEST_WORKER_ID` (1-based); output is buffered/flushed atomically so it reads like serial output | [bun.com/docs/test/parallel](https://bun.com/docs/test/parallel) |
| Preload hooks under `--parallel` | preload-level `beforeAll`/`afterAll` wrap every file in every worker, "because a worker never knows which file is its last" | [bun.com/docs/test/parallel](https://bun.com/docs/test/parallel) |
| `test.concurrent` / `concurrentTestGlob` | concurrency is cooperative within one thread/global (I/O overlap), not extra CPU parallelism | [bun.com/docs/test/parallel](https://bun.com/docs/test/parallel) |
| `mock.restore()` | resets mock functions, but explicitly "does not reset modules overridden with `mock.module()`" | [bun.com/docs/test/mocks](https://bun.com/docs/test/mocks) |
| Cross-file mock scope | not stated directly in the mocks page | [bun.com/docs/test/mocks](https://bun.com/docs/test/mocks) - resolved by experiment below |

**Experiment** (`/private/tmp/bun-exp/packages/a`, `first.test.ts` calls `mock.module("./modA", ...)` and imports it; `second.test.ts` only imports `./modA` and asserts on the return value):
- Default (`bun test`, no flags): both files pass - `second.test.ts` sees the value `first.test.ts` mocked (`"mocked"`), i.e. `mock.module()` leaks across files in the default single-process mode, with no reset needed to see it, and no built-in way shown in the docs to reset it "in your test preload script, instead of repeating cleanup in every test" (per [bun.com/docs/test/mocks](https://bun.com/docs/test/mocks) guidance to call `mock.restore()` in an `afterEach` or preload - which per the same page does not undo `mock.module`).
- `bun test --isolate`: the preload script's log line printed once per file (twice total), confirming preload reruns per file under `--isolate`; `second.test.ts` then saw the *real* (unmocked) `modA`, so `--isolate`'s module-registry reset does clear `mock.module()` overrides between files, and the test that depended on the previous file's mock now fails.
- Default mode, no `--isolate`: the preload script's log line printed once for the whole run (only before `first.test.ts`), confirming a preload script's own top-level code, and thus any `beforeAll` registered globally within it, executes once per run by default - `--isolate`/`--parallel` are what turn that into once-per-file.

Practical read for `services/api`: with no isolation flags, tests must not depend on `mock.module()` state from another file, and any file that mocks a module the way another file needs unmocked will interfere - `--isolate` (or writing tests that don't use `mock.module` across files) is the fix, not "reset in afterEach", since resets don't touch `mock.module`.

## 4. Databases in tests

| Fact | Detail | Source |
|---|---|---|
| PGlite startup cost | "PGlite is very fast to start and tear down. It's perfect for unit tests - you can have a unique fresh Postgres for each test." | [pglite.dev/docs/about](https://pglite.dev/docs/about) |
| Storage modes | ephemeral in-memory by default, or persisted to filesystem (Node/Bun) or IndexedDB (browser); no VM, "simply Postgres in WASM" | [pglite.dev/docs/about](https://pglite.dev/docs/about) |
| Drizzle + PGlite wiring | `import { PGlite } from '@electric-sql/pglite'; import { drizzle } from 'drizzle-orm/pglite'; const client = new PGlite(); const db = drizzle({ client })` | [orm.drizzle.team/docs/connect-pglite](https://orm.drizzle.team/docs/connect-pglite) |
| Programmatic migration | `drizzle-orm/pglite/migrator` exports `migrate<TSchema>(db: PgliteDatabase<TSchema>, config: MigrationConfig)`, mirroring the documented `drizzle-orm/node-postgres/migrator` pattern | source: `drizzle-orm/src/pglite/migrator.ts` at [raw.githubusercontent.com/drizzle-team/drizzle-orm/main/drizzle-orm/src/pglite/migrator.ts](https://raw.githubusercontent.com/drizzle-team/drizzle-orm/main/drizzle-orm/src/pglite/migrator.ts); generic `migrate()` documented at [orm.drizzle.team/docs/migrations](https://orm.drizzle.team/docs/migrations) |
| `MigrationConfig` shape | `{ migrationsFolder: string; migrationsTable?: string; migrationsSchema?: string }` | source: `drizzle-orm/src/migrator.ts` at [raw.githubusercontent.com/drizzle-team/drizzle-orm/main/drizzle-orm/src/migrator.ts](https://raw.githubusercontent.com/drizzle-team/drizzle-orm/main/drizzle-orm/src/migrator.ts) |

So a Drizzle-generated `drizzle/` folder (from `drizzle-kit generate`) can be applied to a fresh PGlite instance with `await migrate(db, { migrationsFolder: "./drizzle" })` before tests run, with no CLI step.

**Cost tradeoff, per docs + inference** (Bun/Drizzle/PGlite docs give no benchmark numbers, so this is inference from the "fast to start, perfect for a fresh Postgres per test" framing, not a measured number):
- Once per whole run (module-level singleton, shared across files): cheapest, but only safe with Bun's default single-process/shared-global mode - under `--isolate`/`--parallel` a module-level singleton re-initializes per file/worker anyway since the module registry resets, so "once per run" only holds without those flags, and cross-test data must be cleaned up between tests (transaction rollback or explicit truncate) to keep tests independent.
- Once per test file: matches Bun's per-file isolation model (`--isolate`/`--parallel`) naturally - each file gets its own PGlite + migrated schema, no cross-file interference, cost paid once per file.
- Once per test: PGlite's docs explicitly call this out as a supported, intended pattern ("a unique fresh Postgres for each test") given fast startup - highest isolation, most instantiations, and the recommended default per PGlite's own docs when isolation matters more than raw speed.

## 5. Root-level integration tests against Elysia

| Approach | What it needs from the app | Source |
|---|---|---|
| `app.handle(new Request(url, init))` | just the `app` instance (no `.listen()` needed); "simulating an HTTP Request" | [elysiajs.com/patterns/unit-test](https://elysiajs.com/patterns/unit-test) |
| Eden Treaty, `treaty(app)` | the `app` instance directly - "we may pass an Elysia instance to Eden Treaty directly to interact with the Elysia server directly without sending a network request"; for full type-safety on the call sites it also needs the exported `App` type (`treaty<App>(app)`) so calls are checked against route schemas | [elysiajs.com/eden/treaty/unit-test](https://elysiajs.com/eden/treaty/unit-test) |

Both work against the same in-memory instance with no listening socket. `app.handle` is lower-level: raw `Request`/`Response`, no compile-time route typing, more boilerplate for headers/JSON bodies. `treaty(app)` gives typed, autocompleted calls (`api.hello.get()`) matching exactly how the frontends already consume the API (`treaty<App>(url)` per this repo's `apps/*/src/**/lib/api.ts` and `services/api/src/index.ts`'s `export type App`), so a root-level integration test spanning multiple features is better served by Eden Treaty - it reuses the exact same contract the frontends depend on and will fail loudly (as a type error) if a route's shape drifts, whereas `app.handle` integration tests would keep compiling against a changed contract.

## Open questions

- `coverageSkipTestFiles` default: the general bunfig page ([bun.com/docs/runtime/bunfig](https://bun.com/docs/runtime/bunfig)) states default `false`, the coverage page ([bun.com/docs/test/coverage](https://bun.com/docs/test/coverage)) states default `true` - could not resolve which is authoritative from docs alone; would need a source-level check of Bun's CLI defaults (not done here) or an experiment measuring coverage with/without test files.
- Whether `bun test`'s workspace recursion (confirmed here in a 2-package scratch repo) is officially documented anywhere - it isn't; the behavior is empirical only (one experiment, one repo shape), not a documented contract, so it could change across Bun versions without being called a breaking change.
- Exact semantics of `--isolate`'s "VM-level transpilation cache" (what exactly is cached and invalidated) - only described at a summary level in the [bun.com/blog/bun-v1.3.13](https://bun.com/blog/bun-v1.3.13) release post, not in the reference docs at bun.com/docs/test/parallel in equivalent depth; did not dig into Bun's C++/Zig source for this.
- Whether `mock.module()` state is reset by `--parallel` workers between files in the same worker's queue - inferred from "`--parallel` implies `--isolate`" plus the confirmed `--isolate` experiment, but not independently re-run under `--parallel` (worker-process test would need a larger scratch suite to force >1 file per worker).
- PGlite/Drizzle migrator performance numbers (actual ms cost of `new PGlite()` + `migrate()`) - neither pglite.dev nor drizzle docs publish benchmarks; would require timing it directly in this repo once the schema exists.
- Whether a package-level `bunfig.toml`'s `preload` also applies when Bun is invoked with `--filter '*' test` (root script fanning out to every workspace) rather than `--filter @repo/api test` - not tested; likely behaves the same as the single-package `--filter` case since each script still runs with that package as cwd, but unconfirmed.
