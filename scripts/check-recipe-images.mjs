import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const registryPath = join(process.cwd(), "lib", "recipe-image-assets.json");
const catalogImageManifestPath = join(process.cwd(), "lib", "catalog-recipe-images.json");
const catalogImageQaPath = join(process.cwd(), "lib", "catalog-recipe-image-qa.json");
const manifestPath = join(process.cwd(), "public", "images", "recipes", "real", "manifest.json");
const worklistPath = join(process.cwd(), "public", "images", "recipes", "ai", "apple-creative-studio-worklist.json");

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

if (!existsSync(registryPath)) {
  fail(`Missing recipe image registry: ${registryPath}`);
  process.exit();
}

if (!existsSync(catalogImageManifestPath)) {
  fail(`Missing catalog recipe image manifest: ${catalogImageManifestPath}`);
  process.exit();
}

if (!existsSync(catalogImageQaPath)) {
  fail(`Missing catalog recipe image QA manifest: ${catalogImageQaPath}`);
  process.exit();
}

if (!existsSync(manifestPath)) {
  fail(`Missing recipe image manifest: ${manifestPath}`);
  process.exit();
}

if (!existsSync(worklistPath)) {
  fail(`Missing external image worklist: ${worklistPath}`);
  process.exit();
}

const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const catalogImageManifest = JSON.parse(readFileSync(catalogImageManifestPath, "utf8"));
const catalogImageQa = JSON.parse(readFileSync(catalogImageQaPath, "utf8"));
const worklist = JSON.parse(readFileSync(worklistPath, "utf8"));
const keys = new Set();
const rasterPathPattern = /^\/images\/recipes\/ai\/.+\.(?:webp|png|jpe?g)$/i;
const catalogRasterPathPattern = /^\/images\/recipes\/catalog\/catalog-\d{4}\.webp$/i;
const catalogRecipeIdPattern = /^catalog-\d{4}$/;

function readWebpDimensions(filePath) {
  const bytes = readFileSync(filePath);
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }

  const chunkType = bytes.toString("ascii", 12, 16);
  if (chunkType === "VP8X") {
    return {
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3)
    };
  }

  if (chunkType === "VP8L") {
    const b0 = bytes[21];
    const b1 = bytes[22];
    const b2 = bytes[23];
    const b3 = bytes[24];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))
    };
  }

  if (chunkType === "VP8 ") {
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff
    };
  }

  return null;
}

for (const asset of registry) {
  if (keys.has(asset.key)) {
    fail(`Duplicate recipe image key: ${asset.key}`);
  }
  keys.add(asset.key);

  if (!asset.path.startsWith("/images/recipes/real/") && !asset.path.startsWith("/images/recipes/ai/")) {
    fail(`Recipe image must be local to /images/recipes/real or /images/recipes/ai: ${asset.key}`);
  }

  if (asset.targetRasterPath && !rasterPathPattern.test(asset.targetRasterPath)) {
    fail(`Target raster path must be a local AI PNG/WebP/JPEG path for ${asset.key}: ${asset.targetRasterPath}`);
  }

  if (/^https?:\/\//i.test(asset.path) || /^https?:\/\//i.test(asset.targetRasterPath ?? "")) {
    fail(`Recipe image paths must not be remote hotlinks: ${asset.key}`);
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
const importedRasterAssets = registry.filter((asset) => rasterPathPattern.test(asset.path));

if (registry.length < 80 || registry.length > 120) {
  fail(`Expected 80-120 recipe image assets, found ${registry.length}`);
}

if (walleyeAssets.length < 12) {
  fail(`Expected at least 12 walleye image assets, found ${walleyeAssets.length}`);
}

if (passoverWalleyeAssets.length < 6) {
  fail(`Expected at least 6 Passover-safe walleye image assets, found ${passoverWalleyeAssets.length}`);
}

if (!Array.isArray(worklist.items) || worklist.items.length < 20) {
  fail(`Expected at least 20 external image worklist items, found ${worklist.items?.length ?? 0}`);
}

for (const item of worklist.items ?? []) {
  if (!rasterPathPattern.test(item.targetPath)) {
    fail(`Worklist item ${item.key} has invalid local target path: ${item.targetPath}`);
  }
  if (!item.prompt || !/No tomatoes, peppers, white potatoes, eggplant, paprika, cayenne, pork, shellfish/i.test(item.prompt)) {
    fail(`Worklist item ${item.key} is missing the forbidden-ingredient visual prompt`);
  }
}

for (const [recipeId, imagePath] of Object.entries(catalogImageManifest)) {
  if (!catalogRecipeIdPattern.test(recipeId)) {
    fail(`Catalog recipe image manifest has invalid recipe id: ${recipeId}`);
    continue;
  }

  if (!catalogRasterPathPattern.test(imagePath)) {
    fail(`Catalog recipe image path must be a local catalog WebP path for ${recipeId}: ${imagePath}`);
    continue;
  }

  if (/^https?:\/\//i.test(imagePath)) {
    fail(`Catalog recipe image path must not be remote: ${recipeId}`);
    continue;
  }

  const localPath = join(process.cwd(), "public", imagePath);
  if (!existsSync(localPath)) {
    fail(`Missing catalog recipe image file for ${recipeId}: ${localPath}`);
    continue;
  }

  const dimensions = readWebpDimensions(localPath);
  if (!dimensions) {
    fail(`Catalog recipe image is not a valid readable WebP: ${localPath}`);
    continue;
  }

  if (dimensions.width !== 320 || dimensions.height !== 240) {
    fail(`Catalog recipe image must be 320x240: ${recipeId} is ${dimensions.width}x${dimensions.height}`);
  }

  if (catalogImageQa[recipeId]?.status !== "approved") {
    fail(`Catalog recipe image appears in app manifest without approved QA status: ${recipeId}`);
  }
}

if (process.exitCode) {
  process.exit();
}

console.log(
  `Recipe image registry OK: ${registry.length} assets, ${walleyeAssets.length} walleye, ${passoverWalleyeAssets.length} Passover walleye, ${importedRasterAssets.length} imported rasters, ${worklist.items.length} worklist items, ${Object.keys(catalogImageManifest).length} catalog recipe images.`
);
