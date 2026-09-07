/**
 * Every environment value the service reads, parsed once. A missing or malformed value fails
 * at boot rather than on the first request that happens to need it.
 */

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`PORT must be a positive integer, got ${process.env.PORT}`);
}

export const env: { port: number; corsOrigins: string[] } = {
  port,
  corsOrigins: [
    "http://localhost:5173", // dashboard (Vite)
    "http://localhost:3000", // website (Next.js)
  ],
};
