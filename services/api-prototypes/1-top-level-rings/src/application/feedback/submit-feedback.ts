// submitFeedback(deps)(input): newFeedback -> uow.run(repo.insert + outbox.enqueue('feedback.acknowledge')) -> returns Feedback
