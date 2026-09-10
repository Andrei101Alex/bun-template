import { Elysia, t } from "elysia";
import { errorBody } from "../../plugins/error-mapping";
import { staffGuard } from "../../plugins/staff-guard";
import { addressUndeliverable, postReplyBody, replyPosted } from "./model";
import { postReply } from "./service";

export const replyRoutes = new Elysia().use(staffGuard).post(
  "/feedback/:id/replies",
  async ({ params, body, status }) => {
    const result = await postReply(params.id, body);
    if (result.ok) return status(201, result.reply);
    return status(409, {
      code: "address_undeliverable" as const,
      message: "This address bounced, so the reply was not sent",
      details: { bouncedAt: result.bouncedAt.toISOString() },
    });
  },
  {
    params: t.Object({ id: t.String({ format: "uuid" }) }),
    body: postReplyBody,
    response: {
      201: replyPosted,
      401: errorBody,
      403: errorBody,
      404: errorBody,
      409: addressUndeliverable,
    },
  },
);
