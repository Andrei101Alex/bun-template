// The jobs process reads nothing of its own - the polling constants are code, not env. Importing
// each package it uses parses that package's env here, so a missing DATABASE_URL or a bad
// EMAIL_PROVIDER fails at boot rather than on the first message claimed.
import "@repo/db";
import "@repo/email";
import "@repo/observability";
