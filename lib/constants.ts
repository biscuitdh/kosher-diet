export const APP_NAME = "KosherTable";

export const STORAGE_KEYS = {
  savedRecipes: "koshertable.savedRecipes.v1",
  generatedRecipes: "koshertable.generatedRecipes.v1",
  recipeProfiles: "koshertable.recipeProfiles.v1",
  selectedRecipeProfileId: "koshertable.selectedRecipeProfileId.v1",
  groceryItems: "koshertable.groceryItems.v1",
  firebaseSession: "koshertable.firebaseSession.v1",
  aiRateLimit: "koshertable.aiRateLimit.v1",
  finderDraft: "koshertable.finderDraft.v1",
  recentSearches: "koshertable.recentSearches.v1"
} as const;

export const LOCAL_DATA_CHANGED_EVENT = "koshertable:local-data-changed";
export const CLOUD_DATA_LOADED_EVENT = "koshertable:cloud-data-loaded";

export const RECIPE_IMAGE_PLACEHOLDERS = [
  "/images/table-01.svg",
  "/images/table-02.svg",
  "/images/table-03.svg",
  "/images/table-04.svg"
] as const;
