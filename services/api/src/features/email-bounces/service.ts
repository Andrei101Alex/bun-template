import { markAddressUndeliverable } from "../feedback/service";

/** The one event kind that reports an address the provider has given up on. */
const BOUNCED = "email.bounced";

/** As much of the provider's event as this reads; everything in it is the provider's word. */
type BounceEvent = {
  type?: unknown;
  created_at?: unknown;
  data?: { to?: unknown };
};

/**
 * Records what the provider reported, so nothing else is sent to an address that bounced.
 *
 * Takes the event unvalidated on purpose: an event kind this does not handle, and an address no
 * submission carries, are both nothing to do rather than a refusal, because a provider reads a
 * 4xx as a reason to keep retrying an event it will never get right. A failure to record does
 * propagate, which is what earns the provider its retry. `receivedAt` dates a bounce whose event
 * carries no usable date of its own.
 */
export async function recordBounce(event: unknown, receivedAt: Date): Promise<void> {
  const { type, created_at, data } = (event ?? {}) as BounceEvent;
  if (type !== BOUNCED) return;

  const bouncedAt = dateOf(created_at) ?? receivedAt;
  for (const email of addressesIn(data?.to)) {
    await markAddressUndeliverable(email, bouncedAt);
  }
}

/** Parsing a string the provider sent, not a clock read: an unparseable one is no date at all. */
function dateOf(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// one event covers every recipient of the message that bounced
const addressesIn = (to: unknown): string[] =>
  Array.isArray(to) ? to.filter((value): value is string => typeof value === "string") : [];
