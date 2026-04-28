import recipeImageAssetsJson from "@/lib/recipe-image-assets.json";

export type RecipeImageSourceType = "generated" | "pexels" | "unsplash" | "wikimedia";

export type RecipeImageAsset = {
  key: string;
  path: string;
  placeholderPath?: string;
  targetRasterPath?: string | null;
  reviewStatus?: string;
  sourceType: RecipeImageSourceType;
  mainMatches: string[];
  familyMatches: string[];
  baseMatches: string[];
  flavorMatches: string[];
  passoverSafe: boolean;
  subject: string;
  prompt: string;
  attribution: string | null;
  sourceUrl: string | null;
  license: string | null;
};

export type RecipeImageContext = {
  mainTitle: string;
  mainFamily: string;
  baseTitle: string;
  flavorTitle: string;
  kosherForPassover: boolean;
  index: number;
};

const recipeImageAssets = recipeImageAssetsJson as RecipeImageAsset[];

export function isRasterRecipeImagePath(path: string) {
  return /\.(?:webp|png|jpe?g)$/i.test(path);
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function matchScore(values: string[], target: string, exactWeight: number, partialWeight: number) {
  const normalizedTarget = normalize(target);
  return values.reduce((score, value) => {
    const normalizedValue = normalize(value);
    if (!normalizedValue || !normalizedTarget) return score;
    if (normalizedTarget === normalizedValue) return score + exactWeight;
    if (normalizedTarget.includes(normalizedValue) || normalizedValue.includes(normalizedTarget)) {
      return score + partialWeight;
    }
    return score;
  }, 0);
}

function scoreAsset(asset: RecipeImageAsset, context: RecipeImageContext) {
  if (context.kosherForPassover && !asset.passoverSafe) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;
  score += matchScore(asset.mainMatches, context.mainTitle, 140, 105);
  score += matchScore(asset.familyMatches, context.mainFamily, 40, 28);
  score += matchScore(asset.baseMatches, context.baseTitle, 26, 18);
  score += matchScore(asset.flavorMatches, context.flavorTitle, 18, 12);

  if (context.kosherForPassover && asset.passoverSafe) score += 42;
  if (!context.kosherForPassover && !asset.passoverSafe) score += 4;
  if (asset.path.startsWith("/images/recipes/ai/") && isRasterRecipeImagePath(asset.path)) score += 260;
  else if (asset.path.startsWith("/images/recipes/ai/")) score += 130;
  if (asset.sourceType === "generated") score += 18;
  if (asset.sourceType === "wikimedia") score += 12;

  const noise = stableHash(`${context.index}:${asset.key}`) / 0xffffffff;
  return score + noise;
}

export function listRecipeImageAssets() {
  return recipeImageAssets;
}

export function findRecipeImageAssetByKey(key: string) {
  return recipeImageAssets.find((asset) => asset.key === key);
}

export function rankRecipeImageAssets(context: RecipeImageContext, assets: RecipeImageAsset[] = recipeImageAssets) {
  return [...assets].sort((a, b) => {
    const scoreDelta = scoreAsset(b, context) - scoreAsset(a, context);
    return scoreDelta || a.key.localeCompare(b.key);
  });
}

export function selectRecipeImageAsset(context: RecipeImageContext) {
  return rankRecipeImageAssets(context)[0];
}
