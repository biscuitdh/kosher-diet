import type { AllergyId, UserProfile } from "@/lib/schemas";

export type Suggestion = {
  label: string;
  value: string;
  blockedBy?: AllergyId[];
  blockedForPassover?: boolean;
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
  { label: "Walleye", value: "walleye" },
  { label: "Salmon", value: "salmon", blockedBy: ["fish"] },
  { label: "Cod", value: "cod" },
  { label: "Eggs", value: "eggs", blockedBy: ["eggs"] },
  { label: "Tofu", value: "tofu", blockedBy: ["soy"], blockedForPassover: true },
  { label: "Feta", value: "feta", blockedBy: ["dairy"] },
  { label: "Lentils", value: "lentils", blockedForPassover: true },
  { label: "Chickpeas", value: "chickpeas", blockedForPassover: true },
  { label: "Mushrooms", value: "mushrooms" },
  { label: "Sweet potatoes", value: "sweet potatoes" },
  { label: "Pasta", value: "pasta", blockedBy: ["gluten"], blockedForPassover: true }
];

export const availableIngredientSuggestions: Suggestion[] = [
  { label: "Carrots", value: "carrots" },
  { label: "Onions", value: "onions" },
  { label: "Garlic", value: "garlic" },
  { label: "Fresh herbs", value: "fresh herbs" },
  { label: "Rice", value: "rice", blockedForPassover: true },
  { label: "Quinoa", value: "quinoa" },
  { label: "Eggs", value: "eggs", blockedBy: ["eggs"] },
  { label: "Tofu", value: "tofu", blockedBy: ["soy"], blockedForPassover: true },
  { label: "Feta", value: "feta", blockedBy: ["dairy"] },
  { label: "Almonds", value: "almonds", blockedBy: ["nuts"] },
  { label: "Pita", value: "pita", blockedBy: ["gluten"], blockedForPassover: true }
];

export const extraNoteSuggestions: Suggestion[] = [
  { label: "Low cleanup", value: "low cleanup" },
  { label: "Make ahead", value: "make ahead" },
  { label: "Kid-friendly", value: "kid-friendly" },
  { label: "No cilantro", value: "no cilantro" }
];

export function filterSuggestionsForProfile(suggestions: readonly Suggestion[], profile: UserProfile, options: { kosherForPassover?: boolean } = {}) {
  const blocked = new Set(profile.allergies);
  return suggestions.filter((suggestion) => {
    if (options.kosherForPassover && suggestion.blockedForPassover) return false;
    return !suggestion.blockedBy?.some((allergy) => blocked.has(allergy));
  });
}

export function appendSuggestion(currentValue: string, suggestion: string) {
  const existing = currentValue
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (existing.includes(suggestion.toLowerCase())) return currentValue;
  return currentValue.trim() ? `${currentValue.trim()}, ${suggestion}` : suggestion;
}
