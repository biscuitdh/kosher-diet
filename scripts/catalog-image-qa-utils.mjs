import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const QA_PATH = join(process.cwd(), "lib", "catalog-recipe-image-qa.json");
export const APPROVED = "approved";
export const PENDING = "pending";
export const REJECTED = "rejected";
export const VALID_STATUSES = new Set([APPROVED, PENDING, REJECTED]);

export function readQaManifest() {
  if (!existsSync(QA_PATH)) return {};
  return JSON.parse(readFileSync(QA_PATH, "utf8"));
}

export function writeQaManifest(manifest) {
  writeFileSync(QA_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}

export function markQa(recipeId, status, note = "") {
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Invalid QA status: ${status}`);
  }

  const manifest = readQaManifest();
  manifest[recipeId] = {
    status,
    reviewedAt: new Date().toISOString(),
    note
  };
  writeQaManifest(manifest);
}
