import { describe, expect, it } from "vitest";
import { finderSearchFromSearchParams, finderSearchToSearchParams } from "@/lib/finder-url";

describe("finder URL helpers", () => {
  it("serializes and restores non-default finder state", () => {
    const params = finderSearchToSearchParams({
      recipeName: "walleye",
      occasion: "Passover dinner",
      cuisinePreference: "Ashkenazi",
      mainIngredient: "walleye",
      availableIngredients: "carrots",
      servings: 4,
      kosherForPassover: true,
      cookingDevice: "air-fryer",
      maxCaloriesPerServing: 400,
      maxTotalTimeMinutes: 45
    });

    expect(params.toString()).toContain("recipeName=walleye");
    expect(params.toString()).toContain("kosherForPassover=true");
    expect(finderSearchFromSearchParams(params)).toMatchObject({
      recipeName: "walleye",
      servings: 4,
      kosherForPassover: true,
      cookingDevice: "air-fryer",
      maxCaloriesPerServing: 400,
      maxTotalTimeMinutes: 45
    });
  });

  it("returns undefined when no finder query keys are present", () => {
    expect(finderSearchFromSearchParams(new URLSearchParams("variation=catalog-0001"))).toBeUndefined();
  });
});
