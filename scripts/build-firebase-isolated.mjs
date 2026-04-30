import { spawnSync } from "node:child_process";
import { existsSync, cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const workspaceParent = path.join(repoRoot, ".build-workspaces");
mkdirSync(workspaceParent, { recursive: true });
const workspaceRoot = mkdtempSync(path.join(workspaceParent, "firebase-"));
const workspace = path.join(workspaceRoot, "workspace");

const excludedRootEntries = new Set([
  ".git",
  ".build-workspaces",
  ".next",
  ".next-export",
  ".next-build-check",
  ".next-firebase-export",
  "coverage",
  "node_modules",
  "out",
  "playwright-report",
  "test-results"
]);

const excludedNestedEntries = new Set(["node_modules", ".expo"]);

function shouldCopy(source) {
  const relativePath = path.relative(repoRoot, source);
  if (!relativePath) return true;
  const parts = relativePath.split(path.sep);
  if (parts.length === 1 && excludedRootEntries.has(parts[0])) return false;
  return !parts.some((part, index) => index > 0 && excludedNestedEntries.has(part));
}

function runNextBuild(env) {
  const nextBin = path.join(workspace, "node_modules", ".bin", "next");
  const result = spawnSync(nextBin, ["build"], {
    cwd: workspace,
    env: { ...process.env, ...env },
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    throw new Error("next build failed");
  }
}

function replaceOutput(name, targetName = name) {
  const source = path.join(workspace, name);
  const target = path.join(repoRoot, targetName);
  if (!existsSync(source)) return;
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
}

try {
  mkdirSync(workspace, { recursive: true });
  for (const entry of readdirSync(repoRoot)) {
    const source = path.join(repoRoot, entry);
    if (!shouldCopy(source)) continue;
    cpSync(source, path.join(workspace, entry), {
      recursive: true,
      filter: shouldCopy
    });
  }

  symlinkSync(path.join(repoRoot, "node_modules"), path.join(workspace, "node_modules"), "dir");

  runNextBuild({
    NEXT_OUTPUT_EXPORT: "true",
    NEXT_PUBLIC_BASE_PATH: "",
    NEXT_DIST_DIR: ".next-firebase-export",
    NEXT_OUTPUT_TRACING_ROOT: workspace
  });
  replaceOutput(".next-firebase-export");
  replaceOutput(".next-firebase-export", "out");
} finally {
  if (process.env.KEEP_BUILD_WORKSPACE !== "1") {
    rmSync(workspaceRoot, { recursive: true, force: true });
  } else {
    console.log(`Kept build workspace at ${workspaceRoot}`);
  }
}
