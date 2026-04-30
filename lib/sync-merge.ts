import { mergeGroceryItem } from "@/lib/grocery";
import { DEFAULT_RECIPE_PROFILE, normalizeSnapshotToHousehold, type LocalDataSnapshot } from "@/lib/storage";
import type { GroceryListItem, SavedRecipe } from "@/lib/schemas";

function newerTimestamp(left: string, right: string) {
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
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

        const merged = mergeGroceryItem(existing, item, newerTimestamp(existing.updatedAt, item.updatedAt));
        records.set(item.ingredientKey, {
          ...merged,
          id: new Date(existing.updatedAt).getTime() >= new Date(item.updatedAt).getTime() ? existing.id : item.id,
          profileId: DEFAULT_RECIPE_PROFILE.id,
          checked: existing.checked || item.checked,
          createdAt: new Date(existing.createdAt).getTime() <= new Date(item.createdAt).getTime() ? existing.createdAt : item.createdAt
        });
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
