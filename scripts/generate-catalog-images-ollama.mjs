import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

const DEFAULT_WORKLIST = join(process.cwd(), "public", "images", "recipes", "catalog", "worklists", "latest.json");
const DEFAULT_OUT_DIR = join(process.cwd(), "public", "images", "recipes", "catalog", "incoming");
const DEFAULT_REPORT_DIR = join(process.cwd(), "public", "images", "recipes", "catalog", "worklists");
const DEFAULT_BASE_URL = "http://localhost:11434";

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function readNumberArg(name, fallback) {
  const raw = readArg(name, "");
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return value;
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

function normalizeBase64(value) {
  const marker = "base64,";
  return value.includes(marker) ? value.slice(value.indexOf(marker) + marker.length) : value;
}

function ingredientSpecificPrompt(item) {
  const title = `${item.title ?? ""} ${item.prompt ?? ""}`.toLowerCase();
  if (title.includes("duck breast")) {
    return "Duck breast must look like seared duck breast with browned skin or sliced medium-dark poultry, not fish, not chicken thighs, and not a generic white fillet.";
  }
  if (title.includes("tuna steak") || title.includes("tuna steaks")) {
    return "Tuna must look like a thick tuna steak cut, lightly seared with a firm steak shape and pinkish interior or deep tuna color, not white fish, cod, chicken, or generic fillet.";
  }
  if (title.includes("ground beef")) {
    return "Ground beef must look like browned crumbled beef as the dominant food, not grains or vegetables.";
  }
  if (title.includes("beef stew")) {
    return "Beef stew meat must look like browned beef chunks as the dominant food, not mushrooms or vegetables.";
  }
  return "";
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 500)}`);
  }

  if (!response.ok) {
    throw new Error(`Ollama request failed ${response.status}: ${JSON.stringify(json).slice(0, 800)}`);
  }

  return json;
}

const worklistPath = readArg("worklist", DEFAULT_WORKLIST);
const outDir = readArg("out", DEFAULT_OUT_DIR);
const reportDir = readArg("report-dir", DEFAULT_REPORT_DIR);
const baseUrl = readArg("base-url", DEFAULT_BASE_URL).replace(/\/+$/, "");
const model = readArg("model", "x/z-image-turbo");
const size = readArg("size", "320x240");
const quality = readArg("quality", "low");
const limit = readNumberArg("limit", 10);
const startAt = readNumberArg("start-at", 1);
const ids = readListArg("ids");
const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");

mkdirSync(outDir, { recursive: true });
mkdirSync(reportDir, { recursive: true });

const worklist = JSON.parse(readFileSync(worklistPath, "utf8"));
const allItems = worklist.items ?? [];
const items = ids.length
  ? ids.map((id) => {
      const item = allItems.find((entry) => entry.recipeId === id);
      if (!item) throw new Error(`Recipe ${id} was not found in ${worklistPath}`);
      return item;
    })
  : allItems
      .filter((item) => Number(String(item.recipeId).replace("catalog-", "")) >= startAt)
      .slice(0, limit);

if (!items.length) {
  console.log("No worklist items selected.");
  process.exit(0);
}

const report = {
  generatedAt: new Date().toISOString(),
  model,
  size,
  quality,
  baseUrl,
  worklistPath,
  limit,
  startAt,
  dryRun,
  items: []
};

console.log(`Ollama catalog image run: ${items.length} items, model=${model}, size=${size}, quality=${quality}`);

for (const item of items) {
  const outputPath = join(outDir, `${item.recipeId}.png`);
  const finalCatalogPath = join(process.cwd(), item.localTargetPath);

  if (!force && (existsSync(outputPath) || existsSync(finalCatalogPath))) {
    console.log(`skip existing ${item.recipeId}`);
    report.items.push({ recipeId: item.recipeId, status: "skipped-existing", outputPath });
    continue;
  }

  const prompt = [
    item.prompt,
    ingredientSpecificPrompt(item),
    "The named recipe protein or core ingredient must be the largest and clearest item in the thumbnail.",
    "If the recipe names duck, beef, tuna, salmon, cod, walleye, eggs, tofu, mushrooms, or sweet potatoes, make that food unmistakable.",
    "Use a different camera angle, serving vessel, table surface, and side placement than the previous catalog images.",
    "Use a varied composition compared with neighboring recipe thumbnails.",
    "Do not include readable text, labels, watermarks, logos, packaging, people, or hands."
  ].join(" ");

  if (dryRun) {
    console.log(`dry-run ${item.recipeId}: ${prompt.slice(0, 180)}...`);
    report.items.push({ recipeId: item.recipeId, status: "dry-run", outputPath });
    continue;
  }

  const started = performance.now();
  const json = await postJson(`${baseUrl}/v1/images/generations`, {
    model,
    prompt,
    size,
    response_format: "b64_json",
    n: 1,
    quality
  });
  const elapsedMs = Math.round(performance.now() - started);
  const imageBase64 = json?.data?.[0]?.b64_json;

  if (!imageBase64) {
    throw new Error(`Ollama response for ${item.recipeId} did not include data[0].b64_json`);
  }

  writeFileSync(outputPath, Buffer.from(normalizeBase64(imageBase64), "base64"));
  console.log(`generated ${item.recipeId} in ${(elapsedMs / 1000).toFixed(1)}s -> ${outputPath}`);
  report.items.push({ recipeId: item.recipeId, status: "generated", elapsedMs, outputPath });
}

const reportPath = join(reportDir, `ollama-run-${Date.now()}.json`);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Ollama run report written: ${reportPath}`);
