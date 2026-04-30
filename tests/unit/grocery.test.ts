import { beforeEach, describe, expect, it } from "vitest";
import { listCatalogRecipes } from "@/lib/catalog";
import {
  buildGroceryAgentManifest,
  buildWalmartCartAgentPrompt,
  buildWalmartOrderManifest,
  groceryItemFromCustomInput,
  groupGroceryItemsByStore,
  groupSpecialtyKosherMeatItemsByStore,
  mergeGroceryItem,
  parseGroceryQuantity,
  sortGroceryItemsForDisplay,
  walmartOrderItems
} from "@/lib/grocery";
import {
  addRecipeIngredientToGroceryList,
  addRecipeIngredientsToGroceryList,
  loadGroceryItemsForProfile
} from "@/lib/storage";
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

  it("normalizes legacy profile groceries into the shared household list", () => {
    const recipe = listCatalogRecipes()[0];

    addRecipeIngredientsToGroceryList(recipe, "recipe-profile-sam");
    const items = loadGroceryItemsForProfile("household");

    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.profileId === "household")).toBe(true);
    expect(loadGroceryItemsForProfile("recipe-profile-sam")).toHaveLength(items.length);
  });

  it("adds one recipe ingredient and merges a duplicate add", () => {
    const recipe = listCatalogRecipes()[0];
    const ingredient = recipe.recipe.ingredients.find((item) => !item.pantryStaple);
    expect(ingredient).toBeDefined();

    const firstResult = addRecipeIngredientToGroceryList(ingredient!, recipe, "household");
    const secondResult = addRecipeIngredientToGroceryList(ingredient!, recipe, "household");
    const items = loadGroceryItemsForProfile("household");

    expect(firstResult.added).toBe(1);
    expect(secondResult.updated).toBe(1);
    expect(items).toHaveLength(1);
    expect(items[0].sourceRecipes).toEqual([{ recipeId: recipe.id, title: recipe.recipe.title }]);
  });

  it("sorts unchecked grocery items before checked items", () => {
    const unchecked = groceryItem("Apples", "4", "items");
    const checked = { ...groceryItem("Carrots", "2", "items"), checked: true };

    expect(sortGroceryItemsForDisplay([checked, unchecked]).map((item) => item.displayName)).toEqual(["Apples", "Carrots"]);
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

  it("groups only unchecked non-pantry kosher meat for specialty source panels", () => {
    const chicken = groceryItem("Kosher chicken thighs", "2", "lb");
    const carrots = groceryItem("Carrots", "1", "cup");
    const checkedBeef = { ...groceryItem("Kosher ground beef", "1", "lb"), checked: true };
    const pantryChicken = { ...groceryItem("Kosher chicken broth", "1", "cup"), pantryStaple: true };

    const groups = groupSpecialtyKosherMeatItemsByStore([chicken, carrots, checkedBeef, pantryChicken]);
    const groupedItems = groups.flatMap((group) => group.items);
    const allLinks = groupedItems.flatMap(({ primaryLink, alternateLinks }) => [primaryLink, ...alternateLinks]);

    expect(groupedItems).toHaveLength(1);
    expect(groupedItems[0].item.displayName).toBe("Kosher chicken thighs");
    expect(groups.map((group) => group.store)).toEqual(["kosh"]);
    expect(allLinks.map((link) => link.store)).toEqual(["kosh", "grow-and-behold", "kol-foods", "specialty-kosher"]);
    expect(allLinks.some((link) => link.store === "walmart" || link.store === "wegmans")).toBe(false);
  });

  it("builds a compact Walmart-only cart spec for unchecked non-pantry items", () => {
    const carrots = groceryItem("Carrots", "1", "cup");
    const salt = { ...groceryItem("Kosher salt", "1", "tsp"), pantryStaple: true };
    const checkedZucchini = { ...groceryItem("Zucchini", "2", "items"), checked: true };

    const walmartItems = walmartOrderItems([carrots, salt, checkedZucchini]);
    const manifest = buildWalmartOrderManifest([carrots, salt, checkedZucchini], "household");

    expect(walmartItems).toHaveLength(1);
    expect(manifest.store).toBe("walmart");
    expect(manifest.cartSpecVersion).toBe(1);
    expect(manifest.items).toHaveLength(1);
    expect(manifest.items[0]).toMatchObject({
      name: "Carrots",
      shoppingName: "Carrots",
      cartQuantity: 1,
      targetPackage: "1 lb bag carrots"
    });
    expect(manifest.items[0].searchUrl).toContain("walmart.com/search");
    expect(manifest.items[0]).not.toHaveProperty("id");
    expect(manifest.items[0]).not.toHaveProperty("sourceRecipes");
    expect(manifest.items[0]).not.toHaveProperty("quantity");
    expect(manifest.items[0]).not.toHaveProperty("unit");
    expect(manifest.items[0]).not.toHaveProperty("walmartSearchUrl");
  });

  it("excludes non-fish meat from the Walmart cart spec", () => {
    const chicken = groceryItem("Kosher chicken breast", "12", "oz");
    const beef = groceryItem("Kosher ground beef", "1", "lb");
    const lamb = groceryItem("Kosher lamb cubes", "1", "lb");
    const thighs = groceryItem("Boneless thighs", "12", "oz");
    const chickenFillets = groceryItem("Chicken fillets", "12", "oz");

    const manifest = buildWalmartOrderManifest([chicken, beef, lamb, thighs, chickenFillets], "household");

    expect(manifest.items).toEqual([]);
  });

  it("keeps fish eligible for the Walmart cart spec", () => {
    const salmon = groceryItem("Atlantic salmon fillets", "12", "oz");
    const cod = groceryItem("Cod fillets", "12", "oz");

    const manifest = buildWalmartOrderManifest([salmon, cod], "household");

    expect(manifest.items).toEqual([
      {
        name: "Atlantic salmon fillets",
        shoppingName: "Atlantic salmon fillets",
        cartQuantity: 1,
        targetPackage: "1 plain 12-16 oz pack",
        searchUrl: "https://www.walmart.com/search?q=Atlantic%20salmon%20fillets"
      },
      {
        name: "Cod fillets",
        shoppingName: "Cod fillets",
        cartQuantity: 1,
        targetPackage: "1 plain 12-16 oz pack",
        searchUrl: "https://www.walmart.com/search?q=Cod%20fillets"
      }
    ]);
  });

  it("excludes non-fish meat even when old data still prefers Walmart", () => {
    const chicken = {
      ...groceryItem("Kosher boneless chicken thighs", "2", "lb"),
      preferredStores: ["walmart"] as GroceryListItem["preferredStores"]
    };
    const garlic = groceryItem("Garlic cloves", "1", "tbsp");

    const manifest = buildWalmartOrderManifest([chicken, garlic], "household");

    expect(manifest.items).toHaveLength(1);
    expect(manifest.items[0]).toMatchObject({ shoppingName: "Garlic cloves" });
  });

  it("builds a ready-to-paste Walmart cart agent prompt", () => {
    const apples = groceryItem("Apples", "4", "items");
    const salt = { ...groceryItem("Kosher salt", "1", "tsp"), pantryStaple: true };
    const checkedCarrots = { ...groceryItem("Carrots", "2", "items"), checked: true };

    const prompt = buildWalmartCartAgentPrompt([apples, salt, checkedCarrots], "household");
    const embeddedManifest = JSON.parse(prompt.slice(prompt.indexOf("{")));

    expect(prompt).toContain("Use $walmart-grocery-cart");
    expect(prompt).toContain("KosherTable Walmart cart spec");
    expect(prompt).toContain("Preserve existing cart contents and do not checkout.");
    expect(prompt).toContain("Prefer Walmart items I have bought before");
    expect(embeddedManifest.store).toBe("walmart");
    expect(embeddedManifest.cartSpecVersion).toBe(1);
    expect(embeddedManifest.items).toHaveLength(1);
    expect(embeddedManifest.items[0]).toMatchObject({
      name: "Apples",
      shoppingName: "Apples",
      cartQuantity: 1,
      targetPackage: "1 practical Walmart grocery package"
    });
  });
});
