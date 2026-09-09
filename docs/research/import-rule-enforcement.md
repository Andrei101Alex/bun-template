# Enforcing import rules inside `services/api`

## The question

The decided source layout for `services/api/src` is three top-level directories -
`entrypoints/`, `features/`, `plugins/` - and four import rules must hold inside that tree:
(1) `plugins/` never imports from `features/`; (2) a feature may import another feature's
`service.ts` only, never its `routes.ts`, `model.ts`, or `repository.ts`; (3) inside one feature
the chain is `routes.ts -> service.ts -> repository.ts -> @repo/db`, so `routes.ts` may not reach
past `service.ts` to `repository.ts`; (4) only `routes.ts`, `plugins/**`, and `entrypoints/**` may
import the `elysia` package - `service.ts`, `repository.ts`, `model.ts` never import it. This repo's
only lint/format tool is Biome (`biome.json`, schema `2.5.12`); there is no ESLint; the only test
runner is bare `bun test`. Below, five candidate tools are checked against primary sources for
what they can and cannot express, how they would wire into `bun run check`, and their cost.

---

## 1. Biome's `noRestrictedImports`

Primary source: [biomejs.dev/linter/rules/no-restricted-imports](https://biomejs.dev/linter/rules/no-restricted-imports/),
fetched directly.

**What it restricts.** The rule disallows "specified modules when loaded by import or require."
It matches on the **imported module specifier** - `paths` (exact specifiers, optionally scoped to
specific `importNames`/`allowImportNames`), and, from Biome v2.2.0 onward, `patterns` with a
`group` of gitignore-style globs plus `importNamePattern`/`invertImportNamePattern` for regex-based
name restrictions. Every documented example restricts *what is imported* (a specifier or specifier
glob), never *which file is doing the importing*. The rule itself carries no `from`/source concept.

**Overrides can add the source dimension.** Biome's `overrides` mechanism
([biomejs.dev/reference/configuration](https://biomejs.dev/reference/configuration/), fetched
directly) is "a list of patterns" that "change the behaviour of the tools for certain files," and
the documented example flips a rule's setting per glob:

```json
"overrides": [
  { "includes": ["lib/**"], "linter": { "rules": { "suspicious": { "noDebugger": "off" } } } },
  { "includes": ["shims/**"], "linter": { "enabled": false } }
]
```

This confirms overrides can turn a rule off (or reconfigure it) for a glob-scoped subset of files,
and the reverse - on by default, off for a scoped subset - works the same way. Combining this with
`noRestrictedImports` is exactly how rule 4 becomes expressible: ban the `elysia` specifier at the
top level, then an `overrides` entry for `["**/routes.ts", "plugins/**", "entrypoints/**"]` turns
that rule off again for those files.

**(a) What it CAN express**
- **Rule 4** - yes, via the override pattern above. This is a bare-specifier ban (`"elysia"` in
  `paths`) scoped on/off by file glob, which is precisely the shape of rule 4.

**(b) What it CANNOT express**
- **Rules 1-3** - no. These are directory-to-directory or file-to-file restrictions (`plugins/`
  must not import from `features/`; a feature's `routes.ts` must not import a sibling feature's
  `repository.ts`; within a feature, `routes.ts` must not import `repository.ts` directly). Biome's
  rule only sees the specifier string being imported, not a directory-shaped "from is under
  `plugins/`, to is under `features/`" relationship, and the docs give no mechanism for matching
  the imported path against a directory glob relative to the importer (Biome does not resolve
  relative specifiers to absolute paths for this rule) - only exact specifiers or specifier-shaped
  globs (`import-foo/*`). Rule 1-3 targets are same-package relative imports like
  `../other-feature/repository`, which would require regex/glob matching on the *resolved* path
  under `features/`, something the documented `patterns`/`group` syntax is not shown to do; the
  fetched docs describe it purely as "gitignore-style patterns" over module specifiers, with no
  worked example of a relative-path or directory-shaped restriction, so this is asserted with
  moderate confidence, not proven false by the docs' silence.

**(c) Wiring into `bun run check`.** No separate step needed - `noRestrictedImports` plus
`overrides` lives entirely in the existing `biome.json`, and `bun run check` (`biome check .`)
already picks up all lint rules including overrides. Zero new scripts, zero new commands.

**(d) Cost.** Low. No new dependency (Biome is already the toolchain), the config is a rule entry
plus 1-2 `overrides` blocks, and it adds no runtime cost beyond Biome's existing lint pass (which
this repo already runs and would run regardless). Maintenance burden is a few JSON lines that only
need touching if the file names or directory names in the layout change.

---

## 2. dependency-cruiser

Primary sources: [`doc/rules-reference.md`](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md),
[`doc/options-reference.md`](https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md),
and `package.json` at `raw.githubusercontent.com/sverweij/dependency-cruiser/main/package.json`,
all fetched directly.

**Config shape.** A `forbidden` rule is `{ name, severity, from: { path, pathNot }, to: { path,
pathNot } }` where `path`/`pathNot` are **regular expressions** (not globs), matched against the
project-relative file path - `from.path` is "the path from the current working directory ... to
the file containing a dependency," `to.path` is "the path ... the dependency resolves to." This is
a real directory-to-directory (or file-to-file) graph rule, which is exactly the shape rules 1-3
need. A documented example (peer-folder isolation with a captured group) is structurally identical
to what rule 2 needs:

```js
{
  name: "no-inter-ubc",
  severity: "error",
  from: { path: "^src/business-components/([^/]+)/.+" },
  to: {
    path: "^src/business-components/([^/]+)/.+",
    pathNot: "^src/business-components/$1/.+",
  },
}
```

Concretely for this repo (illustrative only, not implemented):

- **Rule 1** (`plugins/` never imports `features/`):
  `from: { path: "^src/plugins/" }, to: { path: "^src/features/" }` - severity `error`.
- **Rule 2** (cross-feature import only via `service.ts`):
  `from: { path: "^src/features/([^/]+)/" }, to: { path: "^src/features/(?!\\1/)[^/]+/(?!service\\.ts$).+" }`
  - i.e. `to` matches another feature's directory *and* is not that feature's `service.ts`.
- **Rule 3** (`routes.ts` must not import `repository.ts` directly, and similar for skipped
  layers): `from: { path: "/routes\\.ts$" }, to: { path: "/repository\\.ts$" }`, plus a matching
  rule for `routes.ts -> model.ts` if that hop is also disallowed, and `service.ts -> @repo/db`
  bypass if relevant.
- **Rule 4** (only `routes.ts`, `plugins/**`, `entrypoints/**` import `elysia`):
  `from: { pathNot: "(/routes\\.ts$|^src/plugins/|^src/entrypoints/)" }, to: { path: "^elysia$" }`.
  This is a `from`/`to` regex pair like any other - dependency-cruiser does not distinguish "bare
  specifier" as a special case, so rule 4 is just as expressible here as rules 1-3.

**Runs under Bun?** The fetched `package.json` `engines` field is `"node": "^22||^24||>=26"` -
it declares a **Node** engine requirement, with no Bun mention. It ships six bins
(`dependency-cruiser`, `depcruise`, etc.), all plain Node CLI scripts. No specific Bun
incompatibility was found via search (the GitHub issue tracker and a `dependency-cruiser-report`
GitHub Action both surfaced, and the Action documents a Bun package-manager option for installing
it, but neither is a primary statement about running the tool itself under Bun's runtime) - so
compatibility is **unverified** by primary source; running it as `bunx dependency-cruiser` would
very likely work in practice (it is a CommonJS/ESM Node CLI, and Bun's Node-compat layer runs most
such tools), but the `engines` field itself only promises Node, and no primary source was found
confirming Bun as a supported runtime.

**TS resolution.** A `tsConfig` option is documented: `{ tsConfig: { fileName: "tsconfig.json" } }`
- "If dependency-cruiser encounters typescript, it compiles it to understand what it is looking
at. If you have `compilerOptions` in your `tsconfig.json` you think it should take into account,
you can use this option to make it do that." This repo's `services/api` already has its own
`tsconfig.json`, so this is a one-line hookup, not new path-alias config.

**Caching.** A documented `cache` option (`folder`, `strategy: 'metadata'|'content'`, `compress`)
exists specifically to avoid re-cruising unchanged files between runs.

**(a)/(b)** Can express all four rules (regex `from`/`to` pairs), including rule 4, with no gap
found in the primary source.

**(c) Wiring.** New devDependency (`dependency-cruiser`) plus a `.dependency-cruiser.cjs` config;
add a script, e.g. `"check:imports": "depcruise --config .dependency-cruiser.cjs
services/api/src"`, and append it to the root `check` script (`bun run check && bun run
check:imports`, or fold both into a single `package.json` script with `&&`).

**(d) Cost.** Medium. One new devDependency with its own dependency subtree (a Node CLI, not a
Bun-native tool); config complexity is moderate (regex path rules need care, especially rule 2's
capture-group negation); a `cache` option keeps repeat-run cost low once configured; maintenance
burden is: rules must be updated if directory/file names in the layout change, same as any of
these approaches, but the rule definitions are declarative and centralized in one config file
rather than scattered across `biome.json` overrides.

---

## 3. eslint-plugin-boundaries

Primary sources: `github.com/javierbrea/eslint-plugin-boundaries` (README, fetched directly) and
its `package.json` (`raw.githubusercontent.com/.../master/package.json`, fetched directly). Note:
the plugin's docs site has migrated to a separate "JS Boundaries" project site per recent GitHub
discussion threads found via search; the README on the source repo was used as the fetched primary
source here since the new docs-site URL was not directly resolvable via WebFetch in this session.

**What it expresses.** `boundaries/elements` settings classify files into named element types via
a `pattern` (with optional `capture` groups to parameterize, e.g. capturing a feature name so
rules can compare "same capture" vs "different capture" - directly analogous to dependency-cruiser's
`$1` back-reference). The `boundaries/dependencies` rule (formerly `element-types`) then declares,
per element type, a `default: "disallow"` plus `allow`/`disallow` policies naming which other
element types (or specific types+capture combinations) may be imported. This is expressive enough
in principle to model directory-shaped rules 1-3 (element types for `plugins`, `features`, and a
captured `feature` name), and file-category restrictions (docs mention restricting by "file
category," which could plausibly express "only this file within an element may import X" for rule
3/4 - not independently confirmed with a worked example in what was fetched).

**(a)/(b)** Likely can express rules 1-3 (its core design purpose, same shape as
dependency-cruiser). Rule 4 (elysia import banned in most files, allowed in a few) is less
clearly its native shape - it is designed around element-to-element dependency policies, not
bare-package-specifier bans scoped by file category; this would need `boundaries/no-unknown` or
similar unclear rule combinations, not the plugin's central use case. Not fully verified from the
primary source fetched, and flagged as such.

**(c)/(d) Cost - this is the deciding factor.** This is an **ESLint plugin**, and this repo has no
ESLint installed at all today. Fetched `package.json` devDependencies show the plugin's own
maintainers pin `eslint: 9.37.0` in that repo (a dev/test pin, not a declared peer range - no
`peerDependencies` block was present in the fetched file, so the actual supported ESLint version
range is unconfirmed from this source). Introducing it here means: `eslint` itself, a TypeScript
parser (`@typescript-eslint/parser` or similar), the plugin, and an `eslint.config.js` - at least
3-4 new devDependencies plus their transitive trees, none of which exist in this repo today.
It would run as a **second, wholly separate lint invocation** alongside `biome check` (Biome does
not load ESLint plugins), adding CI wall-clock time for a second tool's startup and file walk, and
ongoing maintenance to keep two lint configs from fighting over the same rule space (e.g. import
sorting/formatting overlaps would need to be disabled on one side). Given rules 1-3 are equally
well expressed by dependency-cruiser (already a plain non-ESLint dependency-graph tool) and rule 4
by a Biome override, this option carries the highest structural cost of the five for the least
marginal benefit here.

---

## 4. A custom `bun test`/script walking imports

Primary sources: [bun.sh/docs/api/transpiler](https://bun.sh/docs/api/transpiler) and
[bun.sh/docs/api/glob](https://bun.sh/docs/api/glob), both fetched directly.

**`Bun.Transpiler().scanImports()`** is documented, present-tense, with no legacy/experimental
label in the fetched page: "The `.scanImports()` method scans source code and returns a list of
imports," returning `Import[]` objects shaped `{ path: string, kind: "import-statement" | ... }`.
The docs explicitly position it as the fast path ("faster than `.scan()`, especially for large
files, but marginally less accurate") versus the fuller `.scan()`, which also returns exports -
so it is documented as a real, current, supported API, not a deprecated one.

**`Bun.Glob`** is documented with a `scan()`/`scanSync()` async/sync iterable API and full glob
syntax (`*`, `**`, `?`, `[ab]`, `{a,b,c}`, `!`), directly usable to walk `services/api/src/**/*.ts`.

**Concrete design.** `Bun.Glob("**/*.ts").scanSync("services/api/src")` to enumerate files; for
each file, read it and call `scanImports` (or a plain regex over `^import .* from ['"](.+)['"]`,
simpler and dependency-free) to get specifiers; resolve each relative specifier against the
importing file's directory; apply the four rules as plain string/path checks (does resolved path
start with `features/`, does it end in `service.ts`, is the specifier literally `"elysia"`, etc.);
collect violations and `process.exit(1)` with a listing if any are found.

**(a)/(b)** By construction, this can express all four rules exactly - it is arbitrary code, not a
declarative matcher, so there is no rule shape it cannot represent (including rule 2's "same
feature only" negative-capture logic and rule 4's elysia-in-most-but-not-all-files exception).

**(d) Cost.** No new dependency (both APIs are built into Bun). But: it is code that must be
written and kept correct by hand (path resolution edge cases - `./`, `../`, index files, `.js`
specifiers that resolve to `.ts` source, re-exports); no incremental caching (re-walks and
re-scans every file every run, though for a package this size that is almost certainly
sub-second); no editor integration (violations only surface at `bun run check` / CI time, never
as an inline squiggle while typing, unlike the Biome or ESLint options); and it needs manual
updates whenever directory or file names in the layout change, same as any of these approaches,
except here the rule logic is bespoke code rather than a config array, so a rename requires editing
conditionals rather than editing regex strings in a `forbidden` array.

**(c) Wiring.** `scripts/check-import-rules.ts` invoked either as a `bun run` script
(`"check:imports": "bun scripts/check-import-rules.ts"`, appended to `check` via `&&`) or as a
single `bun test` file asserting `violations.length === 0` - either integrates into `bun run check`
with one line, since the repo already runs on Bun.

---

## 5. TypeScript project references

Primary source: [typescriptlang.org/docs/handbook/project-references.html](https://www.typescriptlang.org/docs/handbook/project-references.html),
fetched directly.

**What they enforce.** Project references operate at the granularity of a whole **tsconfig
project** (a directory with its own `tsconfig.json`, `"composite": true`, and a `references` array
naming other projects by path). The docs state a referencing project's imports "load its _output_
declaration file (`.d.ts`)" from the referenced project, and `tsc -b` "find[s] all referenced
projects," checks if they're up to date, and "build[s] out-of-date projects in the correct order."
The worked example in the handbook is `test/tsconfig.json` referencing `../src` - one project,
one other project, both being separate directories with separate `tsconfig.json` files.

**Why this cannot express rules 2-4.** Rules 2-4 need enforcement at the granularity of individual
*files* inside one existing package (`services/api`, one `tsconfig.json`) - `routes.ts` vs
`service.ts` vs `repository.ts` vs `model.ts` living in the same feature directory. Project
references have no concept of a boundary narrower than "a project," so achieving file-level
separation would require splitting every one of `services/api`'s features into multiple
sub-projects, each with its own `tsconfig.json`, `composite: true`, and declared `references` -
e.g. a `repository`-only project referenced by a `service`-only project referenced by a
`routes`-only project, times every feature. This repo's own `CLAUDE.md` already states the
project's typecheck model is "per-package, not `tsc -b`... there is no composite solution," and
that the app/library tsconfig presets set `declaration: false` "on purpose" - composite projects
*require* `declaration: true` and emitted `.d.ts` outputs, which is the opposite of the repo's
current preset design and would mean re-litigating TS2742/TS4023 portability errors the presets
were explicitly set up to avoid. Given the primary source ties references strictly to the
project/folder level and this repo has explicitly opted out of a composite build model, project
references are not a realistic mechanism for rules 2-4 (or 1 and 3, same granularity problem)
inside a single existing package.

**(a)/(b)/(c)/(d)** Cannot express any of the four rules at their required granularity without an
impractical restructuring (one sub-tsconfig per file per feature). Not evaluated further for wiring
or cost since it fails (a) for all four rules.

---

## Comparison table

| Tool | Rule 1 (plugins ⊥ features) | Rule 2 (cross-feature via service.ts only) | Rule 3 (routes→service→repo chain) | Rule 4 (elysia import scope) | Runs in `bun run check` how | Cost |
|---|---|---|---|---|---|---|
| Biome `noRestrictedImports` (+ `overrides`) | No | No | No | Yes | Already inside `biome check .` - no new step | Low - no new dep, a few JSON lines, zero added runtime |
| dependency-cruiser | Yes | Yes | Yes | Yes | New `depcruise` script chained with `&&` | Medium - new Node-CLI devDependency, moderate regex config, Bun-runtime support unverified by primary source |
| eslint-plugin-boundaries | Yes (likely) | Yes (likely) | Yes (likely) | Partial (not its native shape, unverified) | Second, separate ESLint invocation alongside Biome | High - introduces ESLint + parser + plugin + config into an ESLint-free repo, two lint tools to keep non-conflicting |
| Custom `bun` script (`Bun.Glob` + `scanImports`) | Yes | Yes | Yes | Yes | One `bun run` script chained with `&&`, or a `bun test` file | Low-medium - zero new deps, but hand-written/maintained logic, no editor integration, no caching |
| TypeScript project references | No | No | No | No | N/A | N/A - wrong granularity, fails all four rules by design |

---

## Recommendation

Use **dependency-cruiser for rules 1-3** and **Biome's `noRestrictedImports` + `overrides` for
rule 4**, rather than reaching for one tool to do all four.

Rules 1-3 are directory-to-directory and file-to-file dependency-graph constraints - exactly
dependency-cruiser's purpose, confirmed against its own rules reference: regex `from`/`to` pairs
with capture-group back-references express all three directly, and it is a single, centralized,
declarative config rather than code to maintain. Its cost is real but bounded: one new
devDependency, a moderate one-time config write, and a `tsConfig` hookup that's a single option.
Whether it runs cleanly under Bun's runtime was not confirmed by a primary source (its `engines`
field names Node only) - this should be smoke-tested (`bunx dependency-cruiser --version` and a
real run against `services/api`) before committing to it, and Node-via-`npx` is the fallback if Bun
compatibility turns out to be an issue.

Rule 4 is a different shape: a bare-specifier ban scoped by file glob, not a directory-graph rule,
and Biome's own `overrides` mechanism (confirmed capable of flipping a rule's config per glob) plus
`noRestrictedImports` covers it with zero new dependencies and zero new CI steps, since it rides
inside the `biome check .` this repo already runs. Forcing rule 4 into dependency-cruiser instead
is possible (shown above) and would mean one fewer moving part - a reasonable simplification if the
team would rather own one enforcement tool instead of two. eslint-plugin-boundaries and TypeScript
project references are both worse fits here: the former reintroduces a second lint toolchain this
repo deliberately doesn't have, for no rule-expressiveness gain over dependency-cruiser; the latter
operates at the wrong granularity entirely and was ruled out by the handbook's own description of
what a "project" reference means, reinforced by this repo's existing non-composite tsconfig setup.
