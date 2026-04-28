import { existsSync } from "node:fs";
import { join } from "node:path";
import { markQa, readQaManifest, VALID_STATUSES } from "./catalog-image-qa-utils.mjs";

const CATALOG_DIR = join(process.cwd(), "public", "images", "recipes", "catalog");
const recipeIdPattern = /^catalog-\d{4}$/;

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function parseRecipeIds(value) {
  if (!value) return [];
  if (/^\d+\-\d+$/.test(value)) {
    const [start, end] = value.split("-").map(Number);
    return Array.from({ length: end - start + 1 }, (_, index) => `catalog-${String(start + index).padStart(4, "0")}`);
  }
  return value.split(",").map((item) => {
    const trimmed = item.trim();
    return /^\d+$/.test(trimmed) ? `catalog-${trimmed.padStart(4, "0")}` : trimmed;
  });
}

const status = readArg("status");
const ids = parseRecipeIds(readArg("ids"));
const note = readArg("note");
const summary = process.argv.includes("--summary");

if (summary) {
  const manifest = readQaManifest();
  const counts = { approved: 0, pending: 0, rejected: 0, missing: 0 };
  for (const [recipeId, entry] of Object.entries(manifest)) {
    if (!existsSync(join(CATALOG_DIR, `${recipeId}.webp`))) counts.missing += 1;
    else if (counts[entry.status] !== undefined) counts[entry.status] += 1;
  }
  console.log(JSON.stringify(counts, null, 2));
  process.exit(0);
}

if (!VALID_STATUSES.has(status)) {
  throw new Error("--status must be approved, pending, or rejected");
}

if (!ids.length) {
  throw new Error("--ids is required. Use --ids=1-50 or --ids=catalog-0001,catalog-0002");
}

for (const recipeId of ids) {
  if (!recipeIdPattern.test(recipeId)) {
    throw new Error(`Invalid recipe id: ${recipeId}`);
  }
  const imagePath = join(CATALOG_DIR, `${recipeId}.webp`);
  if (!existsSync(imagePath)) {
    throw new Error(`Cannot mark ${recipeId}; missing image ${imagePath}`);
  }
  markQa(recipeId, status, note);
  console.log(`${status} ${recipeId}`);
}
