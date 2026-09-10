/**
 * Enforces the import rules in `services/api/AGENTS.md` over `services/api/src`. No dependencies:
 * `Bun.Glob` walks the tree, `Bun.Transpiler` lists the imports, `Bun.resolveSync` turns each
 * specifier into a file, so the rules judge the resolved path and every spelling of an import is
 * caught. Run by the workspace `check`, which the root `check` chains after Biome.
 */
import { dirname, relative, resolve } from "node:path";

const SRC = resolve(import.meta.dir, "../src");

const FEATURE_LAYERS = ["routes", "model", "service", "repository", "emails", "jobs"] as const;
type FeatureLayer = (typeof FEATURE_LAYERS)[number];
type Layer = FeatureLayer | "plugin" | "entrypoint" | "other";

/** What a file may import of a feature - its own, and another's when the target is `service`. */
const MAY_IMPORT: Record<FeatureLayer, readonly FeatureLayer[]> = {
  routes: ["service", "model"],
  service: ["repository", "model", "emails", "service"],
  repository: ["model"],
  jobs: ["service", "model"],
  emails: ["model"],
  model: [],
};

type Site = { layer: Layer; feature?: string; test: boolean };

/** A file's place in the rules. Path only: `service/nudge.ts` and `service.test.ts` are `service`. */
function siteOf(path: string): Site {
  const test = path.endsWith(".test.ts");
  const [first, second, third] = path.split("/");
  if (first === "entrypoints") return { layer: "entrypoint", test };
  if (first === "plugins") return { layer: "plugin", test };
  if (first === "features" && second && third) {
    const name = third.replace(/(\.test)?\.ts$/, "");
    return { layer: FEATURE_LAYERS.find((l) => l === name) ?? "other", feature: second, test };
  }
  return { layer: "other", test };
}

const isFeatureLayer = (layer: Layer): layer is FeatureLayer =>
  FEATURE_LAYERS.some((l) => l === layer);

/** The rule the import breaks, or nothing when it is legal. `to` is null for a package import. */
function judge(from: Site, to: Site | null, specifier: string): string | undefined {
  if (/^elysia(\/|$)/.test(specifier) && !isElysiaCaller(from)) {
    return "elysia is imported from routes.ts, model.ts, plugins/ and entrypoints/ only";
  }
  if (!to) return; // any @repo/* package is legal anywhere in the service
  if (from.layer === "entrypoint") return; // an entry point imports anything

  if (to.layer === "entrypoint") {
    if (from.test) return; // a route test builds the app it drives
    return "an entry point is imported by nothing but a test";
  }
  if (from.layer === "plugin") {
    if (to.feature) return "plugins/ never imports features/";
    if (to.layer === "plugin") return "plugins/ imports packages and elysia";
  }
  if (to.layer === "plugin" && from.layer !== "routes") {
    return "plugins/ is imported from routes.ts and entrypoints/ only";
  }
  if (!from.feature || !to.feature) return;

  const allowed = isFeatureLayer(from.layer) ? MAY_IMPORT[from.layer] : [];
  if (from.feature === to.feature && from.layer === to.layer) return; // one layer split over files
  if (from.feature !== to.feature) {
    // both ends of a cross-feature import are service.ts, which is what earns a feature one
    if (from.test && to.layer === "service") return; // a test builds fixtures through it
    if (from.layer !== "service" || to.layer !== "service") {
      return "a feature reaches another feature from its service.ts to that feature's service.ts";
    }
  }
  if (!isFeatureLayer(to.layer) || !allowed.includes(to.layer)) {
    return `${from.layer} may import ${allowed.join(", ") || "nothing"} of a feature`;
  }
}

const isElysiaCaller = ({ layer }: Site) =>
  layer === "routes" || layer === "model" || layer === "plugin" || layer === "entrypoint";

const transpiler = new Bun.Transpiler({ loader: "ts" });
const violations: string[] = [];
const report = (path: string, subject: string, rule: string) =>
  violations.push(`${relative(process.cwd(), `${SRC}/${path}`)}\n  ${subject}\n  ${rule}`);

for (const path of new Bun.Glob("**/*.ts").scanSync(SRC)) {
  const from = siteOf(path);
  const absolute = `${SRC}/${path}`;
  const source = await Bun.file(absolute).text();

  // a test at these layers is an edge: it supplies the now its subject takes
  if (!from.test && (from.layer === "service" || from.layer === "repository")) {
    const clock = source.match(/\bnew Date\(|\bDate\.now\(/)?.[0];
    if (clock)
      report(path, clock, "a rule takes now: Date from an edge file; only edges read the clock");
  }

  for (const { path: specifier } of transpiler.scanImports(source)) {
    let resolved: string;
    try {
      resolved = Bun.resolveSync(specifier, dirname(absolute));
    } catch {
      // bun:test, a type-only package, anything with no file on disk: nothing to judge
      resolved = "";
    }
    const inside = resolved && relative(SRC, resolved);
    const to = inside && !inside.startsWith("..") ? siteOf(inside) : null;
    const rule = judge(from, to, specifier);
    if (rule) report(path, `imports ${specifier}`, rule);
  }
}

if (violations.length > 0) {
  console.error(
    `services/api: ${violations.length} import rule violation(s):\n\n${violations.join("\n\n")}`,
  );
  process.exit(1);
}
console.log("services/api: import rules hold");
