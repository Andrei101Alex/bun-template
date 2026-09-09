# No container, no repository interfaces

A repository exports plain functions that import `db` from `@repo/db` directly, and a service imports the vendors it uses. Nothing is registered, injected or wired: one implementation means the seam is hypothetical, and the indirection buys nothing the directory layout does not already give. The repository earns its place by making "what touches this table" a one-directory answer, not by being swappable.

## Considered Options

Ports and adapters with an interface per repository, and a composition root handing dependencies down from the entry point. Both were rejected as machinery for a substitution the template never performs: the things a test genuinely cannot run are the email vendor and the clock, and each has a cheaper answer: a package double chosen by env, and a required `now: Date` parameter on the rules that need it.
