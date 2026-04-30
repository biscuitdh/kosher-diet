import { describe, expect, it } from "vitest";
import { FIXED_SAFETY_PROFILE, createDefaultProfile, finderSearchSchema, generationRequestSchema, recipeSchema } from "@/lib/schemas";

describe("schemas", () => {
  it("creates the fixed nightshade and tomato safety profile", () => {
    const profile = createDefaultProfile();
    expect(profile.kosherPreference).toBe("strict");
    expect(profile.allergies).toEqual(["nightshades", "tomatoes"]);
  });

  it("validates the recipe shape with optional nutrition and shopping metadata", () => {
    const recipe = recipeSchema.parse({
      title: "Safe Pilaf",
      kosherType: "parve",
      ingredients: [
        {
          name: "Quinoa (parve)",
          quantity: "1",
          unit: "cup",
          shoppingName: "quinoa",
          preferredStores: ["walmart", "wegmans", "kosh", "grow-and-behold", "kol-foods"],
          shoppingUrlOverrides: {
            kosh: "https://www.kosh.com/kosher-for-passover.html"
          }
        }
      ],
      instructions: ["Cook quinoa."],
      prepTimeMinutes: 5,
      cookTimeMinutes: 20,
      servings: 4,
      estimatedCaloriesPerServing: 320,
      notes: "Safe."
    });

    expect(recipe.title).toBe("Safe Pilaf");
    expect(recipe.estimatedCaloriesPerServing).toBe(320);
    expect(recipe.ingredients[0]?.shoppingName).toBe("quinoa");
    expect(recipe.ingredients[0]?.shoppingUrlOverrides?.kosh).toBe("https://www.kosh.com/kosher-for-passover.html");
  });

  it("accepts ingredients on hand in generation requests", () => {
    const request = generationRequestSchema.parse({
      availableIngredients: "carrots, onions, quinoa"
    });

    expect(request.availableIngredients).toBe("carrots, onions, quinoa");
    expect(request.servings).toBe(2);
    expect(request.kosherForPassover).toBe(false);
    expect(request.cookingDevice).toBe("any");
    expect(request.profile).toEqual(FIXED_SAFETY_PROFILE);
  });

  it("accepts kosher for Passover finder requests with device and limits", () => {
    const request = generationRequestSchema.parse({
      kosherForPassover: true,
      cookingDevice: "air-fryer",
      maxCaloriesPerServing: 500,
      maxTotalTimeMinutes: 45
    });

    expect(request.kosherForPassover).toBe(true);
    expect(request.cookingDevice).toBe("air-fryer");
    expect(request.maxCaloriesPerServing).toBe(500);
    expect(request.maxTotalTimeMinutes).toBe(45);
  });

  it("defaults finder calorie and time filters to unset", () => {
    const search = finderSearchSchema.parse({});

    expect(search.maxCaloriesPerServing).toBeUndefined();
    expect(search.maxTotalTimeMinutes).toBeUndefined();
    expect(search.cookingDevice).toBe("any");
  });

  it("rejects oversized ingredients on hand text", () => {
    const result = generationRequestSchema.safeParse({
      availableIngredients: "x".repeat(501)
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid calorie and time limits", () => {
    expect(generationRequestSchema.safeParse({ maxCaloriesPerServing: -1 }).success).toBe(false);
    expect(generationRequestSchema.safeParse({ maxTotalTimeMinutes: 0 }).success).toBe(false);
    expect(generationRequestSchema.safeParse({ maxCaloriesPerServing: 3001 }).success).toBe(false);
    expect(generationRequestSchema.safeParse({ maxTotalTimeMinutes: 1441 }).success).toBe(false);
    expect(generationRequestSchema.safeParse({ cookingDevice: "microwave" }).success).toBe(false);
  });
});
