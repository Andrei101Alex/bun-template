#!/usr/bin/env bun
/**
 * First-run setup, invoked by `bun create` through the
 * "bun-create".postinstall hook in package.json. It offers to rebrand the
 * template to your project — you can accept or decline.
 *
 * Safe to run manually too: `bun scripts/setup.ts`.
 *
 * If there is no interactive terminal (e.g. CI), it prints how to rebrand
 * later and exits without changing anything — so automated runs never hang.
 */
import { basename, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

function toDisplay(input: string): string {
  return input
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ask(question: string, fallback: string): string {
  const answer = prompt(question, fallback);
  return (answer ?? fallback).trim() || fallback;
}

// No TTY → don't prompt, just leave instructions.
if (!process.stdin.isTTY) {
  console.log(
    "\nℹ️  Template ready. To rebrand it for your project, run:\n" +
      "   bun run rename <project-name>\n",
  );
  process.exit(0);
}

console.log("\n🎉 Template scaffolded.\n");

const consent = (prompt("Rebrand this template to your project now? (y/N)", "n") ?? "n")
  .trim()
  .toLowerCase();

if (consent !== "y" && consent !== "yes") {
  console.log("\nSkipped. You can rebrand anytime with:\n" + "   bun run rename <project-name>\n");
  process.exit(0);
}

const defaultName = basename(ROOT);
const name = ask("Project name (used for the npm scope):", defaultName);
const display = ask("Display / brand name:", toDisplay(name));

const args = ["scripts/rename.ts", name, "--display", display];
const proc = Bun.spawnSync(["bun", ...args], {
  cwd: ROOT,
  stdio: ["inherit", "inherit", "inherit"],
});

process.exit(proc.exitCode ?? 0);
