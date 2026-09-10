import { Elysia } from "elysia";
import { errorBody } from "../../plugins/error-mapping";
import { staffGuard } from "../../plugins/staff-guard";
import { feedbackAccepted, feedbackList, submitFeedbackBody } from "./model";
import { listFeedback, submitFeedback } from "./service";

// staff-guard derives `as: "scoped"`, which reaches one instance up: this child is that instance,
// so the guard stops here rather than following the feature into buildApp
const staffRoutes = new Elysia().use(staffGuard).get("/feedback", () => listFeedback(), {
  response: { 200: feedbackList, 401: errorBody, 403: errorBody },
});

export const feedbackRoutes = new Elysia()
  .use(staffRoutes)
  .post("/feedback", async ({ body, status }) => status(201, await submitFeedback(body)), {
    body: submitFeedbackBody,
    response: { 201: feedbackAccepted },
  });
