import type { EmailMessage } from "./message";

const sent: EmailMessage[] = [];

/**
 * The provider a dev run and every test send through. What it keeps is readable through
 * `./testing`, so a test asserts on the outcome instead of mocking the module its subject imports.
 */
export function sendViaMemory(message: EmailMessage): Promise<void> {
  sent.push(message);
  return Promise.resolve();
}

export const sentEmails = (): readonly EmailMessage[] => sent;

export const resetSentEmails = (): void => {
  sent.length = 0;
};
