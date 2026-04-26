import { describe, expect, it } from "vitest";
import { FIXED_SAFETY_PROFILE, createDefaultProfile, generationRequestSchema, recipeSchema } from "@/lib/schemas";

describe("schemas", () => {
  it("creates a restrictive default profile", () => {
    const profile = createDefaultProfile();
    expect(profile.kosherPreference).toBe("strict");
    expect(profile.allergies).toContain("nightshades");
    expect(profile.allergies).toContain("tomatoes");
    expect(profile.allergies).toContain("shellfish");
  });

  it("validates the required recipe JSON shape", () => {
    const recipe = recipeSchema.parse({
      title: "Safe Pilaf",
      kosherType: "parve",
      ingredients: [{ name: "Quinoa (parve)", quantity: "1", unit: "cup" }],
      instructions: ["Cook quinoa."],
      prepTimeMinutes: 5,
      cookTimeMinutes: 20,
      servings: 4,
      notes: "Safe."
    });

    expect(recipe.title).toBe("Safe Pilaf");
  });

  it("accepts ingredients on hand in generation requests", () => {
    const request = generationRequestSchema.parse({
      availableIngredients: "carrots, onions, quinoa"
    });

    expect(request.availableIngredients).toBe("carrots, onions, quinoa");
    expect(request.profile).toEqual(FIXED_SAFETY_PROFILE);
  });

  it("rejects oversized ingredients on hand text", () => {
    const result = generationRequestSchema.safeParse({
      availableIngredients: "x".repeat(501)
    });

    expect(result.success).toBe(false);
  });
});
