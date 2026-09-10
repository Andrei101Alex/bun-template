import { Elysia } from "elysia";
import { errorBody } from "../../plugins/error-mapping";
import { rateLimit } from "../../plugins/rate-limit";
import { staffGuard } from "../../plugins/staff-guard";
import { feedbackAccepted, feedbackList, submitFeedbackBody } from "./model";
import { listFeedback, submitFeedback } from "./service";

// staff-guard derives `as: "scoped"`, which reaches one instance up: this child is that instance,
// so the guard stops here rather than following the feature into buildApp
const staffRoutes = new Elysia().use(staffGuard).get("/feedback", () => listFeedback(), {
  response: { 200: feedbackList, 401: errorBody, 403: errorBody },
});

// the submission is the only public write, so the limit is scoped to this child the same way
const submitRoutes = new Elysia()
  .use(rateLimit)
  .post("/feedback", async ({ body, status }) => status(201, await submitFeedback(body)), {
    body: submitFeedbackBody,
    response: { 201: feedbackAccepted, 429: errorBody },
  });

export const feedbackRoutes = new Elysia().use(staffRoutes).use(submitRoutes);
