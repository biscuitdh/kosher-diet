import type { AllergyId, UserProfile } from "@/lib/schemas";

export type Suggestion = {
  label: string;
  value: string;
  blockedBy?: AllergyId[];
};

export const occasionSuggestions: Suggestion[] = [
  { label: "Shabbat dinner", value: "Shabbat dinner" },
  { label: "Weeknight dinner", value: "Weeknight dinner" },
  { label: "Holiday side", value: "Holiday side dish" },
  { label: "Lunch prep", value: "Lunch prep" }
];

export const cuisineSuggestions: Suggestion[] = [
  { label: "Mediterranean", value: "Mediterranean" },
  { label: "Sephardi", value: "Sephardi" },
  { label: "Ashkenazi", value: "Ashkenazi" },
  { label: "Modern Israeli", value: "Modern Israeli" }
];

export const mainIngredientSuggestions: Suggestion[] = [
  { label: "Chicken thighs", value: "chicken thighs" },
  { label: "Salmon", value: "salmon", blockedBy: ["fish"] },
  { label: "Lentils", value: "lentils" },
  { label: "Chickpeas", value: "chickpeas" },
  { label: "Mushrooms", value: "mushrooms" },
  { label: "Sweet potatoes", value: "sweet potatoes" }
];

export const availableIngredientSuggestions: Suggestion[] = [
  { label: "Carrots", value: "carrots" },
  { label: "Onions", value: "onions" },
  { label: "Garlic", value: "garlic" },
  { label: "Fresh herbs", value: "fresh herbs" },
  { label: "Rice", value: "rice" },
  { label: "Quinoa", value: "quinoa" },
  { label: "Eggs", value: "eggs", blockedBy: ["eggs"] },
  { label: "Tofu", value: "tofu", blockedBy: ["soy"] },
  { label: "Feta", value: "feta", blockedBy: ["dairy"] },
  { label: "Almonds", value: "almonds", blockedBy: ["nuts"] },
  { label: "Pita", value: "pita", blockedBy: ["gluten"] }
];

export const extraNoteSuggestions: Suggestion[] = [
  { label: "Low cleanup", value: "low cleanup" },
  { label: "Make ahead", value: "make ahead" },
  { label: "Kid-friendly", value: "kid-friendly" },
  { label: "No cilantro", value: "no cilantro" }
];

export function filterSuggestionsForProfile(suggestions: readonly Suggestion[], profile: UserProfile) {
  const blocked = new Set(profile.allergies);
  return suggestions.filter((suggestion) => !suggestion.blockedBy?.some((allergy) => blocked.has(allergy)));
}

export function appendSuggestion(currentValue: string, suggestion: string) {
  const existing = currentValue
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (existing.includes(suggestion.toLowerCase())) return currentValue;
  return currentValue.trim() ? `${currentValue.trim()}, ${suggestion}` : suggestion;
}
