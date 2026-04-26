import { describe, expect, it } from "vitest";
import {
  appendSuggestion,
  filterSuggestionsForProfile,
  mainIngredientSuggestions
} from "@/lib/generator-suggestions";
import { createDefaultProfile } from "@/lib/schemas";

describe("generator suggestions", () => {
  it("hides fish suggestions when the profile blocks fish", () => {
    const profile = createDefaultProfile();
    const labels = filterSuggestionsForProfile(mainIngredientSuggestions, profile).map((suggestion) => suggestion.label);

    expect(labels).not.toContain("Salmon");
  });

  it("shows fish suggestions when fish allergy is disabled", () => {
    const profile = {
      ...createDefaultProfile(),
      allergies: createDefaultProfile().allergies.filter((allergy) => allergy !== "fish")
    };
    const labels = filterSuggestionsForProfile(mainIngredientSuggestions, profile).map((suggestion) => suggestion.label);

    expect(labels).toContain("Salmon");
  });

  it("appends suggestions without duplicating values", () => {
    expect(appendSuggestion("carrots, onions", "quinoa")).toBe("carrots, onions, quinoa");
    expect(appendSuggestion("carrots, onions", "onions")).toBe("carrots, onions");
  });
});
