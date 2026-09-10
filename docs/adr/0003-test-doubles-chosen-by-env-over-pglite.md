# Test doubles are chosen by env, over PGlite

Every double is selected by the same environment parsing production uses: `@repo/db` picks PGlite on a `pglite:` `DATABASE_URL`, `@repo/email` picks its in-memory sender on `EMAIL_PROVIDER=memory`, and a test reads what happened through the package's `./testing` subpath. The import path under test is therefore the production one, and the database is the real schema, because PGlite runs the same `drizzle/` migrations.

The cost is what PGlite cannot do. It is one connection, so no test can hold two, and the two-consumer claim race in `@repo/jobs` goes untested. `for update skip locked` is proven in Postgres, which is where it runs.

## Considered Options

`mock.module`, rejected because it replaces the path production takes with one nothing else exercises. Real Postgres in tests, rejected because a fresh clone would need a running server before the first test passes. A mirrored `tests/` tree, rejected because finding the test of a file should not be a search.
