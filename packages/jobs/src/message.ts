import type { StaticDecode, TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

/**
 * A message type: the `kind` that names it in the outbox and the schema its payload is checked
 * against. Declared in the owning feature's `model.ts`; this package holds no kind of its own.
 */
export type Message<Schema extends TSchema = TSchema> = {
  readonly kind: string;
  readonly payload: Schema;
};

/** What the consumer calls with a row's stored payload. `kind` is what it was declared for. */
export type JobHandler = ((payload: unknown) => Promise<void>) & { readonly kind: string };

const declared = new Set<string>();

/**
 * Declares a message type. Two declarations of one kind would give the consumer two payload
 * shapes for the same row, so the second one throws at import time, which is boot.
 */
export function defineMessage<Schema extends TSchema>(
  kind: string,
  payload: Schema,
): Message<Schema> {
  if (declared.has(kind)) throw new Error(`@repo/jobs: message kind "${kind}" is declared twice`);
  declared.add(kind);
  return { kind, payload };
}

/**
 * Every kind declared in this process. Not part of the package's public surface: the consumer
 * reads it to refuse a handler map that cannot cover them all.
 */
export const declaredKinds = (): readonly string[] => [...declared];

/**
 * Binds a handler to a message type, checking and decoding the stored payload before `run` sees
 * it: a row written by an older deploy fails against today's schema rather than reaching a rule.
 */
export function handle<Schema extends TSchema>(
  message: Message<Schema>,
  run: (payload: StaticDecode<Schema>) => Promise<void>,
): JobHandler {
  const handler = (payload: unknown) => run(Value.Decode(message.payload, payload));
  return Object.assign(handler, { kind: message.kind });
}

/** The checked, storable form of a payload. Throws when the payload is not what the kind declares. */
export const encodePayload = <Schema extends TSchema>(
  message: Message<Schema>,
  payload: StaticDecode<Schema>,
): unknown => Value.Encode(message.payload, payload);
