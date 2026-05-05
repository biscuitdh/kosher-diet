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
  { label: "Cauliflower rice", value: "cauliflower rice" },
  { label: "Matzo farfel", value: "kosher for Passover matzo farfel" },
  { label: "Pasta", value: "pasta", blockedBy: ["gluten"], blockedForPassover: true }
];

export const availableIngredientSuggestions: Suggestion[] = [
  { label: "Carrots", value: "carrots" },
  { label: "Onions", value: "onions" },
  { label: "Garlic", value: "garlic" },
  { label: "Fresh herbs", value: "fresh herbs" },
  { label: "Rice", value: "rice", blockedForPassover: true },
  { label: "Quinoa", value: "quinoa" },
  { label: "Matzo farfel", value: "kosher for Passover matzo farfel" },
  { label: "Cauliflower rice", value: "cauliflower rice" },
  { label: "Zucchini", value: "zucchini" },
  { label: "Eggs", value: "eggs", blockedBy: ["eggs"] },
  { label: "Tofu", value: "tofu", blockedBy: ["soy"], blockedForPassover: true },
  { label: "Feta", value: "feta", blockedBy: ["dairy"] },
  { label: "Almonds", value: "almonds", blockedBy: ["nuts"] },
  { label: "Pita", value: "pita", blockedBy: ["gluten"], blockedForPassover: true }
];

const suggestedSidesByMain: { terms: string[]; suggestions: Suggestion[] }[] = [
  {
    terms: ["chicken", "turkey", "duck", "beef", "brisket", "lamb", "meat"],
    suggestions: [
      { label: "Cauliflower rice", value: "cauliflower rice" },
      { label: "Carrots", value: "carrots" },
      { label: "Zucchini", value: "zucchini" },
      { label: "Quinoa", value: "quinoa" },
      { label: "Rice", value: "rice", blockedForPassover: true },
      { label: "Matzo farfel", value: "kosher for Passover matzo farfel" }
    ]
  },
  {
    terms: ["walleye", "salmon", "cod", "fish", "tuna", "halibut"],
    suggestions: [
      { label: "Zucchini", value: "zucchini" },
      { label: "Cauliflower rice", value: "cauliflower rice" },
      { label: "Carrots", value: "carrots" },
      { label: "Fresh herbs", value: "fresh herbs" },
      { label: "Quinoa", value: "quinoa" },
      { label: "Rice", value: "rice", blockedForPassover: true }
    ]
  },
  {
    terms: ["egg", "omelet", "frittata", "shakshuka"],
    suggestions: [
      { label: "Mushrooms", value: "mushrooms" },
      { label: "Zucchini", value: "zucchini" },
      { label: "Fresh herbs", value: "fresh herbs" },
      { label: "Cauliflower rice", value: "cauliflower rice" },
      { label: "Feta", value: "feta", blockedBy: ["dairy"] },
      { label: "Pita", value: "pita", blockedBy: ["gluten"], blockedForPassover: true }
    ]
  },
  {
    terms: ["lentil", "chickpea", "bean", "tofu", "soy"],
    suggestions: [
      { label: "Carrots", value: "carrots" },
      { label: "Zucchini", value: "zucchini" },
      { label: "Fresh herbs", value: "fresh herbs" },
      { label: "Quinoa", value: "quinoa" },
      { label: "Rice", value: "rice", blockedForPassover: true },
      { label: "Pita", value: "pita", blockedBy: ["gluten"], blockedForPassover: true }
    ]
  },
  {
    terms: ["mushroom", "sweet potato", "cauliflower", "vegetable", "veggie", "squash", "broccoli"],
    suggestions: [
      { label: "Matzo farfel", value: "kosher for Passover matzo farfel" },
      { label: "Quinoa", value: "quinoa" },
      { label: "Carrots", value: "carrots" },
      { label: "Zucchini", value: "zucchini" },
      { label: "Cauliflower rice", value: "cauliflower rice" },
      { label: "Pasta", value: "pasta", blockedBy: ["gluten"], blockedForPassover: true }
    ]
  }
];

const genericSideSuggestions: Suggestion[] = [
  { label: "Cauliflower rice", value: "cauliflower rice" },
  { label: "Carrots", value: "carrots" },
  { label: "Zucchini", value: "zucchini" },
  { label: "Quinoa", value: "quinoa" },
  { label: "Matzo farfel", value: "kosher for Passover matzo farfel" },
  { label: "Rice", value: "rice", blockedForPassover: true }
];

export function getSideSuggestionsForMainIngredient(mainIngredient: string, options: { kosherForPassover?: boolean } = {}) {
  const normalizedMain = mainIngredient.toLowerCase().trim();
  if (!normalizedMain) return [];

  const matchedSuggestions = suggestedSidesByMain
    .filter((group) => group.terms.some((term) => normalizedMain.includes(term)))
    .flatMap((group) => group.suggestions);
  const suggestions = matchedSuggestions.length > 0 ? matchedSuggestions : genericSideSuggestions;
  const seen = new Set<string>();

  return suggestions.filter((suggestion) => {
    if (options.kosherForPassover && suggestion.blockedForPassover) return false;
    if (seen.has(suggestion.value)) return false;
    seen.add(suggestion.value);
    return true;
  });
}

export function filterSuggestionsForProfile(
  suggestions: readonly Suggestion[],
  profile: UserProfile,
  options: { kosherForPassover?: boolean } = {}
) {
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
