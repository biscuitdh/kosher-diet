import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateRecipe } from "@/lib/ai/generate";

describe("AI recipe generation", () => {
  beforeEach(() => {
    vi.stubEnv("LLM_PROVIDER", "mock");
  });

  it("returns a safe mock recipe", async () => {
    const result = await generateRecipe({
      occasion: "Weeknight dinner",
      cuisinePreference: "Mediterranean",
      mainIngredient: "sweet potatoes",
      servings: 4,
      surpriseMe: false
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.recipe.kosherType).toBe("parve");
      expect(result.recipe.title).toMatch(/Quinoa/);
    }
  });
});
