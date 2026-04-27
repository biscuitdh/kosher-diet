import { describe, expect, it } from "vitest";
import { formatIngredientForCopy, shoppingLinksForIngredient, shoppingUrl } from "@/lib/shopping";
import type { RecipeIngredient } from "@/lib/schemas";

describe("shopping helpers", () => {
  it("encodes Walmart and Wegmans search links", () => {
    const ingredient: RecipeIngredient = {
      name: "Feta cheese (dairy)",
      quantity: "5",
      unit: "oz",
      shoppingName: "kosher feta cheese",
      preferredStores: ["walmart", "wegmans"]
    };

    expect(shoppingUrl("walmart", ingredient)).toBe("https://www.walmart.com/search?q=kosher%20feta%20cheese");
    expect(shoppingUrl("wegmans", ingredient)).toBe("https://www.wegmans.com/shop/search?query=kosher%20feta%20cheese");
  });

  it("prefers KOSH links for kosher meat ingredients", () => {
    const ingredient: RecipeIngredient = {
      name: "Kosher chicken breast (meat)",
      quantity: "12",
      unit: "oz",
      shoppingName: "kosher chicken breast"
    };

    const links = shoppingLinksForIngredient(ingredient);
    expect(links[0]).toMatchObject({ store: "kosh", href: "https://www.kosh.com/chicken-breast-filets.html" });
    expect(links[1]?.store).toBe("grow-and-behold");
    expect(links[2]?.store).toBe("kol-foods");
  });

  it("uses direct overrides for specific kosher meat cuts", () => {
    const ingredient: RecipeIngredient = {
      name: "Kosher beef stew meat (meat)",
      quantity: "12",
      unit: "oz",
      shoppingName: "kosher beef stew meat",
      preferredStores: ["kosh", "grow-and-behold"],
      shoppingUrlOverrides: {
        kosh: "https://www.kosh.com/kosh-stew-meat-11512.html",
        "grow-and-behold": "https://www.growandbehold.com/beef/"
      }
    };

    const links = shoppingLinksForIngredient(ingredient);
    expect(links[0]).toMatchObject({ store: "kosh", href: "https://www.kosh.com/kosh-stew-meat-11512.html" });
    expect(links[1]).toMatchObject({ store: "grow-and-behold", href: "https://www.growandbehold.com/beef/" });
  });

  it("adds sensible fish links for walleye", () => {
    const ingredient: RecipeIngredient = {
      name: "Walleye fillets (parve)",
      quantity: "12",
      unit: "oz",
      shoppingName: "walleye fillets"
    };

    const links = shoppingLinksForIngredient(ingredient);
    expect(links.map((link) => link.store)).toEqual(["walmart", "wegmans", "kosh"]);
    expect(links[0]?.href).toBe("https://www.walmart.com/search?q=walleye%20fillets");
    expect(links[2]?.href).toBe("https://www.kosh.com/kosher-fish.html");
  });

  it("omits pantry staples from ordering links", () => {
    const ingredient: RecipeIngredient = {
      name: "Kosher salt (parve)",
      quantity: "3/4",
      unit: "tsp",
      pantryStaple: true
    };

    expect(formatIngredientForCopy(ingredient)).toBe("3/4 tsp Kosher salt");
    expect(shoppingLinksForIngredient(ingredient)).toEqual([]);
  });
});
