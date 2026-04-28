import { beforeEach, describe, expect, it } from "vitest";
import { listCatalogRecipes } from "@/lib/catalog";
import {
  buildGroceryAgentManifest,
  groceryItemFromCustomInput,
  groupGroceryItemsByStore,
  mergeGroceryItem,
  parseGroceryQuantity
} from "@/lib/grocery";
import { addRecipeIngredientsToGroceryList, createRecipeProfile, loadGroceryItemsForProfile, selectRecipeProfile, upsertRecipeProfile } from "@/lib/storage";
import type { GroceryListItem } from "@/lib/schemas";

function groceryItem(name: string, quantity: string, unit: string): GroceryListItem {
  return groceryItemFromCustomInput({ displayName: name, quantity, unit }, "household", "2026-04-28T00:00:00.000Z");
}

describe("grocery helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("parses whole, decimal, fraction, mixed fraction, and invalid quantities", () => {
    expect(parseGroceryQuantity("2")).toBe(2);
    expect(parseGroceryQuantity("1.5")).toBe(1.5);
    expect(parseGroceryQuantity("1/2")).toBe(0.5);
    expect(parseGroceryQuantity("1 1/2")).toBe(1.5);
    expect(parseGroceryQuantity("about 2")).toBeUndefined();
  });

  it("merges duplicate compatible grocery quantities", () => {
    const existing = groceryItem("Quinoa", "1", "cup");
    const incoming = groceryItem("Quinoa", "1/2", "cup");
    const merged = mergeGroceryItem(existing, incoming, "2026-04-28T00:00:00.000Z");

    expect(merged.quantity).toBe("1 1/2");
    expect(merged.unit).toBe("cups");
    expect(merged.quantityNotes).toEqual([]);
  });

  it("preserves readable notes for incompatible grocery units", () => {
    const existing = groceryItem("Sliced almonds", "1", "cup");
    const incoming = groceryItem("Sliced almonds", "4", "oz");
    const merged = mergeGroceryItem(existing, incoming, "2026-04-28T00:00:00.000Z");

    expect(merged.quantity).toBe("1");
    expect(merged.unit).toBe("cup");
    expect(merged.quantityNotes).toContain("4 oz Sliced almonds");
  });

  it("stores grocery lists by active recipe profile", () => {
    const recipe = listCatalogRecipes()[0];
    const profile = upsertRecipeProfile(createRecipeProfile("Sam"), true);

    addRecipeIngredientsToGroceryList(recipe, profile.id);
    expect(loadGroceryItemsForProfile(profile.id).length).toBeGreaterThan(0);

    selectRecipeProfile("household");
    expect(loadGroceryItemsForProfile("household")).toEqual([]);
  });

  it("groups purchasable items by preferred store and omits pantry staples", () => {
    const recipe = listCatalogRecipes().find((record) => record.recipe.ingredients.some((ingredient) => /chicken/i.test(ingredient.name)));
    expect(recipe).toBeDefined();
    addRecipeIngredientsToGroceryList(recipe!, "household");

    const items = loadGroceryItemsForProfile("household");
    const groups = groupGroceryItemsByStore(items);
    const manifest = buildGroceryAgentManifest(items, "household");

    expect(groups.length).toBeGreaterThan(0);
    expect(groups.some((group) => group.store === "kosh")).toBe(true);
    expect(groups.flatMap((group) => group.items).some(({ item }) => item.pantryStaple)).toBe(false);
    expect(manifest.stores.length).toBe(groups.length);
  });
});
