# Features live in the service, infrastructure lives in packages

`services/api/src` holds exactly `entrypoints/`, `features/` and `plugins/`: product code stays in the service as flat feature directories of up to six named files, and every concern with an outside (a store, a vendor, a runtime, a process facility) moves out into a `@repo/*` workspace under `packages/`. The split gives each kind of thing one legal home, keeps the layer of a file visible in its path, and leaves a request three or four files from the entry point to SQL.

## Considered Options

Seven prototype trees were built and compared (`services/api-prototypes` on `prototype/api-trees`). The adopted shape is candidate 3 for features and candidate 7 for infrastructure. Rejected: a `shared/` directory, which defers the placement decision and becomes the pile every real service grows; a separate domain package, which buys a boundary the workspace graph already gives packages and costs a hop on every feature; layer-first trees (`controllers/`, `services/`, `repositories/`), which scatter one feature across the tree.
