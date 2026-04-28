import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const CATALOG_DIR = join(process.cwd(), "public", "images", "recipes", "catalog");
const CONTACT_DIR = join(CATALOG_DIR, "contact-sheets");
const recipeFilePattern = /^catalog-\d{4}\.webp$/;

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

mkdirSync(CONTACT_DIR, { recursive: true });

const startAt = readNumberArg("start-at", 1);
const limit = readNumberArg("limit", 50);
const files = readdirSync(CATALOG_DIR)
  .filter((file) => recipeFilePattern.test(file))
  .filter((file) => Number(file.match(/\d{4}/)?.[0]) >= startAt)
  .sort()
  .slice(0, limit);

if (!files.length) {
  console.log("No catalog images found for contact sheet.");
  process.exit(0);
}

const first = files[0].replace(/\.webp$/, "");
const last = files.at(-1).replace(/\.webp$/, "");
const concatPath = join(CONTACT_DIR, `${first}-${last}.txt`);
const outputPath = join(CONTACT_DIR, `${first}-${last}.png`);

writeFileSync(concatPath, files.map((file) => `file '${resolve(CATALOG_DIR, file).replace(/'/g, "'\\''")}'`).join("\n") + "\n");
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatPath,
    "-vf",
    "tile=10x5:margin=8:padding=4:color=0x10201cff",
    "-frames:v",
    "1",
    outputPath
  ],
  { stdio: "inherit" }
);

console.log(`Catalog contact sheet written: ${outputPath}`);
