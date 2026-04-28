import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { APPROVED, readQaManifest } from "./catalog-image-qa-utils.mjs";

const CATALOG_DIR = join(process.cwd(), "public", "images", "recipes", "catalog");
const MANIFEST_PATH = join(process.cwd(), "lib", "catalog-recipe-images.json");
const recipeIdPattern = /^catalog-\d{4}\.webp$/;
const includePending = process.argv.includes("--include-pending");

mkdirSync(CATALOG_DIR, { recursive: true });

const qaManifest = readQaManifest();
const manifest = Object.fromEntries(
  readdirSync(CATALOG_DIR)
    .filter((file) => recipeIdPattern.test(file) && existsSync(join(CATALOG_DIR, file)))
    .filter((file) => includePending || qaManifest[file.replace(/\.webp$/, "")]?.status === APPROVED)
    .sort()
    .map((file) => {
      const recipeId = file.replace(/\.webp$/, "");
      return [recipeId, `/images/recipes/catalog/${file}`];
    })
);

writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Catalog recipe image manifest written: ${MANIFEST_PATH}`);
console.log(`Catalog recipe images: ${Object.keys(manifest).length}`);
if (!includePending) {
  console.log("Only QA-approved catalog recipe images were included. Use --include-pending for local debugging only.");
}
