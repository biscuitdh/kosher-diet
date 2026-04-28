import { describe, expect, it } from "vitest";
import {
  appendSuggestion,
  filterSuggestionsForProfile,
  mainIngredientSuggestions
} from "@/lib/generator-suggestions";
import { createDefaultProfile } from "@/lib/schemas";

describe("generator suggestions", () => {
  it("shows newly allowed common foods in the default fixed profile", () => {
    const profile = createDefaultProfile();
    const labels = filterSuggestionsForProfile(mainIngredientSuggestions, profile).map((suggestion) => suggestion.label);

    expect(labels).toContain("Salmon");
    expect(labels).toContain("Walleye");
    expect(labels).toContain("Eggs");
    expect(labels).toContain("Tofu");
    expect(labels).toContain("Feta");
  });

  it("still hides suggestions if a future profile explicitly blocks them", () => {
    const profile = {
      ...createDefaultProfile(),
      allergies: [...createDefaultProfile().allergies, "fish" as const, "dairy" as const]
    };
    const labels = filterSuggestionsForProfile(mainIngredientSuggestions, profile).map((suggestion) => suggestion.label);

    expect(labels).not.toContain("Salmon");
    expect(labels).not.toContain("Feta");
  });

  it("hides strict Passover-incompatible suggestions when Passover mode is enabled", () => {
    const profile = createDefaultProfile();
    const labels = filterSuggestionsForProfile(mainIngredientSuggestions, profile, { kosherForPassover: true }).map((suggestion) => suggestion.label);

    expect(labels).toContain("Walleye");
    expect(labels).toContain("Eggs");
    expect(labels).toContain("Matzo farfel");
    expect(labels).toContain("Cauliflower rice");
    expect(labels).not.toContain("Tofu");
    expect(labels).not.toContain("Lentils");
    expect(labels).not.toContain("Chickpeas");
    expect(labels).not.toContain("Pasta");
  });

  it("appends suggestions without duplicating values", () => {
    expect(appendSuggestion("carrots, onions", "quinoa")).toBe("carrots, onions, quinoa");
    expect(appendSuggestion("carrots, onions", "onions")).toBe("carrots, onions");
  });
});
