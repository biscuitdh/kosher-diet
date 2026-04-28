"use client";

import { RECIPE_IMAGE_PLACEHOLDERS, STORAGE_KEYS } from "@/lib/constants";
import { findCatalogRecipeById } from "@/lib/catalog";
import { groceryItemFromCustomInput, groceryItemFromIngredient, mergeGroceryItem } from "@/lib/grocery";
import {
  DEFAULT_RECIPE_PROFILE_ID,
  finderSearchSchema,
  groceryListItemSchema,
  recipeProfileSchema,
  recipeRecordSchema,
  savedRecipeSchema,
  type FinderSearch,
  type GroceryListItem,
  type Recipe,
  type RecipeProfile,
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

const MAX_RECENT_SEARCHES = 8;
const MAX_SAVED_RECIPES_PER_PROFILE = 100;
const DEFAULT_RECIPE_PROFILE: RecipeProfile = recipeProfileSchema.parse({
  id: DEFAULT_RECIPE_PROFILE_ID,
  name: "Household",
  createdAt: "2026-04-28T00:00:00.000Z",
  updatedAt: "2026-04-28T00:00:00.000Z"
});

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
  return loadSavedRecipesForProfile(getSelectedRecipeProfileId());
}

export function loadSavedRecipesForProfile(profileId: string): SavedRecipe[] {
  return loadAllSavedRecipes().filter((recipe) => recipe.profileId === profileId);
}

export function loadAllSavedRecipes(): SavedRecipe[] {
  const records = readJson<unknown[]>(STORAGE_KEYS.savedRecipes, []);
  return records.flatMap((record) => {
    const parsed = savedRecipeSchema.safeParse(record);
    return parsed.success ? [parsed.data] : [];
  });
}

export function saveSavedRecipes(recipes: SavedRecipe[]) {
  writeJson(STORAGE_KEYS.savedRecipes, recipes.map((recipe) => savedRecipeSchema.parse(recipe)));
}

export function createRecipeProfile(name = "Household"): RecipeProfile {
  const now = new Date().toISOString();
  return recipeProfileSchema.parse({
    id: `recipe-profile-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: name.trim() || "Household",
    createdAt: now,
    updatedAt: now
  });
}

export function loadRecipeProfiles(): RecipeProfile[] {
  const records = readJson<unknown[]>(STORAGE_KEYS.recipeProfiles, []);
  const parsedProfiles = records.flatMap((record) => {
    const parsed = recipeProfileSchema.safeParse(record);
    return parsed.success ? [parsed.data] : [];
  });
  const hasDefault = parsedProfiles.some((profile) => profile.id === DEFAULT_RECIPE_PROFILE_ID);
  return hasDefault ? parsedProfiles : [DEFAULT_RECIPE_PROFILE, ...parsedProfiles];
}

export function saveRecipeProfiles(profiles: RecipeProfile[]) {
  const uniqueProfiles = profiles.reduce<RecipeProfile[]>((accumulator, profile) => {
    const parsed = recipeProfileSchema.parse(profile);
    const existingIndex = accumulator.findIndex((item) => item.id === parsed.id);
    if (existingIndex >= 0) accumulator[existingIndex] = parsed;
    else accumulator.push(parsed);
    return accumulator;
  }, []);
  writeJson(STORAGE_KEYS.recipeProfiles, uniqueProfiles.length > 0 ? uniqueProfiles : [DEFAULT_RECIPE_PROFILE]);
}

export function getSelectedRecipeProfileId() {
  const profiles = loadRecipeProfiles();
  const selectedId = readJson<string>(STORAGE_KEYS.selectedRecipeProfileId, DEFAULT_RECIPE_PROFILE_ID);
  return profiles.some((profile) => profile.id === selectedId) ? selectedId : profiles[0]?.id ?? DEFAULT_RECIPE_PROFILE_ID;
}

export function getSelectedRecipeProfile() {
  const selectedId = getSelectedRecipeProfileId();
  return loadRecipeProfiles().find((profile) => profile.id === selectedId) ?? DEFAULT_RECIPE_PROFILE;
}

export function selectRecipeProfile(profileId: string) {
  if (!loadRecipeProfiles().some((profile) => profile.id === profileId)) return;
  writeJson(STORAGE_KEYS.selectedRecipeProfileId, profileId);
}

export function upsertRecipeProfile(profile: RecipeProfile, selected = false) {
  const now = new Date().toISOString();
  const parsed = recipeProfileSchema.parse({ ...profile, name: profile.name.trim() || "Household", updatedAt: now });
  const existing = loadRecipeProfiles().filter((item) => item.id !== parsed.id);
  saveRecipeProfiles([parsed, ...existing]);
  if (selected) selectRecipeProfile(parsed.id);
  return parsed;
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
  const profileId = record.profileId || getSelectedRecipeProfileId();
  const parsed = savedRecipeSchema.parse({ ...record, profileId });
  const existing = loadAllSavedRecipes().filter((recipe) => !(recipe.id === parsed.id && recipe.profileId === parsed.profileId));
  const selectedProfileRecipes = [parsed, ...existing.filter((recipe) => recipe.profileId === parsed.profileId)].slice(0, MAX_SAVED_RECIPES_PER_PROFILE);
  const otherProfileRecipes = existing.filter((recipe) => recipe.profileId !== parsed.profileId);
  saveSavedRecipes([...selectedProfileRecipes, ...otherProfileRecipes]);
}

export function removeSavedRecipe(id: string, profileId = getSelectedRecipeProfileId()) {
  saveSavedRecipes(loadAllSavedRecipes().filter((recipe) => !(recipe.id === id && recipe.profileId === profileId)));
}

export function isRecipeSaved(id: string, profileId = getSelectedRecipeProfileId()) {
  return loadAllSavedRecipes().some((recipe) => recipe.id === id && recipe.profileId === profileId);
}

export function findRecipeById(id: string): RecipeRecord | SavedRecipe | undefined {
  return [...loadAllSavedRecipes(), ...loadGeneratedRecipes()].find((record) => record.id === id) ?? findCatalogRecipeById(id);
}

export function loadAllGroceryItems(): GroceryListItem[] {
  const records = readJson<unknown[]>(STORAGE_KEYS.groceryItems, []);
  return records.flatMap((record) => {
    const parsed = groceryListItemSchema.safeParse(record);
    return parsed.success ? [parsed.data] : [];
  });
}

export function loadGroceryItemsForProfile(profileId = getSelectedRecipeProfileId()) {
  return loadAllGroceryItems().filter((item) => item.profileId === profileId);
}

export function saveGroceryItems(items: GroceryListItem[]) {
  writeJson(STORAGE_KEYS.groceryItems, items.map((item) => groceryListItemSchema.parse(item)));
}

export function upsertGroceryItem(item: GroceryListItem) {
  const parsed = groceryListItemSchema.parse({ ...item, updatedAt: new Date().toISOString() });
  const existing = loadAllGroceryItems().filter((groceryItem) => groceryItem.id !== parsed.id);
  saveGroceryItems([parsed, ...existing]);
  return parsed;
}

export function addCustomGroceryItem(input: { displayName: string; quantity?: string; unit?: string }, profileId = getSelectedRecipeProfileId()) {
  const item = groceryItemFromCustomInput(input, profileId);
  const existing = loadAllGroceryItems();
  const match = existing.find((groceryItem) => groceryItem.profileId === item.profileId && groceryItem.ingredientKey === item.ingredientKey);
  if (!match) {
    saveGroceryItems([item, ...existing]);
    return { item, added: 1, updated: 0 };
  }

  const merged = mergeGroceryItem(match, item);
  saveGroceryItems([merged, ...existing.filter((groceryItem) => groceryItem.id !== match.id)]);
  return { item: merged, added: 0, updated: 1 };
}

export function addRecipeIngredientsToGroceryList(record: RecipeRecord | SavedRecipe, profileId = getSelectedRecipeProfileId()) {
  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;
  let items = loadAllGroceryItems();

  for (const ingredient of record.recipe.ingredients) {
    const incoming = groceryItemFromIngredient(ingredient, record, profileId, now);
    const existing = items.find((item) => item.profileId === profileId && item.ingredientKey === incoming.ingredientKey);
    if (existing) {
      const merged = mergeGroceryItem(existing, incoming, now);
      items = [merged, ...items.filter((item) => item.id !== existing.id)];
      updated += 1;
    } else {
      items = [incoming, ...items];
      added += 1;
    }
  }

  saveGroceryItems(items);
  return { added, updated, items: loadGroceryItemsForProfile(profileId) };
}

export function updateGroceryItem(item: GroceryListItem) {
  return upsertGroceryItem(groceryListItemSchema.parse(item));
}

export function removeGroceryItem(id: string, profileId = getSelectedRecipeProfileId()) {
  saveGroceryItems(loadAllGroceryItems().filter((item) => !(item.id === id && item.profileId === profileId)));
}

export function clearCheckedGroceryItems(profileId = getSelectedRecipeProfileId()) {
  saveGroceryItems(loadAllGroceryItems().filter((item) => item.profileId !== profileId || !item.checked));
}

export function clearGroceryItemsForProfile(profileId = getSelectedRecipeProfileId()) {
  saveGroceryItems(loadAllGroceryItems().filter((item) => item.profileId !== profileId));
}

function parseFinderSearch(value: unknown): FinderSearch | undefined {
  const parsed = finderSearchSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function finderSearchKey(search: FinderSearch) {
  return JSON.stringify({
    recipeName: search.recipeName.trim().toLowerCase(),
    occasion: search.occasion.trim().toLowerCase(),
    cuisinePreference: search.cuisinePreference.trim().toLowerCase(),
    mainIngredient: search.mainIngredient.trim().toLowerCase(),
    availableIngredients: search.availableIngredients.trim().toLowerCase(),
    servings: Number(search.servings),
    kosherForPassover: search.kosherForPassover,
    cookingDevice: search.cookingDevice,
    maxCaloriesPerServing: search.maxCaloriesPerServing,
    maxTotalTimeMinutes: search.maxTotalTimeMinutes
  });
}

export function loadFinderDraft(): FinderSearch | undefined {
  return parseFinderSearch(readJson<unknown>(STORAGE_KEYS.finderDraft, undefined));
}

export function saveFinderDraft(search: FinderSearch) {
  writeJson(STORAGE_KEYS.finderDraft, finderSearchSchema.parse(search));
}

export function loadRecentSearches(): FinderSearch[] {
  const searches = readJson<unknown[]>(STORAGE_KEYS.recentSearches, []);
  return searches.flatMap((search) => {
    const parsed = parseFinderSearch(search);
    return parsed ? [parsed] : [];
  });
}

export function saveRecentSearch(search: FinderSearch) {
  const parsed = finderSearchSchema.parse(search);
  const next = [parsed, ...loadRecentSearches().filter((recent) => finderSearchKey(recent) !== finderSearchKey(parsed))].slice(0, MAX_RECENT_SEARCHES);
  writeJson(STORAGE_KEYS.recentSearches, next);
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
