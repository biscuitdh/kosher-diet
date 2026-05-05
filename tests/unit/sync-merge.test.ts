import { describe, expect, it } from "vitest";
import { groceryItemFromCustomInput } from "@/lib/grocery";
import { mergeLocalAndCloudSnapshots } from "@/lib/sync-merge";
import { DEFAULT_RECIPE_PROFILE, type LocalDataSnapshot } from "@/lib/storage";
import type { RecipeProfile, SavedRecipe } from "@/lib/schemas";

function profile(id: string, name: string, updatedAt: string): RecipeProfile {
  return {
    id,
    name,
    createdAt: "2026-04-28T00:00:00.000Z",
    updatedAt
  };
}

function favorite(id: string, profileId: string, updatedAt: string): SavedRecipe {
  return {
    id,
    profileId,
    createdAt: "2026-04-28T00:00:00.000Z",
    updatedAt,
    imagePath: "/images/table-01.svg",
    source: "manual",
    recipe: {
      title: `Recipe ${id}`,
      kosherType: "parve",
      ingredients: [{ name: "Carrots", quantity: "1", unit: "cup" }],
      instructions: ["Cook."],
      prepTimeMinutes: 1,
      cookTimeMinutes: 1,
      servings: 2,
      notes: ""
    }
  };
}

function snapshot(partial: Partial<LocalDataSnapshot>): LocalDataSnapshot {
  return {
    profiles: [DEFAULT_RECIPE_PROFILE],
    selectedProfileId: DEFAULT_RECIPE_PROFILE.id,
    savedRecipes: [],
    groceryItems: [],
    ...partial
  };
}

describe("sync merge helpers", () => {
  it("normalizes old profiles to the shared household profile", () => {
    const local = snapshot({
      profiles: [profile("recipe-profile-jessica", "Jess", "2026-04-28T00:00:00.000Z")],
      selectedProfileId: DEFAULT_RECIPE_PROFILE.id
    });
    const cloud = snapshot({
      profiles: [profile("recipe-profile-jessica", "Jessica", "2026-04-29T00:00:00.000Z")],
      selectedProfileId: "recipe-profile-jessica"
    });

    const merged = mergeLocalAndCloudSnapshots(local, cloud);

    expect(merged.profiles).toHaveLength(1);
    expect(merged.profiles[0]).toMatchObject({ id: "household", name: "Household" });
    expect(merged.selectedProfileId).toBe("household");
  });

  it("dedupes favorites by recipe id after profile normalization", () => {
    const local = snapshot({ savedRecipes: [favorite("catalog-0001", "recipe-profile-jessica", "2026-04-29T00:00:00.000Z")] });
    const cloud = snapshot({ savedRecipes: [favorite("catalog-0001", "household", "2026-04-28T00:00:00.000Z")] });

    const merged = mergeLocalAndCloudSnapshots(local, cloud);

    expect(merged.savedRecipes).toHaveLength(1);
    expect(merged.savedRecipes[0].profileId).toBe("household");
    expect(merged.savedRecipes[0].updatedAt).toBe("2026-04-29T00:00:00.000Z");
  });

  it("reconciles grocery duplicates by ingredient key without summing during sync", () => {
    const localCarrots = groceryItemFromCustomInput({ displayName: "Carrots", quantity: "1", unit: "cup" }, "recipe-profile-jessica", "2026-04-29T00:00:00.000Z");
    const cloudCarrots = groceryItemFromCustomInput({ displayName: "Carrots", quantity: "1/2", unit: "cup" }, "household", "2026-04-28T00:00:00.000Z");

    const merged = mergeLocalAndCloudSnapshots(snapshot({ groceryItems: [localCarrots] }), snapshot({ groceryItems: [cloudCarrots] }));

    expect(merged.groceryItems).toHaveLength(1);
    expect(merged.groceryItems[0]).toMatchObject({ profileId: "household", displayName: "Carrots", quantity: "1", unit: "cup" });
  });

  it("does not double grocery quantities across repeated refresh syncs", () => {
    const item = groceryItemFromCustomInput({ displayName: "Cauliflower rice", quantity: "20", unit: "cups" }, "household", "2026-04-29T00:00:00.000Z");
    const firstMerge = mergeLocalAndCloudSnapshots(snapshot({ groceryItems: [item] }), snapshot({ groceryItems: [item] }));
    const secondMerge = mergeLocalAndCloudSnapshots(firstMerge, snapshot({ groceryItems: firstMerge.groceryItems }));

    expect(firstMerge.groceryItems).toHaveLength(1);
    expect(secondMerge.groceryItems).toHaveLength(1);
    expect(secondMerge.groceryItems[0]).toMatchObject({ displayName: "Cauliflower rice", quantity: "20", unit: "cups" });
  });
});
