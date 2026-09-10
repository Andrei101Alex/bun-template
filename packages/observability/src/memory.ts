/**
 * The error reporter that ships. A vendor would take `reportError`'s place here; until one does,
 * this holds what was reported so a test can read it through `./testing`.
 */
export type ReportedError = { error: unknown; context: Record<string, unknown> };

const reported: ReportedError[] = [];

export function report(error: unknown, context: Record<string, unknown>): void {
  reported.push({ error, context });
}

export const reportedErrors = (): readonly ReportedError[] => reported;

export const resetReportedErrors = (): void => {
  reported.length = 0;
};
