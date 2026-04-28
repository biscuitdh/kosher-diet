import { finderSearchSchema, type CookingDevice, type FinderSearch } from "@/lib/schemas";

const NUMBER_KEYS = ["servings", "maxCaloriesPerServing", "maxTotalTimeMinutes"] as const;
const STRING_KEYS = ["recipeName", "occasion", "cuisinePreference", "mainIngredient", "availableIngredients", "cookingDevice"] as const;

type FinderSearchNumberKey = (typeof NUMBER_KEYS)[number];

function isFinderSearchNumberKey(key: string): key is FinderSearchNumberKey {
  return NUMBER_KEYS.includes(key as FinderSearchNumberKey);
}

export function finderSearchToSearchParams(search: Partial<FinderSearch>) {
  const parsed = finderSearchSchema.parse(search);
  const defaults = finderSearchSchema.parse({});
  const params = new URLSearchParams();

  for (const key of STRING_KEYS) {
    const value = parsed[key];
    if (value && value !== defaults[key]) params.set(key, value);
  }

  if (parsed.kosherForPassover) params.set("kosherForPassover", "true");

  for (const key of NUMBER_KEYS) {
    const value = parsed[key];
    if (value !== undefined && value !== defaults[key]) params.set(key, String(value));
  }

  return params;
}

export function finderSearchFromSearchParams(params: URLSearchParams) {
  const raw: Partial<FinderSearch> = {};

  for (const [key, value] of params.entries()) {
    if (key === "cookingDevice") {
      raw.cookingDevice = value as CookingDevice;
    } else if (key === "recipeName") {
      raw.recipeName = value;
    } else if (key === "occasion") {
      raw.occasion = value;
    } else if (key === "cuisinePreference") {
      raw.cuisinePreference = value;
    } else if (key === "mainIngredient") {
      raw.mainIngredient = value;
    } else if (key === "availableIngredients") {
      raw.availableIngredients = value;
    } else if (isFinderSearchNumberKey(key)) {
      raw[key] = Number(value);
    } else if (key === "kosherForPassover") {
      raw.kosherForPassover = value === "true" || value === "1";
    }
  }

  return Object.keys(raw).length > 0 ? finderSearchSchema.parse(raw) : undefined;
}
