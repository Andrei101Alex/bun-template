# .NET clean architecture on Elysia: mapping and gaps

## Short answer

The template's `features/<name>/{routes,handlers,repository}.ts` plus `shared/` is already the
idiomatic Elysia shape, not a downgrade from .NET clean architecture. .NET's Domain/Application
split collapses because Elysia has no DI container to justify a separate interfaces layer;
`handlers.ts` is Application, the `t.Object` schemas double as Domain models, and `repository.ts`
is Infrastructure with no interface (this repo's AGENTS.md already forbids repository interfaces
for exactly the reason .NET needs them: DI is the only consumer). MediatR pipeline behaviours
(validation, logging, unhandled-exception) become Elysia's `.onError`/`.onBeforeHandle` hooks and
schema validation, not a request pipeline object. The Presentation project becomes `routes.ts`
plus the exported `App` type consumed via Eden Treaty - no codegen, no separate contracts project.
Elysia's own docs (best-practice page) independently arrive at controller/service/model,
recommend Elysia-instances-as-services only when request-scoped, and explicitly warn against
passing the whole `Context` around. Bun's docs say nothing about service layout beyond mechanical
workspace resolution; every found "clean architecture on Elysia/Hono" example reports the same
regret, that DDD-style layering above Elysia adds directories and DI boilerplate the runtime does
not ask for. No repository interface exists anywhere the DI-container reason for one is absent.

## Mapping table

| .NET mechanism | Bun/Elysia equivalent | Where it breaks down | Source |
| --- | --- | --- | --- |
| Domain project (entities, interfaces) | `t.Object` schemas in `routes.ts` + plain types exported from `handlers.ts` | No separate "entity" object with identity/behaviour; Elysia models are validation schemas, not domain objects. No enforced dependency-inversion boundary. | [Elysia best practice](https://elysiajs.com/essential/best-practice), `services/api/src/features/greeting/handlers.ts` |
| Application project (use cases, MediatR handlers) | `handlers.ts`, one exported function per operation | No mediator, no cross-cutting pipeline object; each handler wires its own error-throwing and calls its own repository import directly | `services/api/src/features/greeting/handlers.ts`, AGENTS.md feature table |
| Repository interface (`IApplicationDbContext`, defined in Application, implemented in Infrastructure) | None - `repository.ts` exports plain functions, imported directly by `handlers.ts` | Breaks down entirely: .NET needs the interface because DI resolves an implementation at runtime; Bun/ESM has no container, so the interface is a seam with one occupant and no test double behind it besides the real functions | AGENTS.md ("No repository interfaces" section); [jasontaylordev/CleanArchitecture `Application/Common/Interfaces`](https://github.com/jasontaylordev/CleanArchitecture/tree/main/src/Application/Common/Interfaces) |
| DI container / composition root (`Program.cs`, `AddInfrastructure()`) | `index.ts` - direct imports and `.use()` chaining; module-level singletons from plain ESM imports | No registration, no lifetime scopes (singleton/scoped/transient) to configure; a module is instantiated once by the runtime's module cache, full stop | `services/api/src/index.ts`; [Bun module resolution docs](https://bun.com/docs/runtime/modules) (module caching is Node/Bun's default, not Elysia-specific) |
| Pipeline behaviours: `ValidationBehaviour`, `LoggingBehaviour`, `UnhandledExceptionBehaviour`, `AuthorizationBehaviour`, `PerformanceBehaviour` | Elysia's schema validation (`t.Object` in `routes.ts`) for validation; `.onError({ as: 'global' })` in `shared/http.ts` for exceptions; `.onBeforeHandle`/guards for authorization | No single ordered pipeline wrapping every handler; each concern is a separate Elysia lifecycle hook the framework runs on every request in its own defined order, not a chain you compose per use case | [jasontaylordev/CleanArchitecture `Application/Common/Behaviours`](https://github.com/jasontaylordev/CleanArchitecture/tree/main/src/Application/Common/Behaviours); `services/api/src/shared/http.ts` |
| Infrastructure project (EF Core DbContext, repositories, external services) | `repository.ts` per feature + anything shared going in `shared/` (a DB client, when one arrives) | .NET centralises all infra in one project across the whole app; this template scopes infra per-feature, only truly cross-feature infra (DB client itself) lives in `shared/` | AGENTS.md feature table; `services/api/src/shared/env.ts` |
| Presentation/UI project (Controllers, ViewModels) + a generated OpenAPI client | `routes.ts` + `export type App = typeof app`, consumed via `treaty<App>()` (Eden Treaty) | No client generation step and no separate contracts project - the frontend imports the backend's TypeScript type directly, which the .NET model has no equivalent for (its closest analogue, an OpenAPI-generated client, is a build step this template has none of) | `services/api/src/index.ts`; root CLAUDE.md "Eden Treaty is the API contract" section |
| Composition root wiring Infrastructure to Application interfaces via DI | `index.ts`'s explicit `.use()` chain, plus each feature importing its own repository module directly | .NET's composition root exists to satisfy interfaces registered elsewhere; Elysia's plugin chain is just explicit ordering of middleware/routes, no interface resolution happening | `services/api/src/index.ts` |

## Elysia's own structure guidance (quoted)

From [elysiajs.com/essential/best-practice](https://elysiajs.com/essential/best-practice):

> "Each file has its own responsibility: Controller: Handles HTTP routing, request validation,
> and cookies. Service: Handles business logic, decoupled from the Elysia controller if possible.
> Model: Defines the data structure and validation for the request and response."

On request-scoped services and Elysia's own singleton mechanism:

> "If the service is a request-dependent service or needs to process HTTP requests, we recommend
> abstracting it as an Elysia instance to ensure type integrity and inference."

> "Elysia handles plugin deduplication by default, so you don't have to worry about performance,
> as it will be a singleton if you specify a 'name' property."

On decorators:

> "It's recommended to `decorate` only for request-dependent properties, such as `requestIP`,
> `requestTime`, or `session`. Overusing decorators ties your code to Elysia, making it harder to
> test and reuse."

On the Context anti-pattern:

> "Do not pass an entire `Context` to a controller, instead use object destructuring to extract
> what you need and pass it to the controller. This approach makes it hard to type `Context`
> properly, and may lead to loss of type integrity."

This template already follows the destructuring rule (`routes.ts`'s handler bodies destructure
`params`, never pass `set` or the whole context into `handlers.ts` - AGENTS.md forbids `handlers.ts`
importing `elysia` at all, which is a stricter version of the same rule) and the request-scoped
Elysia-instance-as-service pattern is not needed here because `handlers.ts` functions are plain
async functions, not request-dependent state - the template's plain-function repositories match
Elysia's "non-request-dependent: static classes/functions" branch of the same guidance.

## Bun's guidance on service/project layout

Bun's [workspaces docs](https://bun.com/docs/install/workspaces) describe only the mechanics of
`workspaces` glob resolution, hoisting, and the `workspace:` protocol; a `packages/*` example tree
is shown as illustration, not as a normative layout. **The docs are silent on**: recommended
internal structure for a single package/service, multiple entrypoints or scripts sharing one
`src/` (e.g. an `api` script and a `jobs` script in the same package.json, as this repo's
`services/api/package.json` only has `dev`/`start`/`typecheck`, no second entrypoint yet), or any
opinion on layered/clean-architecture-style internal organization. No Bun doc page found (searched
`bun.com/docs`) addresses "how to structure a Bun service" beyond the workspaces-as-dependency-graph
mechanics - this is a gap in Bun's own documentation, not an omission in this research.

## Interfaces-plus-implementations cost, one implementation

Neither Elysia's nor Bun's docs quantify the cost of an unnecessary interface layer directly;
what they document instead:

- Elysia's own docs state plugin instances are deduplicated to a singleton when given a `name`,
  so a "service-as-Elysia-instance" used in several other plugins costs one instantiation, not
  one per mount - see the deduplication quote above. Without a `name`, the plugin is re-instantiated
  per use ([elysiajs.com/essential/best-practice](https://elysiajs.com/essential/best-practice) -
  the docs don't give a number, only "it will be a singleton if you specify a 'name' property",
  implying no name means it is not).
- Bun's module resolution ([bun.com/docs/runtime/modules](https://bun.com/docs/runtime/modules))
  follows the same ES module cache semantics as Node: a module is evaluated once per process and
  every importer gets the same live binding. A repository file with no interface, imported
  directly by a handler, costs exactly one module evaluation at first import - the same as an
  interface-plus-implementation pair would, since the container in .NET is also just resolving to
  one concrete instance per scope. The overhead the interface adds is a virtual dispatch (an extra
  indirection through an interface method call) and a registration line, not a differently-shaped
  runtime object; **neither doc measures this**, so the specific per-request cost in nanoseconds is
  not sourced. The engineering argument that stands cited is AGENTS.md's own: "One implementation
  means the seam is hypothetical, and the indirection buys nothing."

## Open-source examples

### aymaneallaoui/clean-architecture-elysia

[github.com/aymaneallaoui/clean-architecture-elysia](https://github.com/aymaneallaoui/clean-architecture-elysia)
- Bun + Elysia + Drizzle ORM starter template.
- Tree (from README):
  ```
  src/
  ├── domain/              # entities/
  ├── application/         # use-cases/, services/
  ├── infrastructure/      # database/{schema,migrations}/, utils/
  ├── interface/           # controllers/, validators/, middleware/
  ├── main/                # config/, routes/, server.ts
  └── scripts/
  ```
- No stated regrets or caveats in the README; it presents the layering as a finished template
  without discussing trade-offs.

### lukas-andre/bun-elysia-clean-architecture-example

[github.com/lukas-andre/bun-elysia-clean-architecture-example](https://github.com/lukas-andre/bun-elysia-clean-architecture-example)
- Bun + Elysia + PostgresJS notes API, modules per bounded context (`auth`, `notes`, `users`) each
  split into `application/`, `domain/`, `infrastructure/`.
- States its own caveat directly: "While Elysia doesn't provide a scalable structure out of the
  box, this boilerplate shows how to achieve clean architecture with some additional effort." -
  i.e. the author confirms Elysia has no opinion here and the layering is bolted on, not native.

### honojs/hono issue #4121

[github.com/honojs/hono/issues/4121](https://github.com/honojs/hono/issues/4121) - "Request for
Guidance: Application Structure & Best Practices for Enterprise Applications." Not a project tree
but a maintainer-facing report of the same pattern attempted and regretted:
- Feature modules each split into API/repository/service/use-case/validation directories.
- Regret, verbatim substance from the issue: too many files and directories, high cognitive load;
  Hono has no built-in DI so the author adopted Awilix, which "creates additional boilerplate code
  in each feature module" rather than reducing it; open question in the issue itself about whether
  the use-case layer is "the right approach" versus a simpler, file-based structure.
- This is the closest primary-source evidence of a stated regret for the Hono side of the question
  (no Hono repository README found with an equally explicit regret; the issue is used instead,
  per the ticket's own allowance for "issues or READMEs").

## Open questions

- No Bun doc addresses multiple entrypoints in one package (an `api` + `jobs` split sharing
  `src/`) at all; whether Bun has an idiomatic opinion here could not be verified because no page
  discussing it was found under `bun.com/docs`.
- No first-party Elysia or Bun benchmark was found quantifying interface-dispatch or
  DI-container-equivalent overhead in JS/Bun; the module-caching argument above is inferred from
  ES module semantics, not measured by either doc set.
- Jason Taylor's CleanArchitecture README (fetched via WebFetch) did not surface its full
  directory tree in the rendered summary; the tree used above (`Domain`, `Application`,
  `Infrastructure`, `Web`, `ServiceDefaults`, `Shared`, `AppHost`, with `Application/Common/Behaviours`
  holding `LoggingBehaviour.cs`, `ValidationBehaviour.cs`, `PerformanceBehaviour.cs`,
  `AuthorizationBehaviour.cs`, `UnhandledExceptionBehaviour.cs`) was confirmed instead via
  `gh api repos/jasontaylordev/CleanArchitecture/contents/...` directory listings, not the README
  text itself.
- Could not find an Elysia (as opposed to Hono) project README or issue with an equally explicit
  stated regret about clean architecture; the two Elysia examples found show the pattern applied
  without commentary one way or the other, so the Hono issue carries the "regret" evidence for
  this research.
