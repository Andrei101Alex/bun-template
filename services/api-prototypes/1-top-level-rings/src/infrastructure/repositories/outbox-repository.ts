// implements Outbox + OutboxStore: insert, SELECT ... FOR UPDATE SKIP LOCKED claim, backoff on failure, dead-letter after 5 attempts
