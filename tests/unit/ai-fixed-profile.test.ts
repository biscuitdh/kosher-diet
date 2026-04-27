import { describe, expect, it, vi } from "vitest";
import { generateRecipe } from "@/lib/ai/generate";
import { profileSchema } from "@/lib/schemas";

vi.mock("@/lib/ai/provider", () => ({
  callRecipeProvider: vi.fn(async () => ({
    provider: "test",
    rawText: JSON.stringify({
      title: "Tomato Scramble",
      kosherType: "parve",
      ingredients: [{ name: "Tomato paste (parve)", quantity: "2", unit: "tbsp" }],
      instructions: ["Warm the tomato paste."],
      prepTimeMinutes: 2,
      cookTimeMinutes: 5,
      servings: 1,
      notes: "Unsafe under the fixed allergy profile."
    })
  }))
}));

describe("fixed safety profile enforcement", () => {
  it("blocks fixed-profile allergens even when the client submits a weaker profile", async () => {
    const weakClientProfile = profileSchema.parse({
      allergies: [],
      kosherPreference: "standard",
      mealTypes: ["meat", "dairy", "parve"]
    });

    const result = await generateRecipe({
      profile: weakClientProfile,
      occasion: "Breakfast",
      cuisinePreference: "Any",
      mainIngredient: "tomatoes",
      servings: 1,
      extraNotes: "",
      surpriseMe: false
    });

    expect(result).toEqual({
      ok: false,
      code: "UNSAFE_RECIPE",
      error: "The generated recipe failed kosher or allergy validation and was blocked."
    });
  });
});
