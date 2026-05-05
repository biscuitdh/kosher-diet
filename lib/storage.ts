"use client";

import { CLOUD_DATA_LOADED_EVENT, LOCAL_DATA_CHANGED_EVENT, RECIPE_IMAGE_PLACEHOLDERS, STORAGE_KEYS } from "@/lib/constants";
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
  type RecipeIngredient,
  type RecipeProfile,
  type RecipeRecord,
  type SavedRecipe
} from "@/lib/schemas";

type RateLimitState = {
  timestamps: number[];
};

export type LocalDataSnapshot = {
  profiles: RecipeProfile[];
  selectedProfileId: string;
  savedRecipes: SavedRecipe[];
  groceryItems: GroceryListItem[];
};

export type LocalDataChangeDetail =
  | { type: "profiles-updated"; profiles: RecipeProfile[] }
  | { type: "selected-profile"; profileId: string }
  | { type: "favorite-upsert"; record: SavedRecipe }
  | { type: "favorite-remove"; id: string; profileId: string }
  | { type: "grocery-upsert"; item: GroceryListItem }
  | { type: "grocery-remove"; id: string; profileId: string }
  | { type: "grocery-clear-checked"; profileId: string; ids?: string[]; ingredientKeys?: string[] }
  | { type: "grocery-clear-profile"; profileId: string };

const CLIENT_AI_LIMIT = {
  maxRequests: 5,
  windowMs: 10 * 60 * 1000
};

const MAX_RECENT_SEARCHES = 8;
const MAX_SAVED_RECIPES = 100;
export const DEFAULT_RECIPE_PROFILE: RecipeProfile = recipeProfileSchema.parse({
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

function newerThan(left: string, right: string) {
  return new Date(left).getTime() >= new Date(right).getTime();
}

function normalizeSavedRecipe(record: SavedRecipe): SavedRecipe {
  return savedRecipeSchema.parse({ ...record, profileId: DEFAULT_RECIPE_PROFILE_ID });
}

function normalizeSavedRecipes(recipes: SavedRecipe[]) {
  return Array.from(
    recipes
      .map(normalizeSavedRecipe)
      .reduce<Map<string, SavedRecipe>>((records, recipe) => {
        const existing = records.get(recipe.id);
        if (!existing || newerThan(recipe.updatedAt, existing.updatedAt)) records.set(recipe.id, recipe);
        return records;
      }, new Map())
      .values()
  ).sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function normalizeGroceryItem(item: GroceryListItem): GroceryListItem {
  return groceryListItemSchema.parse({ ...item, profileId: DEFAULT_RECIPE_PROFILE_ID });
}

function normalizeGroceryItems(items: GroceryListItem[]) {
  return Array.from(
    items
      .map(normalizeGroceryItem)
      .reduce<Map<string, GroceryListItem>>((records, item) => {
        const existing = records.get(item.ingredientKey);
        if (!existing) {
          records.set(item.ingredientKey, item);
          return records;
        }

        const merged = mergeGroceryItem(existing, item, newerThan(existing.updatedAt, item.updatedAt) ? existing.updatedAt : item.updatedAt);
        records.set(item.ingredientKey, {
          ...merged,
          id: newerThan(existing.updatedAt, item.updatedAt) ? existing.id : item.id,
          profileId: DEFAULT_RECIPE_PROFILE_ID,
          checked: existing.checked || item.checked,
          createdAt: newerThan(item.createdAt, existing.createdAt) ? existing.createdAt : item.createdAt
        });
        return records;
      }, new Map())
      .values()
  ).sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

export function normalizeSnapshotToHousehold(snapshot: LocalDataSnapshot): LocalDataSnapshot {
  return {
    profiles: [DEFAULT_RECIPE_PROFILE],
    selectedProfileId: DEFAULT_RECIPE_PROFILE_ID,
    savedRecipes: normalizeSavedRecipes(snapshot.savedRecipes),
    groceryItems: normalizeGroceryItems(snapshot.groceryItems)
  };
}

export function normalizeStoredHouseholdData() {
  if (!isBrowser()) return;
  const currentProfiles = readJson<unknown[]>(STORAGE_KEYS.recipeProfiles, []);
  const currentSelected = readJson<string>(STORAGE_KEYS.selectedRecipeProfileId, DEFAULT_RECIPE_PROFILE_ID);
  const currentSaved = readJson<unknown[]>(STORAGE_KEYS.savedRecipes, []);
  const currentGroceries = readJson<unknown[]>(STORAGE_KEYS.groceryItems, []);
  const snapshot = normalizeSnapshotToHousehold({
    profiles: currentProfiles.flatMap((record) => {
      const parsed = recipeProfileSchema.safeParse(record);
      return parsed.success ? [parsed.data] : [];
    }),
    selectedProfileId: currentSelected,
    savedRecipes: currentSaved.flatMap((record) => {
      const parsed = savedRecipeSchema.safeParse(record);
      return parsed.success ? [parsed.data] : [];
    }),
    groceryItems: currentGroceries.flatMap((record) => {
      const parsed = groceryListItemSchema.safeParse(record);
      return parsed.success ? [parsed.data] : [];
    })
  });

  if (JSON.stringify(currentProfiles) !== JSON.stringify(snapshot.profiles)) writeJson(STORAGE_KEYS.recipeProfiles, snapshot.profiles);
  if (currentSelected !== DEFAULT_RECIPE_PROFILE_ID) writeJson(STORAGE_KEYS.selectedRecipeProfileId, DEFAULT_RECIPE_PROFILE_ID);
  if (JSON.stringify(currentSaved) !== JSON.stringify(snapshot.savedRecipes)) writeJson(STORAGE_KEYS.savedRecipes, snapshot.savedRecipes);
  if (JSON.stringify(currentGroceries) !== JSON.stringify(snapshot.groceryItems)) writeJson(STORAGE_KEYS.groceryItems, snapshot.groceryItems);
}

function emitLocalDataChange(detail: LocalDataChangeDetail) {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent<LocalDataChangeDetail>(LOCAL_DATA_CHANGED_EVENT, { detail }));
}

export function emitCloudDataLoaded() {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(CLOUD_DATA_LOADED_EVENT));
}

export function loadLocalDataSnapshot(): LocalDataSnapshot {
  normalizeStoredHouseholdData();
  return {
    profiles: loadRecipeProfiles(),
    selectedProfileId: getSelectedRecipeProfileId(),
    savedRecipes: loadAllSavedRecipes(),
    groceryItems: loadAllGroceryItems()
  };
}

export function saveLocalDataSnapshot(snapshot: LocalDataSnapshot) {
  const normalized = normalizeSnapshotToHousehold(snapshot);
  const profiles = normalized.profiles.length > 0 ? normalized.profiles : [DEFAULT_RECIPE_PROFILE];
  writeJson(STORAGE_KEYS.recipeProfiles, profiles.map((profile) => recipeProfileSchema.parse(profile)));
  writeJson(STORAGE_KEYS.selectedRecipeProfileId, normalized.selectedProfileId);
  writeJson(STORAGE_KEYS.savedRecipes, normalized.savedRecipes.map((recipe) => savedRecipeSchema.parse(recipe)));
  writeJson(STORAGE_KEYS.groceryItems, normalized.groceryItems.map((item) => groceryListItemSchema.parse(item)));
  emitCloudDataLoaded();
}

export function loadSavedRecipes(): SavedRecipe[] {
  return loadSavedRecipesForProfile(getSelectedRecipeProfileId());
}

export function loadSavedRecipesForProfile(profileId: string): SavedRecipe[] {
  void profileId;
  return loadAllSavedRecipes();
}

export function loadAllSavedRecipes(): SavedRecipe[] {
  const records = readJson<unknown[]>(STORAGE_KEYS.savedRecipes, []);
  return normalizeSavedRecipes(records.flatMap((record) => {
    const parsed = savedRecipeSchema.safeParse(record);
    return parsed.success ? [parsed.data] : [];
  }));
}

export function saveSavedRecipes(recipes: SavedRecipe[]) {
  writeJson(STORAGE_KEYS.savedRecipes, normalizeSavedRecipes(recipes).map((recipe) => savedRecipeSchema.parse(recipe)));
}

export function createRecipeProfile(name = "Household"): RecipeProfile {
  void name;
  return DEFAULT_RECIPE_PROFILE;
}

export function loadRecipeProfiles(): RecipeProfile[] {
  return [DEFAULT_RECIPE_PROFILE];
}

export function saveRecipeProfiles(profiles: RecipeProfile[]) {
  void profiles;
  writeJson(STORAGE_KEYS.recipeProfiles, [DEFAULT_RECIPE_PROFILE]);
}

export function getSelectedRecipeProfileId() {
  return DEFAULT_RECIPE_PROFILE_ID;
}

export function getSelectedRecipeProfile() {
  const selectedId = getSelectedRecipeProfileId();
  return loadRecipeProfiles().find((profile) => profile.id === selectedId) ?? DEFAULT_RECIPE_PROFILE;
}

export function selectRecipeProfile(profileId: string) {
  void profileId;
  writeJson(STORAGE_KEYS.selectedRecipeProfileId, DEFAULT_RECIPE_PROFILE_ID);
  emitLocalDataChange({ type: "selected-profile", profileId: DEFAULT_RECIPE_PROFILE_ID });
}

export function upsertRecipeProfile(profile: RecipeProfile, selected = false) {
  void profile;
  const parsed = DEFAULT_RECIPE_PROFILE;
  saveRecipeProfiles([parsed]);
  if (selected) selectRecipeProfile(DEFAULT_RECIPE_PROFILE_ID);
  emitLocalDataChange({ type: "profiles-updated", profiles: loadRecipeProfiles() });
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
  const parsed = normalizeSavedRecipe(record);
  const existing = loadAllSavedRecipes().filter((recipe) => recipe.id !== parsed.id);
  saveSavedRecipes([parsed, ...existing].slice(0, MAX_SAVED_RECIPES));
  emitLocalDataChange({ type: "favorite-upsert", record: parsed });
}

export function removeSavedRecipe(id: string, profileId = getSelectedRecipeProfileId()) {
  void profileId;
  saveSavedRecipes(loadAllSavedRecipes().filter((recipe) => recipe.id !== id));
  emitLocalDataChange({ type: "favorite-remove", id, profileId: DEFAULT_RECIPE_PROFILE_ID });
}

export function isRecipeSaved(id: string, profileId = getSelectedRecipeProfileId()) {
  void profileId;
  return loadAllSavedRecipes().some((recipe) => recipe.id === id);
}

export function findRecipeById(id: string): RecipeRecord | SavedRecipe | undefined {
  return [...loadAllSavedRecipes(), ...loadGeneratedRecipes()].find((record) => record.id === id) ?? findCatalogRecipeById(id);
}

export function loadAllGroceryItems(): GroceryListItem[] {
  const records = readJson<unknown[]>(STORAGE_KEYS.groceryItems, []);
  return normalizeGroceryItems(records.flatMap((record) => {
    const parsed = groceryListItemSchema.safeParse(record);
    return parsed.success ? [parsed.data] : [];
  }));
}

export function loadGroceryItemsForProfile(profileId = getSelectedRecipeProfileId()) {
  void profileId;
  return loadAllGroceryItems();
}

export function saveGroceryItems(items: GroceryListItem[]) {
  writeJson(STORAGE_KEYS.groceryItems, normalizeGroceryItems(items).map((item) => groceryListItemSchema.parse(item)));
}

export function upsertGroceryItem(item: GroceryListItem) {
  const parsed = normalizeGroceryItem(groceryListItemSchema.parse({ ...item, profileId: DEFAULT_RECIPE_PROFILE_ID, updatedAt: new Date().toISOString() }));
  const existing = loadAllGroceryItems().filter((groceryItem) => groceryItem.id !== parsed.id);
  saveGroceryItems([parsed, ...existing]);
  emitLocalDataChange({ type: "grocery-upsert", item: parsed });
  return parsed;
}

export function addCustomGroceryItem(input: { displayName: string; quantity?: string; unit?: string }, profileId = getSelectedRecipeProfileId()) {
  void profileId;
  const item = normalizeGroceryItem(groceryItemFromCustomInput(input, DEFAULT_RECIPE_PROFILE_ID));
  const existing = loadAllGroceryItems();
  const match = existing.find((groceryItem) => groceryItem.ingredientKey === item.ingredientKey);
  if (!match) {
    saveGroceryItems([item, ...existing]);
    emitLocalDataChange({ type: "grocery-upsert", item });
    return { item, added: 1, updated: 0 };
  }

  const merged = mergeGroceryItem(match, item);
  saveGroceryItems([merged, ...existing.filter((groceryItem) => groceryItem.id !== match.id)]);
  emitLocalDataChange({ type: "grocery-upsert", item: merged });
  return { item: merged, added: 0, updated: 1 };
}

export function addRecipeIngredientToGroceryList(
  ingredient: RecipeIngredient,
  record: RecipeRecord | SavedRecipe,
  profileId = getSelectedRecipeProfileId()
) {
  void profileId;
  const now = new Date().toISOString();
  const incoming = normalizeGroceryItem(groceryItemFromIngredient(ingredient, record, DEFAULT_RECIPE_PROFILE_ID, now));
  const existingItems = loadAllGroceryItems();
  const existing = existingItems.find((item) => item.ingredientKey === incoming.ingredientKey);

  if (!existing) {
    saveGroceryItems([incoming, ...existingItems]);
    emitLocalDataChange({ type: "grocery-upsert", item: incoming });
    return { item: incoming, added: 1, updated: 0, items: loadGroceryItemsForProfile(DEFAULT_RECIPE_PROFILE_ID) };
  }

  const merged = mergeGroceryItem(existing, incoming, now);
  saveGroceryItems([merged, ...existingItems.filter((item) => item.id !== existing.id)]);
  emitLocalDataChange({ type: "grocery-upsert", item: merged });
  return { item: merged, added: 0, updated: 1, items: loadGroceryItemsForProfile(DEFAULT_RECIPE_PROFILE_ID) };
}

export function addRecipeIngredientsToGroceryList(record: RecipeRecord | SavedRecipe, profileId = getSelectedRecipeProfileId()) {
  void profileId;
  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;
  let items = loadAllGroceryItems();

  for (const ingredient of record.recipe.ingredients) {
    const incoming = normalizeGroceryItem(groceryItemFromIngredient(ingredient, record, DEFAULT_RECIPE_PROFILE_ID, now));
    const existing = items.find((item) => item.ingredientKey === incoming.ingredientKey);
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
  for (const item of items) {
    emitLocalDataChange({ type: "grocery-upsert", item });
  }
  return { added, updated, items: loadGroceryItemsForProfile(DEFAULT_RECIPE_PROFILE_ID) };
}

export function updateGroceryItem(item: GroceryListItem) {
  return upsertGroceryItem(groceryListItemSchema.parse(item));
}

export function restoreGroceryItems(items: GroceryListItem[]) {
  const restoredItems = items.map((item) => normalizeGroceryItem(groceryListItemSchema.parse({ ...item, profileId: DEFAULT_RECIPE_PROFILE_ID })));
  if (restoredItems.length === 0) return loadGroceryItemsForProfile(DEFAULT_RECIPE_PROFILE_ID);

  const restoredIds = new Set(restoredItems.map((item) => item.id));
  const existingItems = loadAllGroceryItems().filter((item) => !restoredIds.has(item.id));
  saveGroceryItems([...restoredItems, ...existingItems]);
  for (const item of restoredItems) {
    emitLocalDataChange({ type: "grocery-upsert", item });
  }
  return loadGroceryItemsForProfile(DEFAULT_RECIPE_PROFILE_ID);
}

export function removeGroceryItem(id: string, profileId = getSelectedRecipeProfileId()) {
  void profileId;
  saveGroceryItems(loadAllGroceryItems().filter((item) => item.id !== id));
  emitLocalDataChange({ type: "grocery-remove", id, profileId: DEFAULT_RECIPE_PROFILE_ID });
}

export function clearCheckedGroceryItems(profileId = getSelectedRecipeProfileId()) {
  void profileId;
  const items = loadAllGroceryItems();
  const removedItems = items.filter((item) => item.checked);
  saveGroceryItems(items.filter((item) => !item.checked));
  emitLocalDataChange({
    type: "grocery-clear-checked",
    profileId: DEFAULT_RECIPE_PROFILE_ID,
    ids: removedItems.map((item) => item.id),
    ingredientKeys: removedItems.map((item) => item.ingredientKey)
  });
}

export function clearGroceryItemsForProfile(profileId = getSelectedRecipeProfileId()) {
  void profileId;
  saveGroceryItems([]);
  emitLocalDataChange({ type: "grocery-clear-profile", profileId: DEFAULT_RECIPE_PROFILE_ID });
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
