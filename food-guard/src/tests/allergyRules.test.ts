import { describe, expect, it } from "vitest";
import { analyzeProduct } from "@/rules/analyzeProduct";
import { analyzeTextForAllergies } from "@/rules/allergyRules";
import { createProfile } from "@/types/Profile";
import type { Product } from "@/types/Product";

const profile = createProfile("Test");

function productWithIngredients(ingredientsText?: string): Product {
  return {
    barcode: "test",
    productName: "Test Product",
    ingredientsText,
    allergens: [],
    labels: [],
    lookupStatus: "manual",
    source: "manual",
    fetchedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}

describe("allergy matching engine", () => {
  it("tomato paste => Avoid", () => {
    const result = analyzeProduct(productWithIngredients("Water, tomato paste, salt."), profile);
    expect(result.status).toBe("Avoid");
    expect(result.matches.some((match) => match.term === "tomato paste")).toBe(true);
  });

  it("paprika => Avoid", () => {
    const result = analyzeProduct(productWithIngredients("Corn, paprika, salt."), profile);
    expect(result.status).toBe("Avoid");
  });

  it("black pepper => Likely OK if no other matches", () => {
    const result = analyzeProduct(productWithIngredients("Rice flour, salt, black pepper."), profile);
    expect(result.status).toBe("Likely OK");
    expect(result.matches).toHaveLength(0);
  });

  it("white pepper => Likely OK if no other matches", () => {
    const result = analyzeProduct(productWithIngredients("Rice, white pepper, sea salt."), profile);
    expect(result.status).toBe("Likely OK");
    expect(result.matches).toHaveLength(0);
  });

  it("pepper => Possible Risk", () => {
    const result = analyzeProduct(productWithIngredients("Rice flour, pepper, salt."), profile);
    expect(result.status).toBe("Possible Risk");
  });

  it("spices => Possible Risk", () => {
    const result = analyzeProduct(productWithIngredients("Corn, spices, salt."), profile);
    expect(result.status).toBe("Possible Risk");
  });

  it("missing ingredients => Unknown", () => {
    const result = analyzeProduct(productWithIngredients(undefined), profile);
    expect(result.status).toBe("Unknown");
  });

  it("potato starch => Avoid", () => {
    const result = analyzeProduct(productWithIngredients("Rice flour, potato starch, salt."), profile);
    expect(result.status).toBe("Avoid");
  });

  it("natural flavors => Possible Risk", () => {
    const result = analyzeProduct(productWithIngredients("Water, cane sugar, natural flavors."), profile);
    expect(result.status).toBe("Possible Risk");
  });

  it("red pepper => Avoid", () => {
    const result = analyzeProduct(productWithIngredients("Beans, red pepper, salt."), profile);
    expect(result.status).toBe("Avoid");
  });

  it("jalapeño and jalapeno normalize to the same avoid match", () => {
    expect(analyzeProduct(productWithIngredients("Jalapeño peppers."), profile).status).toBe("Avoid");
    expect(analyzeProduct(productWithIngredients("Jalapeno peppers."), profile).status).toBe("Avoid");
  });

  it("tomato purée and puree normalize to avoid", () => {
    expect(analyzeProduct(productWithIngredients("Tomato purée, salt."), profile).status).toBe("Avoid");
    expect(analyzeProduct(productWithIngredients("Tomato puree, salt."), profile).status).toBe("Avoid");
  });

  it("returns source attribution across mixed fields", () => {
    const product = {
      ...productWithIngredients("Rice and sea salt."),
      allergens: ["may contain tomato"],
      labels: ["kosher"],
      ocrText: "Ingredients: rice, paprika."
    };
    const result = analyzeProduct(product, profile);
    expect(result.status).toBe("Avoid");
    expect(result.matches.map((match) => match.source)).toEqual(expect.arrayContaining(["allergens", "ocr"]));
  });

  it("does not flag sweet potato as regular potato", () => {
    const result = analyzeProduct(productWithIngredients("Sweet potato, sea salt."), profile);
    expect(result.status).toBe("Likely OK");
  });

  it("direct text analyzer preserves generic pepper ambiguity", () => {
    const matches = analyzeTextForAllergies("pepper", "ingredients", ["nightshades"]);
    expect(matches[0]?.severity).toBe("possible");
  });
});
