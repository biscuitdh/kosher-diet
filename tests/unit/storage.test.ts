import { beforeEach, describe, expect, it } from "vitest";
import { listCatalogRecipes } from "@/lib/catalog";
import { createRecipeRecord, findRecipeById, loadSavedRecipes, upsertSavedRecipe } from "@/lib/storage";

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
});
