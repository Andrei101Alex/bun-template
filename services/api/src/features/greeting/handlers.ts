import { invalidInput } from "../../shared/errors";
import { recordGreeting } from "./repository";

export type Greeting = {
  greeting: string;
  timestamp: string;
  /** Times this name has been greeted, this one included. */
  timesGreeted: number;
};

/**
 * Greets someone and counts it. Takes a plain string and returns a plain object, so nothing
 * here knows a request arrived over HTTP. This is the surface to test the feature through.
 */
export async function greet(name: string): Promise<Greeting> {
  // A schema can require a non-empty string but not a non-blank one, so this rule lives here
  const trimmed = name.trim();
  if (!trimmed) throw invalidInput("Name must not be blank");

  return {
    greeting: `Hello, ${trimmed}!`,
    timestamp: new Date().toISOString(),
    timesGreeted: await recordGreeting(trimmed),
  };
}
