import { handle } from "@repo/jobs";
import { acknowledge } from "./model";
import { sendAcknowledgement } from "./service";

export const handlers = {
  [acknowledge.kind]: handle(acknowledge, ({ feedbackId }) => sendAcknowledgement(feedbackId)),
};
