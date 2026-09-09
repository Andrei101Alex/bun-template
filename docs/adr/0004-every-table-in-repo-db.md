# Every table lives in @repo/db

Every `pgTable` in the repo is declared under `packages/db/src/schema/{name}.ts` and aggregated in `schema/index.ts`, auth and outbox tables included, with migrations generated into `packages/db/drizzle/` and run by a script rather than at boot. "What tables exist" and "where do migrations run" each have one answer, and a migration cannot be produced from a schema the generator cannot see.

## Considered Options

A `table.ts` inside each feature, keeping a feature's storage beside its queries. Rejected because drizzle-kit needs one schema entry point to diff against, cross-feature foreign keys would reach into another feature's directory, and the answer to "what does this database hold" would be a search rather than a directory.
