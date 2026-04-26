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

  it("blocks custom allergies", () => {
    const profile = { ...createDefaultProfile(), customAllergies: "mustard" };
    const result = validateRecipeSafety(recipeWithIngredient("Mustard seed (parve)"), profile);
    expect(result.ok).toBe(false);
  });
});
