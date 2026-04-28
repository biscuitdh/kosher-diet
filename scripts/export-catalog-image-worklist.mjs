import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { listCatalogRecipes } from "../lib/catalog.ts";

const CATALOG_DIR = join(process.cwd(), "public", "images", "recipes", "catalog");
const WORKLIST_DIR = join(CATALOG_DIR, "worklists");
const DEFAULT_BATCH_SIZE = 50;
const FORBIDDEN_VISUALS =
  "No tomatoes, peppers, white potatoes, eggplant, paprika-heavy red seasoning, cayenne, pork, shellfish, text, logos, packaging, people, or hands.";

function readNumberArg(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return value;
}

function imageExists(recipeId) {
  return existsSync(join(CATALOG_DIR, `${recipeId}.webp`));
}

function recipePrompt(record) {
  const mainIngredient = record.catalog.main;
  const baseIngredient = record.catalog.base;
  const ingredients = record.recipe.ingredients
    .filter((ingredient) => !ingredient.pantryStaple)
    .slice(0, 7)
    .map((ingredient) => ingredient.shoppingName ?? ingredient.name.replace(/\([^)]*\)/g, "").trim())
    .join(", ");

  return [
    "Create a simple photorealistic thumbnail image for KosherTable.",
    "Final app use is a 320x240 recipe card thumbnail, so use clean moderate detail, not ultra high resolution.",
    `Recipe: ${record.recipe.title}.`,
    `The visually dominant food must be ${mainIngredient}. Do not substitute a different protein or make the main ingredient ambiguous.`,
    `Secondary side or base: ${baseIngredient}. Keep it visibly separate from the main ingredient when possible.`,
    `Kosher type: ${record.recipe.kosherType}.`,
    `Cuisine and occasion: ${record.catalog.cuisine}, ${record.catalog.occasion}.`,
    record.catalog.kosherForPassover ? "Kosher for Passover strict no-kitniyot visual style." : "Regular kosher weeknight visual style.",
    `Main ingredients to show: ${ingredients}.`,
    "Make this image visually distinct with a specific plate angle, plate style, table surface, garnish layout, and side placement.",
    "Avoid making neighboring fish, meat, dairy, or vegetable thumbnails look like the same generic plate.",
    "Use a 4:3 horizontal crop, plated for two, no close-up hands, no labels.",
    FORBIDDEN_VISUALS,
    record.recipe.kosherType === "meat" ? "Kosher meat plate: no dairy, no cheese, no butter, no cream, no yogurt." : "",
    record.recipe.kosherType === "dairy" ? "Kosher dairy plate: no meat or fish." : "",
    record.recipe.kosherType === "parve" ? "Kosher parve plate." : ""
  ]
    .filter(Boolean)
    .join(" ");
}

mkdirSync(WORKLIST_DIR, { recursive: true });

const batchSize = readNumberArg("batch-size", DEFAULT_BATCH_SIZE);
const startAt = readNumberArg("start-at", 1);
const recipes = listCatalogRecipes();
const missing = recipes.filter((record) => Number(record.id.replace("catalog-", "")) >= startAt && !imageExists(record.id));
const batch = missing.slice(0, batchSize);

if (!batch.length) {
  console.log("No missing catalog recipe images found for this range.");
  process.exit(0);
}

const first = batch[0].id;
const last = batch.at(-1).id;
const outputPath = join(WORKLIST_DIR, `${first}-${last}.json`);
const latestPath = join(WORKLIST_DIR, "latest.json");
const payload = {
  generatedAt: new Date().toISOString(),
  batchSize,
  count: batch.length,
  firstRecipeId: first,
  lastRecipeId: last,
  instructions: [
    "Generate one image per item.",
    "Save raw outputs anywhere convenient, then convert/copy final thumbnails to targetPath.",
    "Final target must be 320x240 WebP.",
    "Do not overwrite existing targetPath unless intentionally regenerating that exact recipe.",
    "After importing, run npm run images:catalog:manifest and npm run images:check."
  ],
  items: batch.map((record) => ({
    recipeId: record.id,
    title: record.recipe.title,
    targetFilename: `${record.id}.webp`,
    targetPath: `/images/recipes/catalog/${record.id}.webp`,
    localTargetPath: join("public", "images", "recipes", "catalog", `${record.id}.webp`),
    kosherForPassover: record.catalog.kosherForPassover,
    kosherType: record.recipe.kosherType,
    prompt: recipePrompt(record)
  }))
};

writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
writeFileSync(latestPath, `${JSON.stringify(payload, null, 2)}\n`);

console.log(`Catalog image worklist written: ${outputPath}`);
console.log(`Latest worklist updated: ${latestPath}`);
console.log(`Items: ${payload.count}; first: ${first}; last: ${last}`);
console.log(`Next target example: ${basename(payload.items[0].localTargetPath)}`);
