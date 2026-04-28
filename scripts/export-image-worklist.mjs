import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const REGISTRY_PATH = join(process.cwd(), "lib", "recipe-image-assets.json");
const OUT_DIR = join(process.cwd(), "public", "images", "recipes", "ai");
const OUT_PATH = join(OUT_DIR, "apple-creative-studio-worklist.json");

const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
const workItems = registry
  .filter((asset) => asset.targetRasterPath)
  .map((asset, index) => ({
    order: index + 1,
    key: asset.key,
    targetFilename: basename(asset.targetRasterPath),
    targetPath: asset.targetRasterPath,
    currentPlaceholderPath: asset.placeholderPath ?? asset.path,
    reviewStatus: asset.reviewStatus ?? "pending-external-generation",
    subject: asset.subject,
    prompt: asset.prompt,
    mainMatches: asset.mainMatches,
    familyMatches: asset.familyMatches,
    baseMatches: asset.baseMatches,
    flavorMatches: asset.flavorMatches,
    passoverSafe: asset.passoverSafe
  }));

const manifest = {
  generatedAt: "2026-04-27T00:00:00.000Z",
  workflow: "Apple Creative Studio external image handoff",
  outputDirectory: "public/images/recipes/ai",
  preferredExportFormat: "webp",
  aspectRatio: "4:3",
  importInstructions: [
    "Generate one image per work item using the prompt verbatim or with only minor composition refinements.",
    "Export as WebP when possible; PNG is acceptable if WebP is unavailable.",
    "Save each finished image using targetFilename directly inside public/images/recipes/ai.",
    "After importing files, run npm run images:recipes so the registry points at raster images instead of SVG placeholders.",
    "Run npm run images:check before previewing."
  ],
  visualRules: [
    "Photorealistic plated meal for two.",
    "Warm Jewish home-cooking table setting.",
    "No tomatoes, peppers, white potatoes, eggplant, paprika, cayenne, pork, shellfish, text, logos, or people.",
    "No meat and dairy visual mixing.",
    "Passover-safe items must not show bread, pasta, rice, corn, beans, lentils, chickpeas, soy/tofu, sesame/tahini, or kitniyot-style sides."
  ],
  items: workItems
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Wrote ${workItems.length} image work items to ${OUT_PATH}`);
