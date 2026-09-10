import { Elysia } from "elysia";
import { feedbackAccepted, submitFeedbackBody } from "./model";
import { submitFeedback } from "./service";

export const feedbackRoutes = new Elysia().post(
  "/feedback",
  async ({ body, status }) => status(201, await submitFeedback(body)),
  { body: submitFeedbackBody, response: { 201: feedbackAccepted } },
);
