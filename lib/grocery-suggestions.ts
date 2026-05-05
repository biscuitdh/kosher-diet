import { listCatalogRecipes } from "@/lib/catalog";
import { normalizeGroceryKey } from "@/lib/grocery";
import { getShoppingName } from "@/lib/shopping";
import type { GroceryListItem, RecipeIngredient } from "@/lib/schemas";

export type GroceryItemSuggestion = {
  id: string;
  displayName: string;
  quantity: string;
  unit: string;
  source: "current-list" | "catalog";
  pantryStaple: boolean;
};

type InternalGroceryItemSuggestion = GroceryItemSuggestion & {
  searchText: string;
};

const DEFAULT_SUGGESTION_LIMIT = 7;
const NO_MATCH_SCORE = Number.POSITIVE_INFINITY;

let catalogSuggestionCache: InternalGroceryItemSuggestion[] | undefined;

function stripKosherLabel(value: string) {
  return value.replace(/\s*\((?:meat|dairy|parve)\)\s*/gi, "").replace(/\s+/g, " ").trim();
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function subsequenceScore(candidate: string, query: string) {
  let queryIndex = 0;
  let lastMatchIndex = -1;
  let gapScore = 0;

  for (let candidateIndex = 0; candidateIndex < candidate.length && queryIndex < query.length; candidateIndex += 1) {
    if (candidate[candidateIndex] !== query[queryIndex]) continue;
    if (lastMatchIndex >= 0) gapScore += candidateIndex - lastMatchIndex - 1;
    lastMatchIndex = candidateIndex;
    queryIndex += 1;
  }

  return queryIndex === query.length ? gapScore : undefined;
}

function scoreSuggestion(suggestion: InternalGroceryItemSuggestion, query: string) {
  const candidate = normalizeSearchText(`${suggestion.displayName} ${suggestion.searchText}`);
  const normalizedQuery = normalizeSearchText(query);
  if (!candidate || normalizedQuery.length < 2) return NO_MATCH_SCORE;

  if (candidate === normalizedQuery) return 0;
  if (candidate.startsWith(normalizedQuery)) return 1;
  if (candidate.split(" ").some((word) => word.startsWith(normalizedQuery))) return 2;

  const containsAt = candidate.indexOf(normalizedQuery);
  if (containsAt >= 0) return 3 + containsAt / 100;

  const fuzzyScore = subsequenceScore(candidate, normalizedQuery);
  return fuzzyScore === undefined ? NO_MATCH_SCORE : 5 + fuzzyScore / 100;
}

function displayNameForIngredient(ingredient: RecipeIngredient) {
  return stripKosherLabel(ingredient.name) || getShoppingName(ingredient);
}

function suggestionFromIngredient(ingredient: RecipeIngredient): InternalGroceryItemSuggestion {
  const displayName = displayNameForIngredient(ingredient);
  const shoppingName = getShoppingName(ingredient);

  return {
    id: `catalog-${normalizeGroceryKey(shoppingName || displayName)}`,
    displayName,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    source: "catalog",
    pantryStaple: Boolean(ingredient.pantryStaple),
    searchText: `${displayName} ${shoppingName}`
  };
}

function catalogSuggestions() {
  if (catalogSuggestionCache) return catalogSuggestionCache;

  const suggestions = new Map<string, InternalGroceryItemSuggestion>();

  for (const record of listCatalogRecipes()) {
    for (const ingredient of record.recipe.ingredients) {
      const suggestion = suggestionFromIngredient(ingredient);
      const key = normalizeGroceryKey(suggestion.searchText);
      const existing = suggestions.get(key);
      if (!existing || (existing.pantryStaple && !suggestion.pantryStaple)) suggestions.set(key, suggestion);
    }
  }

  catalogSuggestionCache = Array.from(suggestions.values());
  return catalogSuggestionCache;
}

function currentListSuggestions(items: GroceryListItem[]) {
  return items.map<InternalGroceryItemSuggestion>((item) => ({
    id: `current-${item.id}`,
    displayName: item.displayName,
    quantity: item.quantity,
    unit: item.unit,
    source: "current-list",
    pantryStaple: item.pantryStaple,
    searchText: `${item.displayName} ${item.shoppingName}`
  }));
}

function sourceRank(suggestion: GroceryItemSuggestion) {
  if (suggestion.source === "current-list") return 0;
  return suggestion.pantryStaple ? 2 : 1;
}

export function suggestGroceryItems(query: string, currentItems: GroceryListItem[] = [], limit = DEFAULT_SUGGESTION_LIMIT): GroceryItemSuggestion[] {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length < 2) return [];

  const byKey = new Map<string, InternalGroceryItemSuggestion>();

  for (const suggestion of [...currentListSuggestions(currentItems), ...catalogSuggestions()]) {
    const key = normalizeGroceryKey(suggestion.searchText);
    const existing = byKey.get(key);
    if (!existing || sourceRank(suggestion) < sourceRank(existing)) byKey.set(key, suggestion);
  }

  return Array.from(byKey.values())
    .map((suggestion) => ({ suggestion, score: scoreSuggestion(suggestion, normalizedQuery) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score;
      const sourceDifference = sourceRank(left.suggestion) - sourceRank(right.suggestion);
      if (sourceDifference !== 0) return sourceDifference;
      const lengthDifference = left.suggestion.displayName.length - right.suggestion.displayName.length;
      if (lengthDifference !== 0) return lengthDifference;
      return left.suggestion.displayName.localeCompare(right.suggestion.displayName);
    })
    .slice(0, limit)
    .map(({ suggestion }) => ({
      id: suggestion.id,
      displayName: suggestion.displayName,
      quantity: suggestion.quantity,
      unit: suggestion.unit,
      source: suggestion.source,
      pantryStaple: suggestion.pantryStaple
    }));
}
