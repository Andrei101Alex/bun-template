import { handle, type Schedule } from "@repo/jobs";
import { deliver } from "./model";
import { deliverReply, nudgeUnanswered } from "./service";

export const handlers = {
  [deliver.kind]: handle(deliver, ({ replyId }) => deliverReply(replyId)),
};

// entrypoints/jobs/env.ts fails the boot without this; a feature never imports an entry point, so
// the edge reads it the way it reads the clock
function digestRecipient(): string {
  const to = process.env.STAFF_DIGEST_EMAIL;
  if (!to) throw new Error("replies: STAFF_DIGEST_EMAIL is not set");
  return to;
}

export const schedules: readonly Schedule[] = [
  {
    name: "replies.nudge-unanswered",
    // 09:00 daily: a digest is a working-hours nudge, not an alert
    cron: "0 9 * * *",
    run: (now) => nudgeUnanswered(digestRecipient(), now),
  },
];
