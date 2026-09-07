/**
 * Every read and write of greeting counts. In-memory so the template needs no database: swap
 * these bodies for real queries and nothing above this file changes.
 */

const counts = new Map<string, number>();

/** Records one greeting and returns the name's new total. */
export async function recordGreeting(name: string): Promise<number> {
  const count = (counts.get(name) ?? 0) + 1;
  counts.set(name, count);
  return count;
}

/** Times this name has been greeted, 0 if never. */
export async function greetingCount(name: string): Promise<number> {
  return counts.get(name) ?? 0;
}
