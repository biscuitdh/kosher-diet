import { DEFAULT_RECIPE_PROFILE, normalizeSnapshotToHousehold, type LocalDataSnapshot } from "@/lib/storage";
import type { GroceryListItem, SavedRecipe } from "@/lib/schemas";

function newerTimestamp(left: string, right: string) {
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

function olderTimestamp(left: string, right: string) {
  return new Date(left).getTime() <= new Date(right).getTime() ? left : right;
}

function newerGroceryItem(left: GroceryListItem, right: GroceryListItem) {
  return new Date(left.updatedAt).getTime() >= new Date(right.updatedAt).getTime() ? left : right;
}

function mergeSourceRecipes(left: GroceryListItem, right: GroceryListItem) {
  return [...left.sourceRecipes, ...right.sourceRecipes].reduce<GroceryListItem["sourceRecipes"]>((sources, source) => {
    if (!sources.some((item) => item.recipeId === source.recipeId)) sources.push(source);
    return sources;
  }, []);
}

function mergePreferredStores(left: GroceryListItem, right: GroceryListItem) {
  const stores = [...(left.preferredStores ?? []), ...(right.preferredStores ?? [])].reduce<NonNullable<GroceryListItem["preferredStores"]>>((values, store) => {
    if (!values.includes(store)) values.push(store);
    return values;
  }, []);
  return stores.length > 0 ? stores : undefined;
}

function reconcileSyncedGroceryItem(existing: GroceryListItem, incoming: GroceryListItem): GroceryListItem {
  const newest = newerGroceryItem(existing, incoming);

  return {
    ...newest,
    profileId: DEFAULT_RECIPE_PROFILE.id,
    checked: existing.checked || incoming.checked,
    pantryStaple: existing.pantryStaple && incoming.pantryStaple,
    quantityNotes: Array.from(new Set([...existing.quantityNotes, ...incoming.quantityNotes])).slice(0, 12),
    preferredStores: mergePreferredStores(existing, incoming),
    shoppingUrlOverrides: { ...existing.shoppingUrlOverrides, ...incoming.shoppingUrlOverrides },
    sourceRecipes: mergeSourceRecipes(existing, incoming),
    createdAt: olderTimestamp(existing.createdAt, incoming.createdAt),
    updatedAt: newerTimestamp(existing.updatedAt, incoming.updatedAt)
  };
}

function mergeFavorites(localFavorites: SavedRecipe[], cloudFavorites: SavedRecipe[]) {
  return Array.from(
    [...cloudFavorites, ...localFavorites]
      .reduce<Map<string, SavedRecipe>>((records, recipe) => {
        const existing = records.get(recipe.id);
        if (!existing || new Date(recipe.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) records.set(recipe.id, recipe);
        return records;
      }, new Map())
      .values()
  );
}

function mergeGroceries(localItems: GroceryListItem[], cloudItems: GroceryListItem[]) {
  return Array.from(
    [...cloudItems, ...localItems]
      .reduce<Map<string, GroceryListItem>>((records, item) => {
        const existing = records.get(item.ingredientKey);
        if (!existing) {
          records.set(item.ingredientKey, item);
          return records;
        }

        records.set(item.ingredientKey, reconcileSyncedGroceryItem(existing, item));
        return records;
      }, new Map())
      .values()
  );
}

export function mergeLocalAndCloudSnapshots(localSnapshot: LocalDataSnapshot, cloudSnapshot: LocalDataSnapshot): LocalDataSnapshot {
  const local = normalizeSnapshotToHousehold(localSnapshot);
  const cloud = normalizeSnapshotToHousehold(cloudSnapshot);

  return {
    profiles: [DEFAULT_RECIPE_PROFILE],
    selectedProfileId: DEFAULT_RECIPE_PROFILE.id,
    savedRecipes: mergeFavorites(local.savedRecipes, cloud.savedRecipes),
    groceryItems: mergeGroceries(local.groceryItems, cloud.groceryItems)
  };
}
