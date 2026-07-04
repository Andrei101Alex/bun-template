#!/usr/bin/env bun
/**
 * Rebrand this template to a new project.
 *
 * Usage:
 *   bun scripts/rename.ts <project-name> [options]
 *
 * Arguments:
 *   <project-name>        Name for the project. Drives the npm scope and, by
 *                         default, the display name. e.g. "my-shop".
 *
 * Options:
 *   --scope   <scope>     Override the npm scope (default: sanitized project-name).
 *   --display <name>      Override the human-facing brand shown in the UI/API
 *                         (default: Title Case of project-name, e.g. "My Shop").
 *   --dry-run             Show what would change without writing anything.
 *   -h, --help            Show this help.
 *
 * What it does (two safe token swaps + the root package name):
 *   @repo/  -> @<scope>/     the private workspace scope, in every package.json,
 *                            import, tsconfig path, components.json alias, etc.
 *   Acme    -> <display>     the placeholder brand in titles, headings, API text.
 *   root package.json "name" -> <project-name>
 *
 * After running, the two tokens no longer exist — running it again is a no-op.
 * You can then delete this script and the "Using this template" section of the
 * README.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

// Directories and files never touched.
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".next",
  "storybook-static",
  "scripts", // don't rewrite this script's own "@repo" / "Acme" literals
]);
const SKIP_FILES = new Set(["bun.lock", "bun.lockb", "next-env.d.ts"]);
const SKIP_SUFFIXES = [".tsbuildinfo", "routeTree.gen.ts"];

// Only these extensions are treated as text and scanned.
const TEXT_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".html",
  ".md",
  ".mdx",
  ".yml",
  ".yaml",
]);

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      flags.help = true;
    } else if (arg === "--dry-run") {
      flags.dryRun = true;
    } else if (arg === "--scope" || arg === "--display") {
      flags[arg.slice(2)] = argv[++i] ?? "";
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function sanitizeScope(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9-~]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toDisplay(input: string): string {
  return input
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isTextFile(name: string): boolean {
  const dot = name.lastIndexOf(".");
  return dot !== -1 && TEXT_EXT.has(name.slice(dot));
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, files);
    } else if (
      !SKIP_FILES.has(entry) &&
      !SKIP_SUFFIXES.some((s) => entry.endsWith(s)) &&
      isTextFile(entry)
    ) {
      files.push(full);
    }
  }
  return files;
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));

  if (flags.help || positional.length === 0) {
    console.log(
      "Usage: bun scripts/rename.ts <project-name> [--scope <scope>] [--display <name>] [--dry-run]",
    );
    process.exit(flags.help ? 0 : 1);
  }

  const projectName = positional[0];
  const scope = sanitizeScope((flags.scope as string) || projectName);
  const display = (flags.display as string) || toDisplay(projectName);
  const dryRun = Boolean(flags.dryRun);

  if (!scope) {
    console.error(`✗ Could not derive a valid npm scope from "${projectName}".`);
    process.exit(1);
  }

  console.log(
    `Rebranding template → project "${projectName}"\n` +
      `  scope:   @repo/  →  @${scope}/\n` +
      `  brand:   Acme    →  ${display}\n` +
      `  root package name → ${scope}\n` +
      (dryRun ? "\n(dry run — no files will be written)\n" : ""),
  );

  const replacements: Array<[RegExp, string]> = [
    [/@repo\//g, `@${scope}/`],
    [/Acme/g, display],
  ];

  const files = walk(ROOT);
  let changedCount = 0;

  for (const file of files) {
    const original = readFileSync(file, "utf8");
    let next = original;

    // Root package.json also gets its "name" field set to the project name.
    if (file === join(ROOT, "package.json")) {
      next = next.replace(/("name":\s*)"[^"]*"/, (_m, p1) => `${p1}"${scope}"`);
    }

    for (const [pattern, value] of replacements) {
      next = next.replace(pattern, value);
    }

    if (next !== original) {
      changedCount++;
      const rel = file.slice(ROOT.length + 1);
      if (dryRun) {
        console.log(`  would update  ${rel}`);
      } else {
        writeFileSync(file, next);
        console.log(`  updated       ${rel}`);
      }
    }
  }

  console.log(`\n${dryRun ? "Would change" : "Changed"} ${changedCount} file(s).`);

  if (!dryRun) {
    console.log(
      "\nNext steps:\n" +
        "  1. bun install            # relink workspaces under the new scope\n" +
        "  2. bun run typecheck      # confirm everything resolves\n" +
        "  3. Delete scripts/rename.ts and the template section of README.md\n",
    );
  }
}

main();
