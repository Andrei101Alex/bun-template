import { replayDeadLetter } from "../src/consumer";

const id = Number(process.argv[2]);
if (!Number.isSafeInteger(id) || id <= 0) {
  console.error("usage: bun run --filter @repo/jobs replay <id>");
  process.exit(1);
}

if (await replayDeadLetter(id)) {
  console.log(`@repo/jobs: message ${id} is available again`);
} else {
  console.error(`@repo/jobs: no dead-lettered message ${id}`);
  process.exit(1);
}

// the Postgres driver holds its socket open, so exit rather than wait on it
process.exit(0);
