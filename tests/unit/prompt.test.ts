import { describe, expect, it } from "vitest";
import { buildRecipeUserPrompt } from "@/lib/ai/prompt";
import { createDefaultProfile } from "@/lib/schemas";

describe("recipe prompt", () => {
  it("includes ingredients on hand without weakening safety rules", () => {
    const prompt = buildRecipeUserPrompt({
      profile: createDefaultProfile(),
      recipeName: "",
      occasion: "Weeknight dinner",
      cuisinePreference: "Mediterranean",
      mainIngredient: "lentils",
      availableIngredients: "carrots, onions, quinoa",
      servings: 4,
      extraNotes: "",
      kosherForPassover: false,
      surpriseMe: false
    });

    expect(prompt).toContain("Ingredients on hand or requested inclusions: carrots, onions, quinoa.");
    expect(prompt).toContain("never override kosher, allergy, nightshade, or tomato restrictions");
  });

  it("adds strict no-kitniyot Passover rules when requested", () => {
    const prompt = buildRecipeUserPrompt({
      profile: createDefaultProfile(),
      recipeName: "walleye",
      occasion: "Passover dinner",
      cuisinePreference: "Ashkenazi",
      mainIngredient: "walleye",
      availableIngredients: "quinoa",
      servings: 2,
      extraNotes: "",
      kosherForPassover: true,
      surpriseMe: false
    });

    expect(prompt).toContain("Kosher for Passover: yes.");
    expect(prompt).toContain("no chametz");
    expect(prompt).toContain("no rice, corn, beans");
  });
});
