import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { extname, join, parse } from "node:path";
import { execFileSync } from "node:child_process";
import { markQa, PENDING } from "./catalog-image-qa-utils.mjs";

const CATALOG_DIR = join(process.cwd(), "public", "images", "recipes", "catalog");
const DEFAULT_SOURCE_DIR = join(CATALOG_DIR, "incoming");
const recipeIdPattern = /^catalog-\d{4}$/;
const sourceExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function readListArg(name) {
  const raw = readArg(name, "");
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.startsWith("catalog-") ? item : `catalog-${String(Number(item)).padStart(4, "0")}`));
}

const sourceDir = readArg("source", DEFAULT_SOURCE_DIR);
const ids = readListArg("ids");
const force = process.argv.includes("--force");
mkdirSync(CATALOG_DIR, { recursive: true });
mkdirSync(sourceDir, { recursive: true });

const sourceFiles = readdirSync(sourceDir)
  .filter((file) => sourceExtensions.has(extname(file).toLowerCase()))
  .filter((file) => recipeIdPattern.test(parse(file).name))
  .filter((file) => !ids.length || ids.includes(parse(file).name))
  .sort();

let imported = 0;
let skipped = 0;

for (const file of sourceFiles) {
  const recipeId = parse(file).name;
  const sourcePath = join(sourceDir, file);
  const targetPath = join(CATALOG_DIR, `${recipeId}.webp`);
  const resizedPngPath = join(CATALOG_DIR, `${recipeId}.resized.tmp.png`);

  if (existsSync(targetPath) && !force) {
    skipped += 1;
    console.log(`skip existing ${recipeId}.webp`);
    continue;
  }

  const pngBytes = execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    sourcePath,
    "-vf",
    "crop=w='min(iw,ih*4/3)':h='min(ih,iw*3/4)',scale=320:240",
    "-f",
    "image2pipe",
    "-vcodec",
    "png",
    "-"
  ]);

  writeFileSync(resizedPngPath, pngBytes);
  execFileSync("cwebp", ["-quiet", "-q", "70", resizedPngPath, "-o", targetPath]);
  rmSync(resizedPngPath, { force: true });
  markQa(recipeId, PENDING, "Imported and waiting for contact-sheet review.");
  imported += 1;
  console.log(`imported ${recipeId}.webp`);
}

console.log(`Catalog image import complete: ${imported} imported, ${skipped} skipped, source=${sourceDir}`);
