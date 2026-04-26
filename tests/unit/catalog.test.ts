import { describe, expect, it } from "vitest";
import { findBestCatalogRecipe, findCatalogRecipeById, listCatalogRecipes, searchCatalogRecipes } from "@/lib/catalog";
import { FIXED_SAFETY_PROFILE, recipeSchema } from "@/lib/schemas";
import { validateRecipeSafety } from "@/lib/validators/forbidden-ingredients";

describe("recipe catalog", () => {
  it("contains 1,000 schema-valid recipes", () => {
    const recipes = listCatalogRecipes();

    expect(recipes).toHaveLength(1000);
    for (const record of recipes) {
      expect(() => recipeSchema.parse(record.recipe)).not.toThrow();
    }
  });

  it("keeps every catalog recipe inside the fixed safety profile", () => {
    for (const record of listCatalogRecipes()) {
      expect(validateRecipeSafety(record.recipe, FIXED_SAFETY_PROFILE), record.recipe.title).toMatchObject({ ok: true });
    }
  });

  it("searches and ranks by cuisine, main ingredient, servings, and ingredients on hand", () => {
    const [match] = searchCatalogRecipes(
      {
        cuisinePreference: "Sephardi",
        mainIngredient: "chickpeas",
        availableIngredients: "carrots, quinoa",
        servings: 4
      },
      1
    );

    expect(match.recipe.title.toLowerCase()).toContain("chickpeas");
    expect(`${match.recipe.title} ${match.catalog.cuisine}`.toLowerCase()).toContain("sephardi");
  });

  it("finds catalog records by id", () => {
    const record = findBestCatalogRecipe({ mainIngredient: "mushrooms" });

    expect(record).toBeDefined();
    expect(findCatalogRecipeById(record.id)?.id).toBe(record.id);
  });
});
