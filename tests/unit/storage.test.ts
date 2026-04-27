import { beforeEach, describe, expect, it } from "vitest";
import { listCatalogRecipes } from "@/lib/catalog";
import {
  createRecipeRecord,
  findRecipeById,
  loadFinderDraft,
  loadRecentSearches,
  loadSavedRecipes,
  saveFinderDraft,
  saveRecentSearch,
  upsertSavedRecipe
} from "@/lib/storage";
import type { FinderSearch } from "@/lib/schemas";

describe("localStorage helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("upserts saved recipes", () => {
    const record = createRecipeRecord({
      title: "Safe Pilaf",
      kosherType: "parve",
      ingredients: [{ name: "Quinoa (parve)", quantity: "1", unit: "cup" }],
      instructions: ["Cook."],
      prepTimeMinutes: 1,
      cookTimeMinutes: 2,
      servings: 1,
      notes: ""
    });

    upsertSavedRecipe(record);
    expect(loadSavedRecipes()).toHaveLength(1);
    upsertSavedRecipe({ ...record, updatedAt: new Date().toISOString() });
    expect(loadSavedRecipes()).toHaveLength(1);
  });

  it("looks up bundled catalog recipes when localStorage has no match", () => {
    const catalogRecord = listCatalogRecipes()[0];

    expect(findRecipeById(catalogRecord.id)?.id).toBe(catalogRecord.id);
  });

  it("saves, dedupes, and caps recent finder searches", () => {
    const baseSearch: FinderSearch = {
      recipeName: "",
      occasion: "Weeknight dinner",
      cuisinePreference: "Mediterranean",
      mainIngredient: "walleye",
      availableIngredients: "carrots",
      servings: 2,
      extraNotes: "",
      kosherForPassover: true,
      maxCaloriesPerServing: 500,
      maxTotalTimeMinutes: 45
    };

    saveRecentSearch(baseSearch);
    saveRecentSearch({ ...baseSearch, mainIngredient: "WALLEYE" });
    expect(loadRecentSearches()).toHaveLength(1);

    for (let index = 0; index < 10; index += 1) {
      saveRecentSearch({ ...baseSearch, mainIngredient: `walleye ${index}` });
    }

    const searches = loadRecentSearches();
    expect(searches).toHaveLength(8);
    expect(searches[0]?.mainIngredient).toBe("walleye 9");
    expect(searches.at(-1)?.mainIngredient).toBe("walleye 2");
  });

  it("restores finder drafts", () => {
    const draft: FinderSearch = {
      recipeName: "lemon walleye",
      occasion: "Passover dinner",
      cuisinePreference: "Ashkenazi",
      mainIngredient: "walleye",
      availableIngredients: "quinoa",
      servings: 2,
      extraNotes: "make ahead",
      kosherForPassover: true,
      maxCaloriesPerServing: 400,
      maxTotalTimeMinutes: 30
    };

    saveFinderDraft(draft);
    expect(loadFinderDraft()).toEqual(draft);
  });
});
