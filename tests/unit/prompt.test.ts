import { describe, expect, it } from "vitest";
import { buildRecipeUserPrompt } from "@/lib/ai/prompt";
import { createDefaultProfile } from "@/lib/schemas";

describe("recipe prompt", () => {
  it("includes ingredients on hand without weakening safety rules", () => {
    const prompt = buildRecipeUserPrompt({
      profile: createDefaultProfile(),
      occasion: "Weeknight dinner",
      cuisinePreference: "Mediterranean",
      mainIngredient: "lentils",
      availableIngredients: "carrots, onions, quinoa",
      servings: 4,
      extraNotes: "",
      surpriseMe: false
    });

    expect(prompt).toContain("Ingredients on hand or requested inclusions: carrots, onions, quinoa.");
    expect(prompt).toContain("never override kosher, allergy, nightshade, or tomato restrictions");
  });
});
