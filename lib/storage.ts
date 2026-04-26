"use client";

import { RECIPE_IMAGE_PLACEHOLDERS, STORAGE_KEYS } from "@/lib/constants";
import {
  recipeRecordSchema,
  savedRecipeSchema,
  type Recipe,
  type RecipeRecord,
  type SavedRecipe
} from "@/lib/schemas";

type RateLimitState = {
  timestamps: number[];
};

const CLIENT_AI_LIMIT = {
  maxRequests: 5,
  windowMs: 10 * 60 * 1000
};

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadSavedRecipes(): SavedRecipe[] {
  const records = readJson<unknown[]>(STORAGE_KEYS.savedRecipes, []);
  return records.flatMap((record) => {
    const parsed = savedRecipeSchema.safeParse(record);
    return parsed.success ? [parsed.data] : [];
  });
}

export function saveSavedRecipes(recipes: SavedRecipe[]) {
  writeJson(STORAGE_KEYS.savedRecipes, recipes.map((recipe) => savedRecipeSchema.parse(recipe)));
}

export function loadGeneratedRecipes(): RecipeRecord[] {
  const records = readJson<unknown[]>(STORAGE_KEYS.generatedRecipes, []);
  return records.flatMap((record) => {
    const parsed = recipeRecordSchema.safeParse(record);
    return parsed.success ? [parsed.data] : [];
  });
}

export function saveGeneratedRecipes(recipes: RecipeRecord[]) {
  writeJson(STORAGE_KEYS.generatedRecipes, recipes.map((recipe) => recipeRecordSchema.parse(recipe)));
}

export function createRecipeRecord(recipe: Recipe, source: SavedRecipe["source"] = "generated"): RecipeRecord {
  const now = new Date().toISOString();
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const imagePath = RECIPE_IMAGE_PLACEHOLDERS[Math.floor(Math.random() * RECIPE_IMAGE_PLACEHOLDERS.length)];

  return recipeRecordSchema.parse({
    id,
    recipe,
    createdAt: now,
    updatedAt: now,
    imagePath,
    source,
    safetyBadge: "Nightshade & Tomato Safe ✅"
  });
}

export function upsertGeneratedRecipe(record: RecipeRecord) {
  const existing = loadGeneratedRecipes().filter((recipe) => recipe.id !== record.id);
  saveGeneratedRecipes([record, ...existing].slice(0, 50));
}

export function upsertSavedRecipe(record: SavedRecipe) {
  const existing = loadSavedRecipes().filter((recipe) => recipe.id !== record.id);
  saveSavedRecipes([record, ...existing].slice(0, 100));
}

export function removeSavedRecipe(id: string) {
  saveSavedRecipes(loadSavedRecipes().filter((recipe) => recipe.id !== id));
}

export function findRecipeById(id: string): RecipeRecord | SavedRecipe | undefined {
  return [...loadGeneratedRecipes(), ...loadSavedRecipes()].find((record) => record.id === id);
}

export function checkClientAiRateLimit(now = Date.now()) {
  const state = readJson<RateLimitState>(STORAGE_KEYS.aiRateLimit, { timestamps: [] });
  const timestamps = state.timestamps.filter((timestamp) => now - timestamp < CLIENT_AI_LIMIT.windowMs);
  const remaining = Math.max(0, CLIENT_AI_LIMIT.maxRequests - timestamps.length);
  const resetAt = timestamps.length > 0 ? timestamps[0] + CLIENT_AI_LIMIT.windowMs : now;

  return {
    allowed: remaining > 0,
    remaining,
    resetAt
  };
}

export function recordClientAiCall(now = Date.now()) {
  const state = readJson<RateLimitState>(STORAGE_KEYS.aiRateLimit, { timestamps: [] });
  const timestamps = state.timestamps
    .filter((timestamp) => now - timestamp < CLIENT_AI_LIMIT.windowMs)
    .concat(now)
    .slice(-CLIENT_AI_LIMIT.maxRequests);
  writeJson(STORAGE_KEYS.aiRateLimit, { timestamps });
}
