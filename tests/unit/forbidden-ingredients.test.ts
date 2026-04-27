import { describe, expect, it } from "vitest";
import { createDefaultProfile, type Recipe } from "@/lib/schemas";
import { validateRecipeSafety } from "@/lib/validators/forbidden-ingredients";

function recipeWithIngredient(name: string): Recipe {
  return {
    title: "Test Recipe",
    kosherType: "parve",
    ingredients: [{ name, quantity: "1", unit: "cup" }],
    instructions: ["Mix."],
    prepTimeMinutes: 1,
    cookTimeMinutes: 1,
    servings: 1,
    notes: ""
  };
}

describe("forbidden ingredient validator", () => {
  it("blocks tomato forms", () => {
    const result = validateRecipeSafety(recipeWithIngredient("Tomato paste (parve)"), createDefaultProfile());
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.reason).toContain("tomatoes");
  });

  it("blocks nightshade spices", () => {
    const result = validateRecipeSafety(recipeWithIngredient("Paprika (parve)"), createDefaultProfile());
    expect(result.ok).toBe(false);
  });

  it("allows sweet potatoes", () => {
    const result = validateRecipeSafety(recipeWithIngredient("Sweet potatoes (parve)"), createDefaultProfile());
    expect(result.ok).toBe(true);
  });

  it("allows fish, eggs, soy, gluten, nuts, and dairy under the fixed profile", () => {
    for (const ingredient of [
      "Salmon (parve)",
      "Eggs (parve)",
      "Tofu (parve)",
      "Pasta (parve)",
      "Almonds (parve)",
      "Feta cheese (dairy)"
    ]) {
      expect(validateRecipeSafety(recipeWithIngredient(ingredient), createDefaultProfile()), ingredient).toMatchObject({ ok: true });
    }
  });

  it("still blocks shellfish and non-kosher fish", () => {
    expect(validateRecipeSafety(recipeWithIngredient("Shrimp (parve)"), createDefaultProfile()).ok).toBe(false);
    expect(validateRecipeSafety(recipeWithIngredient("Catfish (parve)"), createDefaultProfile()).ok).toBe(false);
  });

  it("blocks custom allergies", () => {
    const profile = { ...createDefaultProfile(), customAllergies: "mustard" };
    const result = validateRecipeSafety(recipeWithIngredient("Mustard seed (parve)"), profile);
    expect(result.ok).toBe(false);
  });
});
