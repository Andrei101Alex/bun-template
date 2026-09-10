import { rateLimited } from "@repo/errors";
import { Elysia } from "elysia";

/** How many requests one client gets per window before it is refused. */
export const REQUESTS_PER_WINDOW = 5;
const WINDOW_MS = 60_000;
/** How many clients are held at once; reaching it sweeps the windows that have lapsed. */
const TRACKED_CLIENTS = 10_000;

type Window = { count: number; endsAt: number };

// counted in this process alone, so N processes allow N times the limit. A count shared across
// them would be a table in @repo/db, incremented per request; no route needs that yet
const windows = new Map<string, Window>();

const sweep = (now: number) => {
  for (const [address, window] of windows) if (now >= window.endsAt) windows.delete(address);
};

// the first hop of x-forwarded-for is trusted, so the api must sit behind a proxy that overwrites
// the header; without one every client behind the proxy shares the socket address's window
const addressOf = (request: Request, ip: string | undefined) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || ip || "unknown";

/**
 * A fixed window per client address: `REQUESTS_PER_WINDOW` requests, then 429 with `Retry-After`
 * until the window lapses. Hooks as `as: "scoped"`, so it covers the instance that uses it.
 */
export const rateLimit = new Elysia({ name: "rate-limit" }).onBeforeHandle(
  { as: "scoped" },
  ({ request, server, set }) => {
    const address = addressOf(request, server?.requestIP(request)?.address);
    const now = Date.now();
    const window = windows.get(address);

    if (!window || now >= window.endsAt) {
      if (windows.size >= TRACKED_CLIENTS) sweep(now);
      windows.set(address, { count: 1, endsAt: now + WINDOW_MS });
      return;
    }

    // a refused request counts too: a flood cannot hold its window open, but it cannot buy
    // itself a fresh one either
    window.count += 1;
    if (window.count > REQUESTS_PER_WINDOW) {
      set.headers["retry-after"] = String(Math.ceil((window.endsAt - now) / 1000));
      throw rateLimited("rate_limited", "Too many requests; retry after the window lapses");
    }
  },
);
