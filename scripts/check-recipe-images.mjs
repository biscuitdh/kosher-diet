import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const registryPath = join(process.cwd(), "lib", "recipe-image-assets.json");
const manifestPath = join(process.cwd(), "public", "images", "recipes", "real", "manifest.json");

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

if (!existsSync(registryPath)) {
  fail(`Missing recipe image registry: ${registryPath}`);
  process.exit();
}

if (!existsSync(manifestPath)) {
  fail(`Missing recipe image manifest: ${manifestPath}`);
  process.exit();
}

const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const keys = new Set();

for (const asset of registry) {
  if (keys.has(asset.key)) {
    fail(`Duplicate recipe image key: ${asset.key}`);
  }
  keys.add(asset.key);

  if (!asset.path.startsWith("/images/recipes/real/") && !asset.path.startsWith("/images/recipes/ai/")) {
    fail(`Recipe image must be local to /images/recipes/real or /images/recipes/ai: ${asset.key}`);
  }

  const localPath = join(process.cwd(), "public", asset.path);
  if (!existsSync(localPath)) {
    fail(`Missing local recipe image file for ${asset.key}: ${localPath}`);
  }

  if (asset.sourceType !== "generated" && (!asset.sourceUrl || !asset.attribution || !asset.license)) {
    fail(`Sourced image ${asset.key} must include sourceUrl`);
  }
}

const walleyeAssets = registry.filter((asset) => asset.mainMatches.includes("walleye"));
const passoverWalleyeAssets = walleyeAssets.filter((asset) => asset.passoverSafe);

if (registry.length < 80 || registry.length > 120) {
  fail(`Expected 80-120 recipe image assets, found ${registry.length}`);
}

if (walleyeAssets.length < 12) {
  fail(`Expected at least 12 walleye image assets, found ${walleyeAssets.length}`);
}

if (passoverWalleyeAssets.length < 6) {
  fail(`Expected at least 6 Passover-safe walleye image assets, found ${passoverWalleyeAssets.length}`);
}

if (process.exitCode) {
  process.exit();
}

console.log(`Recipe image registry OK: ${registry.length} assets, ${walleyeAssets.length} walleye, ${passoverWalleyeAssets.length} Passover walleye.`);
