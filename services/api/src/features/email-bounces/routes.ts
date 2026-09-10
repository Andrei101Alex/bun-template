import { verifyWebhookSignature, webhookSecret } from "@repo/email";
import { unauthenticated } from "@repo/errors";
import { Elysia, t } from "elysia";
import { errorBody } from "../../plugins/error-mapping";
import { recordBounce } from "./service";

/**
 * The email provider's bounce webhook. The signature covers the bytes the provider sent, so the
 * body arrives as text and the guard verifies it before anything reads it as an event: a
 * re-encoding of a parsed body would not carry the same signature.
 *
 * The event itself has no schema, because 422 is an answer this endpoint must never give - a
 * provider reads a 4xx as a reason to keep retrying an event it can never fix - so an event
 * `service.ts` does not recognise is answered 200 like any other.
 */
export const emailBounceRoutes = new Elysia().post(
  "/webhooks/email",
  async ({ body }) => {
    await recordBounce(JSON.parse(body), new Date());
    return { received: true as const };
  },
  {
    parse: "text",
    body: t.String(),
    beforeHandle: ({ body, headers }) => {
      if (!verifyWebhookSignature({ body, headers, secret: webhookSecret })) {
        throw unauthenticated("invalid_signature", "The webhook signature does not check out");
      }
    },
    response: { 200: t.Object({ received: t.Literal(true) }), 401: errorBody },
  },
);
